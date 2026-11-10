/**
 * Pure guardrails for the Riverside chat function.
 * No network, no filesystem, no logging of visitor text.
 */

export const PHONE = "715-396-1466";

export const TEXT_US = "Text us at 715-396-1466, or call the same number.";

export const PHONE_FALLBACK = `I don't have that on our website. ${TEXT_US}`;

export const SERVICE_TROUBLE =
  "Riverside Rental Help is having trouble right now. Text or call us at 715-396-1466.";

export const IDENTITY_SAFE = `I'm an automated assistant, not a person. ${TEXT_US}`;

export const DEPOSIT_SAFE =
  "A security deposit starts at $300 and is held separately on a credit or debit card (Visa, Mastercard, or Discover; no American Express). We'll confirm the exact amount when you book. " +
  TEXT_US;

export const ONEWAY_SAFE =
  "We don't offer one-way rentals. Pick up and return the vehicle in Black River Falls. " + TEXT_US;

export const CARRIER_SAFE =
  "We work with most major carriers. Insurance replacement rates are quoted by phone. " + TEXT_US;

export const BOOKING_SAFE =
  "I can't confirm a booking or whether a vehicle is free. " + TEXT_US;

export const SENSITIVE_SAFE =
  "Please don't send card numbers, license numbers, or Social Security numbers in chat. " + TEXT_US;

export const LIMITS = {
  messageChars: 500,
  historyTurns: 8,
  sessionPerDay: 20,
  ipPerWindow: 10,
  ipWindowMs: 10 * 60 * 1000,
  firstMessageDelayMs: 1000,
  maxLoadedAgeMs: 2 * 24 * 60 * 60 * 1000,
  maxBodyChars: 20000,
  maxKnowledgeChars: 480000,
  openaiTimeoutMs: 20000,
};

/** Dollars per 1M tokens. Unknown models use gpt-5-mini rates (the cap stays conservative). */
export const MODEL_PRICES = {
  "gpt-5-mini": { input: 0.25, cached: 0.025, output: 2 },
  "gpt-5-nano": { input: 0.05, cached: 0.005, output: 0.4 },
  "gpt-4o-mini": { input: 0.15, cached: 0.075, output: 0.6 },
};

const OUTPUT_TOKEN_ESTIMATE = 600;
const MICRO = 1_000_000;

const INSURERS = [
  "state farm",
  "geico",
  "progressive",
  "allstate",
  "farmers insurance",
  "american family",
  "amfam",
  "liberty mutual",
  "usaa",
  "travelers",
  "nationwide",
  "safeco",
  "the hartford",
  "hartford",
  "auto-owners",
  "auto owners",
  "acuity",
  "west bend",
  "country financial",
  "erie insurance",
];

const INJECTION = [
  /ignore (?:all |any |the )?(?:previous|prior|above) (?:instructions|rules|prompts)/i,
  /disregard (?:the |your )?(?:system |previous |rules)/i,
  /reveal (?:your |the )?(?:system )?(?:prompt|instructions)/i,
  /print (?:your |the )?(?:system |hidden )?(?:prompt|instructions)/i,
  /\byou are now\b/i,
  /\bjailbreak\b/i,
  /\bdeveloper mode\b/i,
  /act as (?:a |an )?(?:system|developer|dan)\b/i,
  /system prompt/i,
];

export function pricesFor(model) {
  return MODEL_PRICES[model] || MODEL_PRICES["gpt-5-mini"];
}

export function costMicro(model, usage) {
  const prices = pricesFor(model);
  const prompt = Math.max(0, Number(usage.promptTokens) || 0);
  const cached = Math.min(Math.max(0, Number(usage.cachedTokens) || 0), prompt);
  const fresh = prompt - cached;
  const completion = Math.max(0, Number(usage.completionTokens) || 0);
  const dollars =
    (fresh / 1e6) * prices.input +
    (cached / 1e6) * prices.cached +
    (completion / 1e6) * prices.output;
  return Math.max(0, Math.ceil(dollars * MICRO - 1e-6));
}

export function estimateCallMicro(model, promptChars) {
  const tokens = Math.ceil(Math.max(0, promptChars) / 4);
  return costMicro(model, {
    promptTokens: tokens,
    cachedTokens: 0,
    completionTokens: OUTPUT_TOKEN_ESTIMATE,
  });
}

export function spendCapMicro(env) {
  const raw = env && env.CHAT_DAILY_SPEND_CENTS;
  const cents = raw == null || String(raw).trim() === "" ? 500 : Number(raw);
  if (!Number.isFinite(cents) || cents < 0) return 500 * 10_000;
  return Math.round(cents * 10_000);
}

export function chatEnabled(env) {
  const flag = String((env && env.CHAT_ENABLED) || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function hasApiKey(env) {
  return Boolean(env && env.OPENAI_API_KEY && String(env.OPENAI_API_KEY).trim());
}

/** hidden: draw nothing. fallback: text us and the phone number. chat: model answers. */
export function resolveMode(env) {
  if (!chatEnabled(env)) return "hidden";
  if (!hasApiKey(env)) return "fallback";
  return "chat";
}

export function primaryModel(env) {
  const name = String((env && env.CHAT_MODEL) || "").trim();
  return name || "gpt-5-mini";
}

export function fallbackModel(env) {
  const name = String((env && env.CHAT_MODEL_FALLBACK) || "").trim();
  return name || "gpt-5-nano";
}

export function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function toCents(whole, frac) {
  const w = String(whole).replace(/,/g, "");
  if (!/^\d+$/.test(w)) return null;
  const dollars = Number(w);
  let c = 0;
  if (frac != null && frac !== "") {
    const f = (String(frac) + "00").slice(0, 2);
    if (!/^\d{2}$/.test(f)) return null;
    c = Number(f);
  }
  const total = dollars * 100 + c;
  if (!Number.isSafeInteger(total)) return null;
  return total;
}

export function dollarCents(text) {
  const set = new Set();
  const re = /\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
  let match;
  const source = String(text || "");
  while ((match = re.exec(source))) {
    const cents = toCents(match[1], match[2]);
    if (cents != null) set.add(cents);
  }
  return set;
}

function wordMoneyCents(text) {
  const set = new Set();
  const re = /\b(\d{1,5}(?:\.\d{1,2})?)\s+dollars?\b/gi;
  let match;
  while ((match = re.exec(String(text || "")))) {
    const [whole, frac] = match[1].split(".");
    const cents = toCents(whole, frac);
    if (cents != null) set.add(cents);
  }
  return set;
}

export function luhn(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let n = num.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0 && num.length >= 13;
}

export function stripSensitive(text) {
  let redacted = false;
  let out = String(text || "");
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
    redacted = true;
    return "[removed]";
  });
  out = out.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      redacted = true;
      return "[removed]";
    }
    return match;
  });
  return { text: out, redacted };
}

export function looksLikeInjection(text) {
  const value = String(text || "");
  return INJECTION.some((re) => re.test(value));
}

export function originAllowed(origin, env, requestHost) {
  if (!origin || typeof origin !== "string") return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.host.toLowerCase();
  if (host === "riversideautorental.com" || host === "www.riversideautorental.com") return true;
  if (requestHost && host === String(requestHost).toLowerCase()) return true;
  const context = String((env && env.CONTEXT) || "").toLowerCase();
  if (context === "production") return false;
  return host.endsWith(".netlify.app");
}

export function requestOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const referer = request.headers.get("referer");
  if (!referer) return "";
  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

export function requestHost(request) {
  try {
    return new URL(request.url).host;
  } catch {
    return "";
  }
}

export function clientIp(request) {
  const direct = request.headers.get("x-nf-client-connection-ip");
  if (direct && direct.trim()) return direct.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const cleaned = [];
  for (const item of history.slice(-20)) {
    if (!item || (item.role !== "user" && item.role !== "assistant")) continue;
    let content = String(item.content || "").slice(0, LIMITS.messageChars);
    content = stripSensitive(content).text.trim();
    if (!content) continue;
    cleaned.push({ role: item.role, content });
  }
  return cleaned.slice(-LIMITS.historyTurns);
}

function callsItselfAiOrPerson(text) {
  return (
    /\b(?:i(?:'m| am)|as) (?:an? )?(?:ai|a\.i\.|artificial intelligence)\b/i.test(text) ||
    /\bi(?:'m| am) (?:a )?(?:real )?(?:person|human)\b/i.test(text)
  );
}

function namesInsurer(text) {
  const lower = text.toLowerCase();
  return INSURERS.some((name) => lower.includes(name));
}

function offersOneWay(text) {
  const lower = text.toLowerCase();
  if (!/one[-\s]?way/.test(lower)) return false;
  if (/(do not|don't|does not|doesn't|no one[-\s]?way|not offer|aren't|are not|we don't|we do not|not available|can't|cannot)/.test(lower)) {
    return false;
  }
  return true;
}

function offersDiscount(text) {
  const lower = text.toLowerCase();
  if (!/(discount|coupon|promo code|%\s*off|percent off)/.test(lower)) return false;
  if (/(no discount|don't offer|do not offer|not offer|doesn't offer|aren't any|no coupon|no coupons|without a discount)/.test(lower)) {
    return false;
  }
  return true;
}

function badDepositClaim(text) {
  const lower = text.toLowerCase();
  if (lower.includes("refundable")) return true;
  if (/\b\d+\s*(?:to|–|-)\s*\d+\s*business days?\b/i.test(text) && /(deposit|hold)/i.test(text)) return true;
  if (/(deposit|hold)/i.test(text) && /(release|released|releases)/i.test(text)) return true;
  if (/not be immediately available/i.test(text)) return true;
  if (/release it on our end/i.test(text) || (/when the vehicle comes back/i.test(text) && /release/i.test(text))) return true;
  return false;
}

function confirmsBooking(text) {
  return /\b(you(?:'re| are) booked|reservation is confirmed|i(?:'ve| have) reserved|vehicle is reserved|car is reserved|we(?:'ve| have) held)\b/i.test(text);
}

const DIRECT_BILL_PROMISE =
  /\b(?:in most cases[,]?\s+)?(?:we(?:'ll| will)?\s+)?bill\s+(?:most major\s+)?carriers\s+directly\b/gi;

function softenDirectBilling(text) {
  DIRECT_BILL_PROMISE.lastIndex = 0;
  if (!DIRECT_BILL_PROMISE.test(text)) return null;
  DIRECT_BILL_PROMISE.lastIndex = 0;
  return text.replace(DIRECT_BILL_PROMISE, "We work directly with adjusters from most major carriers");
}

export function applyOutputGuards(reply, allowedCents) {
  const original = String(reply || "").trim();
  if (!original) return { text: PHONE_FALLBACK, reason: "empty" };
  if (callsItselfAiOrPerson(original)) return { text: IDENTITY_SAFE, reason: "identity" };
  const allowed = allowedCents instanceof Set ? allowedCents : new Set(allowedCents || []);
  const amounts = new Set([...dollarCents(original), ...wordMoneyCents(original)]);
  for (const cents of amounts) {
    if (!allowed.has(cents)) return { text: PHONE_FALLBACK, reason: "dollar", detail: String(cents) };
  }
  if (namesInsurer(original)) return { text: CARRIER_SAFE, reason: "insurer" };
  const billing = softenDirectBilling(original);
  if (billing) return { text: billing, reason: "billing" };
  if (badDepositClaim(original)) {
    if (allowed.has(30000)) return { text: DEPOSIT_SAFE, reason: "deposit" };
    return { text: PHONE_FALLBACK, reason: "deposit" };
  }
  if (offersOneWay(original)) return { text: ONEWAY_SAFE, reason: "oneway" };
  if (offersDiscount(original)) return { text: PHONE_FALLBACK, reason: "discount" };
  if (confirmsBooking(original)) return { text: BOOKING_SAFE, reason: "booking" };
  return { text: original, reason: null };
}

export function plain(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanPageUrl(value) {
  const text = plain(value).slice(0, 300);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const host = url.host.toLowerCase();
    const ok =
      host === "riversideautorental.com" ||
      host === "www.riversideautorental.com" ||
      host.endsWith(".netlify.app");
    if (!ok) return "";
    return url.toString().slice(0, 300);
  } catch {
    return "";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validSessionId(value) {
  return UUID.test(String(value || ""));
}
