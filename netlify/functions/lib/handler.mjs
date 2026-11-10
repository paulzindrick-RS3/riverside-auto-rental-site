/**
 * HTTP handlers for status and chat.
 * Dependencies are injected so tests can run without Netlify or OpenAI.
 */
import {
  LIMITS,
  PHONE_FALLBACK,
  SENSITIVE_SAFE,
  TEXT_US,
  applyOutputGuards,
  chatEnabled,
  clientIp,
  costMicro,
  estimateCallMicro,
  fallbackModel,
  hasApiKey,
  looksLikeInjection,
  originAllowed,
  primaryModel,
  requestHost,
  requestOrigin,
  resolveMode,
  sanitizeHistory,
  spendCapMicro,
  stripSensitive,
  utcDay,
  validSessionId,
} from "./guardrails.mjs";
import { allowedCentsFromKnowledge, buildSystemPrompt, knowledgeText, loadKnowledgeFromDisk, wrapVisitor } from "./knowledge.mjs";
import { addSpend, bumpCounter, bumpWindow, getSpend, hashKey } from "./limits.mjs";
import { complete, moderate } from "./openai.mjs";

function log(deps, event) {
  const logger = deps.log || ((entry) => console.log(JSON.stringify(entry)));
  logger(event);
}

function json(payload, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function preflight(origin) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}

function begin(request, deps) {
  const env = deps.env || {};
  const originHeader = requestOrigin(request);
  const host = requestHost(request);
  if (!originAllowed(originHeader, env, host)) {
    return { early: json({ error: "origin" }, 403) };
  }
  if (request.method === "OPTIONS") {
    return { early: preflight(originHeader) };
  }
  return { env, origin: originHeader };
}

function chatReply(text, extra, origin) {
  return json({ reply: text, ...extra }, 200, origin);
}

function loadKnowledge(deps) {
  if (deps.knowledge) return deps.knowledge;
  if (deps.loadKnowledge) return deps.loadKnowledge();
  return loadKnowledgeFromDisk();
}

export async function handleStatus(request, deps = {}) {
  const started = begin(request, deps);
  if (started.early) return started.early;
  if (request.method !== "GET") return json({ error: "method" }, 405, started.origin);
  const mode = resolveMode(started.env);
  log(deps, { fn: "chat-status", mode });
  return json({ mode, phone: "715-396-1466" }, 200, started.origin);
}

export async function handleChat(request, deps = {}) {
  const started = begin(request, deps);
  if (started.early) return started.early;
  const { env, origin } = started;
  if (request.method !== "POST") return json({ error: "method" }, 405, origin);

  const mode = resolveMode(env);
  if (mode === "hidden") {
    log(deps, { fn: "chat", mode: "hidden" });
    return json({ error: "disabled", mode: "hidden" }, 403, origin);
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return json({ error: "body" }, 400, origin);
  }
  if (raw.length > LIMITS.maxBodyChars) return json({ error: "too_large" }, 413, origin);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "json" }, 400, origin);
  }

  const now = typeof deps.now === "function" ? deps.now() : Date.now();
  const store = deps.store;
  const ip = clientIp(request);
  if (store && store.persistent) {
    const ipCount = await bumpWindow(store, `ip:${hashKey(ip)}`, LIMITS.ipWindowMs, now);
    if (ipCount > LIMITS.ipPerWindow) {
      log(deps, { fn: "chat", limited: "ip" });
      return chatReply(PHONE_FALLBACK, { limited: true, fallback: true }, origin);
    }
  }

  const message = String((body && body.message) || "").trim();
  if (!message) return json({ error: "message" }, 400, origin);
  if (message.length > LIMITS.messageChars) return json({ error: "message_length" }, 400, origin);
  if (!validSessionId(body && body.sessionId)) return json({ error: "session" }, 400, origin);

  const loadedAt = Number(body && body.loadedAt);
  if (!Number.isFinite(loadedAt)) return json({ error: "loaded" }, 400, origin);
  const age = now - loadedAt;
  if (age < LIMITS.firstMessageDelayMs || age > LIMITS.maxLoadedAgeMs) {
    log(deps, { fn: "chat", ignored: "timing" });
    return chatReply(PHONE_FALLBACK, { ignored: true, fallback: true }, origin);
  }

  if (store && store.persistent) {
    const day = utcDay(now);
    const sessionCount = await bumpCounter(store, `sess:${hashKey(body.sessionId)}:${day}`);
    if (sessionCount > LIMITS.sessionPerDay) {
      log(deps, { fn: "chat", limited: "session" });
      return chatReply(PHONE_FALLBACK, { limited: true, fallback: true, showHandoff: true }, origin);
    }
  }

  if (looksLikeInjection(message)) {
    log(deps, { fn: "chat", blocked: "injection" });
    return chatReply(
      `I can only answer questions about Riverside Auto Rental from our website. ${TEXT_US}`,
      { fallback: true },
      origin,
    );
  }

  const stripped = stripSensitive(message);
  const meaningful = stripped.text.replace(/\[removed\]/g, "").trim();
  if (!meaningful) {
    log(deps, { fn: "chat", blocked: "sensitive" });
    return chatReply(SENSITIVE_SAFE, { fallback: true, showHandoff: true }, origin);
  }

  if (mode === "fallback" || !hasApiKey(env)) {
    log(deps, { fn: "chat", mode: "fallback" });
    return chatReply(PHONE_FALLBACK, { fallback: true, showHandoff: true, mode: "fallback" }, origin);
  }

  if (!store || !store.persistent) {
    log(deps, { fn: "chat", blocked: "spend_store" });
    return chatReply(PHONE_FALLBACK, { fallback: true, showHandoff: true }, origin);
  }

  let knowledge;
  try {
    knowledge = loadKnowledge(deps);
  } catch {
    log(deps, { fn: "chat", blocked: "knowledge" });
    return chatReply(PHONE_FALLBACK, { fallback: true, showHandoff: true }, origin);
  }
  if (knowledgeText(knowledge).length > LIMITS.maxKnowledgeChars) {
    log(deps, { fn: "chat", blocked: "knowledge_size" });
    return chatReply(PHONE_FALLBACK, { fallback: true, showHandoff: true }, origin);
  }

  const fetchImpl = typeof deps.fetch === "function" ? deps.fetch : globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return chatReply(PHONE_FALLBACK, { fallback: true }, origin);
  }
  const apiKey = String(env.OPENAI_API_KEY).trim();
  const history = sanitizeHistory(body.history);
  const system = buildSystemPrompt(knowledge);
  const messages = [{ role: "system", content: system }];
  for (const turn of history) {
    messages.push({
      role: turn.role,
      content: turn.role === "user" ? wrapVisitor(turn.content) : turn.content,
    });
  }
  messages.push({ role: "user", content: wrapVisitor(stripped.text) });

  const day = utcDay(now);
  const spent = await getSpend(store, day);
  const cap = spendCapMicro(env);
  const preferred = primaryModel(env);
  const backup = fallbackModel(env);
  const preferredCost = estimateCallMicro(preferred, system.length + stripped.text.length);
  const backupCost = estimateCallMicro(backup, system.length + stripped.text.length);
  let model = preferred;
  if (spent + preferredCost > cap) {
    if (backup !== preferred && spent + backupCost <= cap) model = backup;
    else {
      log(deps, { fn: "chat", limited: "spend" });
      return chatReply(PHONE_FALLBACK, { limited: true, fallback: true, showHandoff: true }, origin);
    }
  }

  const flagged = await moderate(fetchImpl, apiKey, stripped.text);
  if (flagged) {
    log(deps, { fn: "chat", blocked: "moderation" });
    return chatReply(
      `I can't help with that. ${TEXT_US}`,
      { fallback: true },
      origin,
    );
  }

  const run = deps.complete || complete;
  let result;
  try {
    result = await run(fetchImpl, apiKey, model, messages);
  } catch {
    if (model !== backup) {
      try {
        model = backup;
        const retryCost = estimateCallMicro(backup, system.length + stripped.text.length);
        if (spent + retryCost > cap) {
          log(deps, { fn: "chat", limited: "spend" });
          return chatReply(PHONE_FALLBACK, { limited: true, fallback: true, showHandoff: true }, origin);
        }
        result = await run(fetchImpl, apiKey, model, messages);
      } catch {
        log(deps, { fn: "chat", error: "model" });
        return chatReply(PHONE_FALLBACK, { fallback: true, showHandoff: true }, origin);
      }
    } else {
      log(deps, { fn: "chat", error: "model" });
      return chatReply(PHONE_FALLBACK, { fallback: true, showHandoff: true }, origin);
    }
  }

  const billed = result.promptTokens || result.completionTokens
    ? { promptTokens: result.promptTokens, cachedTokens: result.cachedTokens, completionTokens: result.completionTokens }
    : null;
  const micro = billed ? costMicro(model, billed) : estimateCallMicro(model, system.length);
  await addSpend(store, day, micro);

  const allowed = allowedCentsFromKnowledge(knowledge);
  const guarded = applyOutputGuards(result.text, allowed);
  log(deps, { fn: "chat", model, guarded: guarded.reason || "ok" });
  return chatReply(guarded.text, { fallback: Boolean(guarded.reason), showHandoff: Boolean(guarded.reason) }, origin);
}
