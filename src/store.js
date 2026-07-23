import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function clone(value) {
  return structuredClone(value);
}

export class JsonStore {
  #filePath;
  #initialState;
  #state;
  #queue = Promise.resolve();

  constructor(filePath, initialState) {
    this.#filePath = filePath;
    this.#initialState = clone(initialState);
  }

  async init() {
    await mkdir(dirname(this.#filePath), { recursive: true });
    try {
      this.#state = JSON.parse(await readFile(this.#filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.#state = clone(this.#initialState);
      await this.#write(this.#state);
    }
    return this;
  }

  get() {
    if (this.#state === undefined) throw new Error('Store belum diinisialisasi');
    return clone(this.#state);
  }

  update(transform) {
    const operation = async () => {
      const nextState = await transform(this.get());
      await this.#write(nextState);
      this.#state = clone(nextState);
      return this.get();
    };
    this.#queue = this.#queue.then(operation, operation);
    return this.#queue;
  }

  async #write(state) {
    const temporaryPath = `${this.#filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.#filePath);
  }
}
