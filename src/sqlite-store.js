import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const LEGACY_MIGRATION = 'legacy-json-v1';
const SENSITIVE_KEYS = /pin|password|token|secret|authorization|credential|hash|session/i;

function clone(value) {
  return structuredClone(value);
}

function scrubMetadata(value) {
  if (Array.isArray(value)) return value.map(scrubMetadata);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => (
    SENSITIVE_KEYS.test(key) ? [] : [[key, scrubMetadata(entry)]]
  )));
}

async function readRequiredJson(path, missingMessage) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && missingMessage) throw new Error(missingMessage);
    throw new Error(`${path} gagal dibaca: ${error.message}`);
  }
}

async function readOptionalJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return clone(fallback);
    throw new Error(`${path} gagal dibaca: ${error.message}`);
  }
}

export class SqliteDatabase {
  #filePath;
  #database;

  constructor(filePath) {
    this.#filePath = filePath;
  }

  async init() {
    await mkdir(dirname(this.#filePath), { recursive: true });
    this.#database = new DatabaseSync(this.#filePath);
    this.#database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS app_state (
        state_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        outlet_id TEXT,
        metadata TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_key TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    return this;
  }

  close() {
    if (!this.#database) return;
    this.#database.close();
    this.#database = null;
  }

  hasState(key) {
    return Boolean(this.#database.prepare('SELECT 1 FROM app_state WHERE state_key = ?').get(key));
  }

  readState(key) {
    const row = this.#database.prepare('SELECT payload FROM app_state WHERE state_key = ?').get(key);
    return row ? JSON.parse(row.payload) : undefined;
  }

  writeState(key, value, now = new Date().toISOString()) {
    this.#database.prepare(`
      INSERT INTO app_state (state_key, payload, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(state_key) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `).run(key, JSON.stringify(value), now);
    return clone(value);
  }

  transaction(callback) {
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      const output = callback();
      this.#database.exec('COMMIT');
      return output;
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
  }

  hasMigration(key) {
    return Boolean(this.#database.prepare('SELECT 1 FROM schema_migrations WHERE migration_key = ?').get(key));
  }

  markMigration(key, now = new Date().toISOString()) {
    this.#database.prepare(`
      INSERT OR IGNORE INTO schema_migrations (migration_key, applied_at)
      VALUES (?, ?)
    `).run(key, now);
  }

  appendAudit({
    actorType,
    actorId,
    action,
    outletId = null,
    metadata = {},
    createdAt = new Date().toISOString(),
  }) {
    this.#database.prepare(`
      INSERT INTO audit_log (
        created_at, actor_type, actor_id, action, outlet_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      createdAt,
      String(actorType || 'system'),
      String(actorId || 'system'),
      String(action),
      outletId ? String(outletId) : null,
      JSON.stringify(scrubMetadata(metadata)),
    );
  }

  listAudit({ outletId, limit = 100 } = {}) {
    const safeLimit = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
    const rows = outletId
      ? this.#database.prepare(`
          SELECT * FROM audit_log
          WHERE outlet_id = ?
          ORDER BY id DESC
          LIMIT ?
        `).all(String(outletId), safeLimit)
      : this.#database.prepare(`
          SELECT * FROM audit_log
          ORDER BY id DESC
          LIMIT ?
        `).all(safeLimit);
    return rows.map((row) => ({
      id: Number(row.id),
      createdAt: row.created_at,
      actorType: row.actor_type,
      actorId: row.actor_id,
      action: row.action,
      outletId: row.outlet_id,
      metadata: JSON.parse(row.metadata),
    }));
  }
}

export class SqliteStore {
  #database;
  #key;
  #initialState;
  #state;
  #queue = Promise.resolve();

  constructor(database, key, initialState) {
    this.#database = database;
    this.#key = key;
    this.#initialState = clone(initialState);
  }

  async init() {
    if (!this.#database.hasState(this.#key)) {
      this.#database.writeState(this.#key, this.#initialState);
    }
    this.#state = this.#database.readState(this.#key);
    return this;
  }

  get() {
    if (this.#state === undefined) throw new Error('Store belum diinisialisasi');
    return clone(this.#state);
  }

  refreshFromDatabase() {
    const persisted = this.#database.readState(this.#key);
    if (persisted === undefined) throw new Error(`State ${this.#key} tidak ditemukan`);
    this.#state = clone(persisted);
    return this.get();
  }

  update(transform) {
    const operation = async () => {
      const nextState = await transform(this.get());
      this.#database.writeState(this.#key, nextState);
      this.#state = clone(nextState);
      return this.get();
    };
    this.#queue = this.#queue.then(operation, operation);
    return this.#queue;
  }
}

export async function importLegacyJson({ database, dataDir, initialState }) {
  if (database.hasMigration(LEGACY_MIGRATION)) return false;

  const outletsPath = join(dataDir, 'outlets.json');
  const securityPath = join(dataDir, 'security.json');
  const outlets = await readRequiredJson(outletsPath, 'outlets.json tidak ditemukan');
  const security = await readRequiredJson(
    securityPath,
    'security.json tidak ditemukan. Server berhenti agar tidak fallback ke PIN default.',
  );
  if (!Array.isArray(outlets) || outlets.length === 0) {
    throw new Error('Konfigurasi outlet harus berupa array yang tidak kosong');
  }
  if (!security?.ownerPinHash?.salt || !security?.ownerPinHash?.hash) {
    throw new Error('security.json tidak memiliki ownerPinHash yang valid');
  }

  const outletStates = new Map();
  for (const outlet of outlets) {
    if (!outlet?.id || !outlet?.name) throw new Error('Setiap outlet wajib memiliki id dan name');
    const state = await readOptionalJson(
      join(dataDir, `outlet-${outlet.id}.json`),
      initialState,
    );
    outletStates.set(outlet.id, state);
  }
  const sourceProducts = [...outletStates.values()]
    .find((state) => Array.isArray(state?.products) && state.products.length)?.products
    ?? initialState?.products
    ?? [];
  const registry = {
    outlets,
    partners: [],
    users: [],
    masterProducts: clone(sourceProducts),
    schemaVersion: 1,
  };

  database.transaction(() => {
    database.writeState('registry', registry);
    database.writeState('security', security);
    for (const [outletId, state] of outletStates) {
      database.writeState(`outlet:${outletId}`, state);
    }
    database.markMigration(LEGACY_MIGRATION);
  });
  return true;
}
