/**
 * OpenAI calls. The key is read by the caller from the environment and is
 * never written to a response or a log line.
 */

async function postJson(fetchImpl, url, apiKey, body, signal) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { ok: response.ok, status: response.status, data };
}

function errorDetail(status, data) {
  const err = data && data.error;
  const code = err && typeof err.code === "string" && /^[a-z0-9_]{1,40}$/i.test(err.code) ? err.code : "";
  const type = err && typeof err.type === "string" && /^[a-z0-9_]{1,40}$/i.test(err.type) ? err.type : "";
  const token = code || type;
  let limit = "";
  const message = err && typeof err.message === "string" ? err.message : "";
  const match = message.match(/Limit[:\s]*([0-9,]+).{0,40}Requested[:\s]*([0-9,]+)/i);
  if (match) limit = `:${match[1].replace(/,/g, "")}-${match[2].replace(/,/g, "")}`;
  if (!token && !limit) return String(status);
  return `${status}${token ? `:${token}` : ""}${limit}`.slice(0, 80);
}

export async function moderate(fetchImpl, apiKey, text) {
  try {
    const { ok, data } = await postJson(fetchImpl, "https://api.openai.com/v1/moderations", apiKey, {
      model: "omni-moderation-latest",
      input: text,
    });
    if (!ok) return false;
    return Boolean(data.results && data.results[0] && data.results[0].flagged);
  } catch {
    return false;
  }
}

async function completeOnce(fetchImpl, apiKey, model, messages, extra, signal) {
  const { ok, status, data } = await postJson(
    fetchImpl,
    "https://api.openai.com/v1/chat/completions",
    apiKey,
    {
      model,
      messages,
      max_completion_tokens: 1500,
      ...extra,
    },
    signal,
  );
  if (!ok) {
    const error = new Error("openai_error");
    error.status = status;
    error.detail = errorDetail(status, data);
    throw error;
  }
  const text = String((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
  const usage = data.usage || {};
  const details = usage.prompt_tokens_details || {};
  return {
    text,
    promptTokens: usage.prompt_tokens || 0,
    cachedTokens: details.cached_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
  };
}

export async function complete(fetchImpl, apiKey, model, messages, options = {}) {
  const signal = options && options.signal;
  try {
    const result = await completeOnce(fetchImpl, apiKey, model, messages, { reasoning_effort: "minimal" }, signal);
    if (!result.text) {
      const error = new Error("empty_completion");
      error.status = 502;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.status !== 400) throw error;
    const result = await completeOnce(fetchImpl, apiKey, model, messages, {}, signal);
    if (!result.text) {
      const empty = new Error("empty_completion");
      empty.status = 502;
      throw empty;
    }
    return result;
  }
}
