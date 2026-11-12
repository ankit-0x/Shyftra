// client/src/api/geocodeApi.js
// Thin wrapper around OUR backend proxy (/api/geocode/*). The browser never talks to
// OpenRouteService directly, so the ORS key never reaches the client.
import axios from "axios";
import api from "./axios";

// Small in-memory cache so typing "andheri", deleting a letter and retyping it is free.
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 100;
const cache = new Map();

function recall(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function remember(key, value) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value); // drop the oldest
  cache.set(key, { value, at: Date.now() });
}

// Normalises every failure to an Error with { canceled, code, status, retryAfter }.
function toError(err) {
  if (axios.isCancel(err)) {
    const e = new Error("canceled");
    e.canceled = true;
    return e;
  }
  const d = err.response?.data;
  const e = new Error(d?.error || "Address search failed");
  e.status = err.response?.status ?? null;
  e.code = d?.code ?? (err.response ? null : "NETWORK");
  e.retryAfter = Number(d?.retryAfter ?? err.response?.headers?.["retry-after"]) || null;
  e.busy = e.status === 429;
  return e;
}

async function get(path, params, signal) {
  try {
    const res = await api.get(path, { params, signal });
    return res.data.results ?? [];
  } catch (err) {
    throw toError(err);
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

export async function autocomplete(q, { focus, signal } = {}) {
  const text = q.trim();
  const params = { q: text };
  if (focus) {
    params.lat = round2(focus.lat);
    params.lng = round2(focus.lng);
  }
  const key = `ac:${text.toLowerCase()}|${params.lat ?? ""},${params.lng ?? ""}`;
  const cached = recall(key);
  if (cached) return cached;
  const results = await get("/api/geocode/autocomplete", params, signal);
  remember(key, results);
  return results;
}

export async function searchAddress(q, { signal } = {}) {
  const text = q.trim();
  const key = `s:${text.toLowerCase()}`;
  const cached = recall(key);
  if (cached) return cached;
  const results = await get("/api/geocode/search", { q: text }, signal);
  remember(key, results);
  return results;
}

export async function reverseGeocode(lat, lng, { signal } = {}) {
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = recall(key);
  if (cached) return cached;
  const results = await get("/api/geocode/reverse", { lat, lng }, signal);
  remember(key, results);
  return results;
}