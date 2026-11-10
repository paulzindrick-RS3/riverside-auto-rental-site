/** Rate-limit and spend counters. Tests inject a memory store. */

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
    const { getStore } = await import("@netlify/blobs");
    let blobs;
    try {
      blobs = getStore({ name: "chat-limits", consistency: "strong" });
    } catch {
      blobs = getStore("chat-limits");
    }
    await blobs.get("__probe");
    return {
      persistent: true,
      async get(key) {
        const raw = await blobs.get(key);
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
