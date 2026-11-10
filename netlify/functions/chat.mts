import { handleChat } from "./lib/handler.mjs";
import { openRuntimeStore } from "./lib/store.mjs";

export default async (request, context) => {
  const store = await openRuntimeStore();
  return handleChat(request, {
    env: { ...process.env, CONTEXT: process.env.CONTEXT || context?.deploy?.context || "" },
    store,
    fetch: globalThis.fetch,
  });
};

export const config = {
  path: "/api/chat",
  includedFiles: ["data/chat-knowledge.json"],
  timeout: 26,
  rateLimit: {
    windowLimit: 10,
    windowSize: 600,
    aggregateBy: ["ip", "domain"],
  },
};
