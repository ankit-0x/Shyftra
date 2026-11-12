// client/src/hooks/useApiQuery.js
import { useEffect, useState } from "react";
import api from "../api/axios";

const EMPTY_LIST = [];

// Converts any Date values to "YYYY-MM-DD" strings before they hit
// JSON.stringify. Without this, `JSON.stringify({ date: new Date() })`
// produces an ISO timestamp ("2026-01-15T10:30:00.000Z") that backends
// typically don't expect — they want "2026-01-15".
//
// Uses local date parts (getFullYear / getMonth / getDate) instead of
// toISOString() so a midnight UTC date doesn't roll back a day in
// positive-offset timezones (e.g. IST).
function normalizeParams(params) {
  if (!params || typeof params !== "object") return params ?? {};
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      out[k] = `${y}-${m}-${d}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function useApiQuery(url, params, enabled = true, { expect = "array", refreshToken = 0 } = {}) {
  const empty = expect === "array" ? EMPTY_LIST : null;
  const normalizedParams = normalizeParams(params);
  const key = enabled ? JSON.stringify([url, normalizedParams]) : null;
  const [result, setResult] = useState({ key: null, data: empty, error: null });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const [requestUrl, requestParams] = JSON.parse(key);
    const wantArray = expect === "array";
    const fallback = wantArray ? EMPTY_LIST : null;

    api
      .get(requestUrl, { params: requestParams })
      .then((res) => {
        const valid = wantArray
          ? Array.isArray(res.data)
          : res.data && typeof res.data === "object";
        if (!valid) throw new Error("Unexpected response from the server");
        return res.data;
      })
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            key,
            data: fallback,
            error: err.response?.data?.error || err.message,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, expect, refreshToken]);

  const isCurrent = key !== null && result.key === key;
  return {
    data: isCurrent ? result.data : empty,
    error: isCurrent ? result.error : null,
    loading: key !== null && !isCurrent,
  };
}