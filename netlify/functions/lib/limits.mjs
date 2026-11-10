import { createHash } from "node:crypto";

export function hashKey(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

export function spendKey(day) {
  return `spend:${day}`;
}

export async function bumpWindow(store, key, windowMs, now) {
  const current = (await store.get(key)) || { count: 0, start: now };
  let count = Number(current.count) || 0;
  let start = Number(current.start) || now;
  if (now - start >= windowMs) {
    count = 0;
    start = now;
  }
  count += 1;
  await store.set(key, { count, start });
  return count;
}

export async function bumpCounter(store, key) {
  const count = (Number(await store.get(key)) || 0) + 1;
  await store.set(key, count);
  return count;
}

export async function getSpend(store, day) {
  return Number(await store.get(spendKey(day))) || 0;
}

export async function addSpend(store, day, micro) {
  const next = (await getSpend(store, day)) + Math.max(0, Number(micro) || 0);
  await store.set(spendKey(day), next);
  return next;
}
