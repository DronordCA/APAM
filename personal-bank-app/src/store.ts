import type { StoreValue } from './types';

export const store = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await window.storage?.get(key);
      return result ? (JSON.parse(result.value) as T) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: StoreValue) {
    try {
      await window.storage?.set(key, JSON.stringify(value));
    } catch {
      // noop
    }
  },
};
