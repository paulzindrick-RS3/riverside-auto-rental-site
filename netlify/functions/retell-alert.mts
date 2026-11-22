// Retell post-call / post-chat webhook -> alert email to the Riverside team.
//
// Retell calls this after every phone call (call_analyzed) and website chat
// (chat_analyzed). We verify Retell's signature, then email a short summary
// through Resend. Everything else Retell sends is acknowledged and ignored.
//
// Environment variables (Netlify, scope must include Functions):
//   RETELL_API_KEY  - Retell API key with the webhook badge (secret)
//   RESEND_API_KEY  - Resend API key (secret)
//   ALERT_FROM      - e.g. "Riverside Rental Alerts <alerts@riversideautorental.com>"
//   ALERT_TO        - comma-separated To list
//   ALERT_CC        - comma-separated Cc list (optional)
import type { Config, Context } from "@netlify/functions";
import { createHmac, timingSafeEqual } from "node:crypto";

const HANDLED = new Set(["call_analyzed", "chat_analyzed"]);
const FIVE_MIN_MS = 5 * 60 * 1000;

function verifySignature(rawBody: string, header: string | null, apiKey: string): boolean {
  if (!header) return false;
  const m = /v=(\d+),d=(.*)/.exec(header);
  if (!m) return false;
  const [, ts, digest] = m;
  if (Math.abs(Date.now() - Number(ts)) > FIVE_MIN_MS) return false;
  const expected = createHmac("sha256", apiKey).update(rawBody + ts).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(digest, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function list(v: string | undefined): string[] {
  return (v || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prettyKey(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isYes(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  return /^(yes|true|urgent)$/i.test(String(v ?? "").trim());
}

function centralTime(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " CT";
}

function formatPhone(n?: string): string {
  const d = String(n || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : String(n || "");
}

function transcriptText(obj: any): string {
  // Calls carry `transcript` (string). Chats carry `messages` / `message_with_tool_calls`.
  if (typeof obj.transcript === "string" && obj.transcript.trim()) return obj.transcript.trim();
  const msgs = obj.messages || obj.message_with_tool_calls || [];
  if (Array.isArray(msgs)) {
    return msgs
      .filter((m: any) => typeof m?.content === "string" && (m.role === "agent" || m.role === "user"))
      .map((m: any) => `${m.role === "agent" ? "Assistant" : "Customer"}: ${m.content}`)
      .join("\n");
  }
  return "";
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const apiKey = Netlify.env.get("RETELL_API_KEY");
  const resendKey = Netlify.env.get("RESEND_API_KEY");
  if (!apiKey || !resendKey) {
    console.error("retell-alert: missing RETELL_API_KEY or RESEND_API_KEY");
    return new Response(null, { status: 500 });
  }

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-retell-signature"), apiKey)) {
    return new Response(null, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const event = payload?.event;
  if (!HANDLED.has(event)) return new Response(null, { status: 204 });

  const isChat = event === "chat_analyzed";
  const obj = (isChat ? payload.chat : payload.call) || {};
  const analysis = (isChat ? obj.chat_analysis : obj.call_analysis) || {};
  const data: Record<string, unknown> = analysis.custom_analysis_data || {};
  const summary: string =
    (isChat ? analysis.chat_summary : analysis.call_summary) || analysis.summary || "";

  const urgent = isYes(data.urgent) || /emergency/i.test(String(data.call_type ?? ""));
  const name = String(data.caller_name || data.name || "").trim();
  const callback = formatPhone(String(data.callback_number || "")) || (!isChat ? formatPhone(obj.from_number) : "");
  const source = isChat ? "Website chat" : "Phone call";
  const typeLabel = data.call_type ? prettyKey(String(data.call_type)) : "";
  const transcript = transcriptText(obj);
  const customerSaidNothing = !isChat && transcript && !/^User:/m.test(transcript);

  const subjectParts = [
    urgent ? "URGENT" : "",
    source,
    name || (callback ? callback : "Unknown"),
    typeLabel || (customerSaidNothing ? "Hang-up" : ""),
  ].filter(Boolean);
  const subject = `Riverside Rental - ${subjectParts.join(" - ")}`;

  const when = centralTime(obj.end_timestamp || obj.start_timestamp);
  const rows: [string, string][] = [];
  if (urgent) rows.push(["Priority", "URGENT - call back right away"]);
  rows.push(["Source", source]);
  if (when) rows.push(["When", when]);
  if (name) rows.push(["Name", name]);
  if (callback) rows.push(["Callback number", callback]);
  if (!isChat && obj.from_number) rows.push(["Caller ID", formatPhone(obj.from_number)]);
  for (const [k, v] of Object.entries(data)) {
    if (["caller_name", "name", "callback_number", "urgent"].includes(k)) continue;
    if (v === null || v === undefined || String(v).trim() === "") continue;
    rows.push([prettyKey(k), k === "call_type" ? prettyKey(String(v)) : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)]);
  }
  if (obj.disconnection_reason) rows.push(["How it ended", prettyKey(String(obj.disconnection_reason))]);

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#1d2433;line-height:1.45">
${urgent ? `<p style="background:#b42318;color:#fff;padding:10px 14px;border-radius:6px;font-weight:bold;margin:0 0 14px">URGENT - please call back right away</p>` : ""}
<h2 style="color:#304B78;margin:0 0 10px">${esc(source)}${name ? ` from ${esc(name)}` : ""}</h2>
${summary ? `<p style="margin:0 0 14px"><strong>Summary:</strong> ${esc(summary)}</p>` : ""}
<table cellpadding="6" style="border-collapse:collapse;font-size:15px">
${rows.map(([k, v]) => `<tr><td style="color:#5b6475;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="font-weight:bold">${esc(v)}</td></tr>`).join("\n")}
</table>
<p style="margin:18px 0 6px;color:#5b6475">Remember: the assistant never confirms a vehicle is available. Call the customer to confirm and book.</p>
${transcript ? `<details open style="margin-top:14px"><summary style="cursor:pointer;color:#304B78;font-weight:bold">Full ${isChat ? "chat" : "call"} transcript</summary><pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;background:#f4f6fa;padding:12px;border-radius:6px">${esc(transcript)}</pre></details>` : ""}
</body></html>`;

  const text = [
    urgent ? "URGENT - please call back right away\n" : "",
    `${source}${name ? ` from ${name}` : ""}`,
    summary ? `\nSummary: ${summary}\n` : "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "\nThe assistant never confirms a vehicle is available. Call the customer to confirm and book.",
    transcript ? `\n--- Transcript ---\n${transcript}` : "",
  ].join("\n");

  const to = list(Netlify.env.get("ALERT_TO"));
  const cc = list(Netlify.env.get("ALERT_CC"));
  const from = Netlify.env.get("ALERT_FROM") || "Riverside Rental Alerts <alerts@riversideautorental.com>";
  if (!to.length) {
    console.error("retell-alert: ALERT_TO is empty");
    return new Response(null, { status: 500 });
  }

  const id = obj.call_id || obj.chat_id || "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      // Retell retries on slow/failed responses; this stops duplicate emails for the same call or chat.
      ...(id ? { "Idempotency-Key": `retell-${event}-${id}` } : {}),
    },
    body: JSON.stringify({ from, to, cc: cc.length ? cc : undefined, subject, html, text }),
  });

  if (!res.ok) {
    console.error("retell-alert: Resend error", res.status, await res.text());
    return new Response(null, { status: 502 });
  }
  return new Response(null, { status: 204 });
};

export const config: Config = {
  path: "/api/retell-alert",
  method: "POST",
};
