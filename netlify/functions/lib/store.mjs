/** Rate-limit and spend counters. Tests inject a memory store. */
import { getStore } from "@netlify/blobs";

/**
 * @netlify/blobs reads a base64 JSON string. Some function runtimes leave the
 * decoded object on globalThis, which the client then treats as "no context".
 */
export function normalizeBlobsContext() {
  const raw = globalThis.netlifyBlobsContext;
  if (typeof raw === "string" && raw) return;
  if (raw && typeof raw === "object" && raw.siteID && raw.token) {
    globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify(raw)).toString("base64");
    return;
  }
  if (raw && typeof raw === "object") {
    delete globalThis.netlifyBlobsContext;
  }
  const fromEnv = process.env.NETLIFY_BLOBS_CONTEXT;
  if (typeof fromEnv === "string" && fromEnv && typeof globalThis.netlifyBlobsContext !== "string") {
    globalThis.netlifyBlobsContext = fromEnv;
  }
}

function storeDetail(error) {
  const name = error && /^[A-Za-z0-9_]{1,40}$/.test(error.name) ? error.name : "Error";
  const status = error && Number.isFinite(error.status) ? `:${error.status}` : "";
  return `${name}${status}`;
}

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
    normalizeBlobsContext();
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
  } catch (error) {
    return {
      persistent: false,
      reason: storeDetail(error),
      async get() {
        return null;
      },
      async set() {},
    };
  }
}
