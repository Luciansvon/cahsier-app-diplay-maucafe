import { randomUUID } from 'node:crypto';

import { createPinHash, verifyPinHash } from './security.js';

function clone(value) {
  return structuredClone(value);
}

function text(value, label, maxLength = 160) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} wajib diisi`);
  if (normalized.length > maxLength) throw new Error(`${label} maksimal ${maxLength} karakter`);
  return normalized;
}

function username(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(normalized)) {
    throw new Error('Username harus 3-40 karakter berupa huruf kecil, angka, titik, strip, atau underscore');
  }
  return normalized;
}

function ensureUniqueUsername(registry, value) {
  const normalized = username(value);
  if (registry.users.some((user) => user.username.toLowerCase() === normalized)) {
    throw new Error('Username sudah dipakai');
  }
  return normalized;
}

function slugPart(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^mau\s*cafe\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'outlet';
}

function uniqueOutletId(registry, name) {
  const base = `maucafe-${slugPart(name)}`;
  let candidate = base;
  let suffix = 2;
  const used = new Set(registry.outlets.map((outlet) => outlet.id));
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function findPartner(registry, partnerId) {
  const partner = registry.partners.find((candidate) => candidate.id === partnerId && candidate.active !== false);
  if (!partner) throw new Error('Mitra tidak ditemukan atau nonaktif');
  return partner;
}

function findOutlet(registry, outletId) {
  const outlet = registry.outlets.find((candidate) => candidate.id === outletId);
  if (!outlet) throw new Error('Outlet tidak ditemukan');
  return outlet;
}

export function normalizeRegistry(rawRegistry = {}) {
  const registry = clone(rawRegistry);
  registry.outlets = Array.isArray(registry.outlets) ? registry.outlets : [];
  registry.partners = Array.isArray(registry.partners) ? registry.partners : [];
  registry.users = Array.isArray(registry.users) ? registry.users : [];
  registry.masterProducts = Array.isArray(registry.masterProducts) ? registry.masterProducts : [];
  registry.schemaVersion = 2;
  for (const outlet of registry.outlets) {
    outlet.status ??= 'active';
    outlet.partnerId ??= null;
  }
  for (const partner of registry.partners) {
    partner.outletIds = Array.isArray(partner.outletIds) ? [...new Set(partner.outletIds)] : [];
    partner.active = partner.active !== false;
  }
  for (const user of registry.users) {
    user.outletIds = Array.isArray(user.outletIds) ? [...new Set(user.outletIds)] : [];
    user.active = user.active !== false;
  }
  return registry;
}

export function createPartner(currentRegistry, input, now = new Date().toISOString()) {
  const registry = normalizeRegistry(currentRegistry);
  const partner = {
    id: `partner-${randomUUID()}`,
    name: text(input?.name, 'Nama Mitra', 120),
    outletIds: [],
    active: true,
    createdAt: now,
  };
  const user = {
    id: `user-${randomUUID()}`,
    username: ensureUniqueUsername(registry, input?.username),
    name: partner.name,
    role: 'partner',
    partnerId: partner.id,
    outletIds: [],
    pinHash: createPinHash(input?.pin),
    active: true,
    createdAt: now,
  };
  registry.partners.push(partner);
  registry.users.push(user);
  return { registry, partner, user };
}

export function partnerOwnsOutlet(currentRegistry, partnerId, outletId) {
  const registry = normalizeRegistry(currentRegistry);
  const partner = registry.partners.find((candidate) => candidate.id === partnerId && candidate.active !== false);
  const outlet = registry.outlets.find((candidate) => candidate.id === outletId);
  return Boolean(partner && outlet && outlet.partnerId === partner.id && partner.outletIds.includes(outlet.id));
}

export function proposeOutlet(currentRegistry, input, now = new Date().toISOString()) {
  const registry = normalizeRegistry(currentRegistry);
  const partner = findPartner(registry, input?.partnerId);
  const outlet = {
    id: uniqueOutletId(registry, input?.name),
    name: text(input?.name, 'Nama outlet', 120),
    address: text(input?.address, 'Alamat outlet', 240),
    partnerId: partner.id,
    status: 'pending',
    createdAt: now,
  };
  registry.outlets.push(outlet);
  partner.outletIds.push(outlet.id);
  for (const user of registry.users) {
    if (user.role === 'partner' && user.partnerId === partner.id) {
      user.outletIds = [...new Set([...(user.outletIds ?? []), outlet.id])];
    }
  }
  return { registry, outlet };
}

export function approveOutlet(currentRegistry, outletId, input, now = new Date().toISOString()) {
  const registry = normalizeRegistry(currentRegistry);
  const outlet = findOutlet(registry, outletId);
  if (outlet.status === 'active') throw new Error('Outlet sudah aktif');
  if (outlet.status !== 'pending') throw new Error('Status outlet tidak dapat disetujui');
  outlet.status = 'active';
  outlet.approvedAt = now;
  outlet.approvedBy = text(input?.approvedBy, 'Penyetuju', 100);
  return { registry, outlet };
}

export function assignOutletToPartner(currentRegistry, outletId, partnerId, now = new Date().toISOString()) {
  const registry = normalizeRegistry(currentRegistry);
  const outlet = findOutlet(registry, outletId);
  const partner = findPartner(registry, partnerId);
  for (const candidate of registry.partners) {
    candidate.outletIds = (candidate.outletIds ?? []).filter((id) => id !== outlet.id);
  }
  for (const user of registry.users) {
    if (user.role === 'partner') user.outletIds = (user.outletIds ?? []).filter((id) => id !== outlet.id);
  }
  outlet.partnerId = partner.id;
  outlet.assignedAt = now;
  partner.outletIds = [...new Set([...(partner.outletIds ?? []), outlet.id])];
  for (const user of registry.users) {
    if (user.role === 'partner' && user.partnerId === partner.id) {
      user.outletIds = [...new Set([...(user.outletIds ?? []), outlet.id])];
    }
  }
  return { registry, outlet, partner };
}

export function createEmployee(currentRegistry, input, now = new Date().toISOString()) {
  const registry = normalizeRegistry(currentRegistry);
  const partner = findPartner(registry, input?.partnerId);
  const outlet = findOutlet(registry, input?.outletId);
  if (!partnerOwnsOutlet(registry, partner.id, outlet.id)) {
    throw new Error('Outlet bukan milik Mitra ini');
  }
  const user = {
    id: `user-${randomUUID()}`,
    username: ensureUniqueUsername(registry, input?.username),
    name: text(input?.name, 'Nama Karyawan', 120),
    role: 'employee',
    partnerId: partner.id,
    outletIds: [outlet.id],
    pinHash: createPinHash(input?.pin),
    active: true,
    createdAt: now,
  };
  registry.users.push(user);
  return { registry, user };
}

export function updateEmployee(currentRegistry, employeeId, input) {
  const registry = normalizeRegistry(currentRegistry);
  const user = registry.users.find((candidate) => (
    candidate.id === employeeId
    && candidate.role === 'employee'
    && candidate.partnerId === input?.partnerId
  ));
  if (!user) throw new Error('Karyawan tidak ditemukan');
  if (!user.outletIds.some((outletId) => partnerOwnsOutlet(registry, input.partnerId, outletId))) {
    throw new Error('Karyawan bukan bagian dari Mitra ini');
  }
  if ('name' in input) user.name = text(input.name, 'Nama Karyawan', 120);
  if ('active' in input) user.active = Boolean(input.active);
  if (input.pin !== undefined && String(input.pin).trim()) user.pinHash = createPinHash(input.pin);
  return { registry, user };
}

export function authenticateUser(currentRegistry, {
  username: inputUsername,
  pin,
  role,
  outletId,
}) {
  const registry = normalizeRegistry(currentRegistry);
  const normalized = String(inputUsername ?? '').trim().toLowerCase();
  const user = registry.users.find((candidate) => (
    candidate.active !== false
    && candidate.username.toLowerCase() === normalized
    && (!role || candidate.role === role)
    && (!outletId || candidate.outletIds.includes(outletId))
  ));
  if (!user || !verifyPinHash(user.pinHash, pin)) return null;
  return clone(user);
}

export function safeRegistry(currentRegistry) {
  const registry = normalizeRegistry(currentRegistry);
  return {
    schemaVersion: registry.schemaVersion,
    outlets: registry.outlets.map(({ adminPinHash, adminPin, ...outlet }) => clone(outlet)),
    partners: clone(registry.partners),
    users: registry.users.map(({ pinHash, pin, ...user }) => clone(user)),
    masterProducts: clone(registry.masterProducts),
  };
}
