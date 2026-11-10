import { handleHandoff } from "./lib/handler.mjs";
import { openRuntimeStore } from "./lib/store.mjs";

export default async (request, context) => {
  const store = await openRuntimeStore();
  return handleHandoff(request, {
    env: { ...process.env, CONTEXT: process.env.CONTEXT || context?.deploy?.context || "" },
    store,
  });
};

export const config = {
  path: "/api/chat-handoff",
  rateLimit: {
    windowLimit: 5,
    windowSize: 3600,
    aggregateBy: ["ip", "domain"],
  },
};
