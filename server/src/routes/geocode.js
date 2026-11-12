// server/src/routes/geocode.js
// Backend proxy for LocationIQ geocoding. The browser talks ONLY to
// these routes; LOCATIONIQ_API_KEY never leaves the server.
//
//   GET /api/geocode/autocomplete?q=...&lat=..&lng=..   suggestions while typing
//   GET /api/geocode/search?q=...                       address  -> lat/lng
//   GET /api/geocode/reverse?lat=..&lng=..              lat/lng  -> address
//
// Public on purpose: guests can fill in the Post Shift form before they sign up.
// Abuse is bounded by a per-IP limiter, a Redis cache and a daily upstream budget.
import express from "express";
import crypto from "crypto";
import { z } from "zod";
import redisClient from "../config/redis.js";
import { geocodeIpLimiter } from "../middleware/rateLimiters.js";
import { HttpError } from "../utils/HttpError.js";

import { logError } from "../utils/logger.js";
const router = express.Router();

const TIMEOUT_MS = 6000;
const CACHE_TTL_SECONDS = { autocomplete: 60 * 60, search: 24 * 60 * 60, reverse: 24 * 60 * 60 };

// LocationIQ Base URL (EU/US cluster)
const locationIqBase = () => (process.env.LOCATIONIQ_BASE_URL || "https://us1.locationiq.com/v1").replace(/\/$/, "");

// Default budget 4500 (leaving a 500 request buffer for the 5000/day free limit)
const dailyBudget = () => Number(process.env.LOCATIONIQ_DAILY_BUDGET) || 4500;

function geoError(status, code, message, extra = {}) {
  const e = new HttpError(status, message);
  e.code = code;
  Object.assign(e, extra);
  return e;
}

const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
const cleanText = (s) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

// ---------- validation ----------
const latField = z.coerce.number().min(-90).max(90);
const lngField = z.coerce.number().min(-180).max(180);

const textQuerySchema = z
  .object({
    q: z.string().min(3, { message: "Type at least 3 characters" }).max(120, { message: "Search text is too long" }),
    lat: latField.optional(),
    lng: lngField.optional(),
  })
  .refine((d) => (d.lat === undefined) === (d.lng === undefined), { message: "lat and lng must be sent together" });

const reverseQuerySchema = z.object({ lat: latField, lng: lngField });

// ---------- cache + budget (best effort: Redis trouble never breaks a search) ----------
const cacheKey = (kind, params) =>
  `geocode:v2:${kind}:${crypto.createHash("sha1").update(JSON.stringify(params)).digest("hex")}`;

async function cacheGet(key) {
  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, ttl, value) {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch {
    /* cache is optional */
  }
}

// Counts only real upstream calls (cache hits are free). Protects the LocationIQ free-tier quota.
async function takeBudget() {
  let used = 0;
  try {
    const key = `geocode:budget:${new Date().toISOString().slice(0, 10)}`;
    used = await redisClient.incr(key);
    if (used === 1) await redisClient.expire(key, 48 * 3600);
  } catch {
    return; // Redis down: fail open, LocationIQ will still rate-limit us itself
  }
  if (used > dailyBudget()) {
    throw geoError(429, "GEOCODE_BUDGET", "Address search is at capacity today. Drop the pin on the map instead.", { retryAfter: 3600 });
  }
}

// ---------- the one place that talks to LocationIQ ----------
async function locationIqGet(path, params) {
  const apiKey = process.env.LOCATIONIQ_API_KEY;
  if (!apiKey) throw geoError(503, "GEOCODE_NOT_CONFIGURED", "Address search is not available right now");
  await takeBudget();

  const url = new URL(`${locationIqBase()}${path}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("format", "json");
  
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (res.status === 404) {
      // LocationIQ returns 404 when no results are found. We treat it as an empty array.
      return []; 
    }
    if (res.status === 429) {
      const retryAfter = Math.min(Math.max(parseInt(res.headers.get("retry-after"), 10) || 30, 1), 300);
      throw geoError(429, "GEOCODE_UPSTREAM_BUSY", "Address search is busy. Try again shortly or drop the pin on the map.", { retryAfter });
    }
    if (!res.ok) {
      console.error(`LocationIQ ${path} failed with HTTP ${res.status}`);
      throw geoError(502, "GEOCODE_UNAVAILABLE", "Address search is unavailable. Drop the pin on the map instead.");
    }
    return await res.json();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === "AbortError") {
      throw geoError(504, "GEOCODE_TIMEOUT", "Address search timed out. Try again or drop the pin on the map.");
    }
    logError(`LocationIQ ${path} request failed:`, err);
    throw geoError(502, "GEOCODE_UNAVAILABLE", "Address search is unavailable. Drop the pin on the map instead.");
  } finally {
    clearTimeout(timer);
  }
}

// LocationIQ returns a flat JSON structure. The client gets the same minimal shape it expects.
function normalizeLocationIqResults(raw, kind) {
  if (!raw) return [];
  
  // Reverse geocode returns an object, Search/Autocomplete return arrays
  const items = Array.isArray(raw) ? raw : [raw];

  return items
    .map((item) => {
      let label = item.display_name || "";
      
      // Autocomplete sometimes provides better formatted fields
      if (kind === "autocomplete" && item.display_place && item.display_address) {
        label = `${item.display_place}, ${item.display_address}`;
      }

      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !label) return null;
      
      return {
        id: String(item.place_id || `${lat},${lng}`),
        label: label.slice(0, 300),
        lat: round(lat, 6),
        lng: round(lng, 6),
      };
    })
    .filter(Boolean);
}

function sendError(res, err) {
  if (err instanceof HttpError) {
    const body = { error: err.message, code: err.code ?? null };
    if (err.retryAfter != null) {
      body.retryAfter = err.retryAfter;
      res.set("Retry-After", String(err.retryAfter));
    }
    return res.status(err.status).json(body);
  }
  logError("geocode route failed:", err);
  return res.status(500).json({ error: "Address search failed", code: "SERVER" });
}

// kind: "autocomplete" | "search" — both take free text.
function textHandler(kind) {
  const lqPath = kind === "autocomplete" ? "/autocomplete" : "/search";
  
  return async (req, res) => {
    const parsed = textQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });

    const text = cleanText(parsed.data.q);
    if (text.length < 3) return res.status(400).json({ error: "Type at least 3 characters", code: "VALIDATION" });

    // Focus is rounded to ~1 km: better cache hits and we never forward a precise position.
    const hasFocus = kind === "autocomplete" && parsed.data.lat !== undefined;
    const focus = hasFocus ? { lat: round(parsed.data.lat, 2), lon: round(parsed.data.lng, 2) } : null;
    const params = { text: text.toLowerCase(), focus };
    const key = cacheKey(kind, params);

    try {
      const cached = await cacheGet(key);
      if (cached) return res.json({ results: cached });

      // LocationIQ parameters
      const apiParams = {
        q: text,
        limit: 5,
        "accept-language": "en", // Forces English results
      };

      // If focus is provided (for autocomplete), bias results towards that location
      if (focus) {
        apiParams.lat = focus.lat;
        apiParams.lon = focus.lon;
      }

      const raw = await locationIqGet(lqPath, apiParams);
      const results = normalizeLocationIqResults(raw, kind);
      
      await cacheSet(key, CACHE_TTL_SECONDS[kind], results);
      res.json({ results });
    } catch (err) {
      sendError(res, err);
    }
  };
}

router.get("/autocomplete", geocodeIpLimiter, textHandler("autocomplete"));
router.get("/search", geocodeIpLimiter, textHandler("search"));

router.get("/reverse", geocodeIpLimiter, async (req, res) => {
  const parsed = reverseQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });

  const lat = round(parsed.data.lat, 4); // ~11 m: plenty for an address, and cacheable
  const lng = round(parsed.data.lng, 4);
  const key = cacheKey("reverse", { lat, lng });

  try {
    const cached = await cacheGet(key);
    if (cached) return res.json({ results: cached });

    const raw = await locationIqGet("/reverse", {
      lat,
      lon: lng,
      "accept-language": "en",
    });
    
    const results = normalizeLocationIqResults(raw, "reverse");
    
    await cacheSet(key, CACHE_TTL_SECONDS.reverse, results);
    res.json({ results });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;