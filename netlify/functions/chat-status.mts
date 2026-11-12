import { handleStatus } from "./lib/handler.mjs";

export default async (request, context) => {
  return handleStatus(request, {
    env: { ...process.env, CONTEXT: process.env.CONTEXT || context?.deploy?.context || "" },
  });
};

export const config = {
  path: "/api/chat-status",
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
