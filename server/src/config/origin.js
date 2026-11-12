// server/src/config/origin.js
export const ALLOWED_ORIGIN = (() => {
  try {
    return new URL(process.env.CLIENT_URL || "http://localhost:5173").origin;
  } catch {
    return "http://localhost:5173";
  }
})();