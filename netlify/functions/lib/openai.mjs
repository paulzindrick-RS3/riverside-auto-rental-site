/**
 * OpenAI calls. The key is read by the caller from the environment and is
 * never written to a response or a log line.
 */

async function postJson(fetchImpl, url, apiKey, body) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { ok: response.ok, status: response.status, data };
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

async function completeOnce(fetchImpl, apiKey, model, messages, extra) {
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
  );
  if (!ok) {
    const error = new Error("openai_error");
    error.status = status;
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

export async function complete(fetchImpl, apiKey, model, messages) {
  try {
    const result = await completeOnce(fetchImpl, apiKey, model, messages, { reasoning_effort: "minimal" });
    if (!result.text) {
      const error = new Error("empty_completion");
      error.status = 502;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.status !== 400) throw error;
    const result = await completeOnce(fetchImpl, apiKey, model, messages, {});
    if (!result.text) {
      const empty = new Error("empty_completion");
      empty.status = 502;
      throw empty;
    }
    return result;
  }
}
