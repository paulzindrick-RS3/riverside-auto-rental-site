/** Rate-limit and spend counters. Tests inject a memory store. */
import { getStore } from "@netlify/blobs";

export function createMemoryStore() {
  const map = new Map();
  return {
    persistent: true,
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

export async function openRuntimeStore() {
  try {
    const blobs = getStore("chat-limits");
    await blobs.get("__probe", { type: "text" });
    return {
      persistent: true,
      async get(key) {
        const raw = await blobs.get(key, { type: "text" });
        if (raw == null || raw === "") return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      },
      async set(key, value) {
        await blobs.set(key, JSON.stringify(value));
      },
    };
  } catch {
    return {
      persistent: false,
      async get() {
        return null;
      },
      async set() {},
    };
  }
}
