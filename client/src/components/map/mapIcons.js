// client/src/components/map/mapIcons.js
// Leaflet's stock marker images break under Vite's asset pipeline, so we draw pins
// with L.divIcon instead: plain HTML + Tailwind classes, themed by DaisyUI colours.
import L from "leaflet";

const WORKER_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
const SITE_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

// kind: "worker" | "employer".  approx: blurred position.  self: the viewer's own dot.
export function pinIcon({ kind, approx = false, self = false } = {}) {
  const colour = kind === "worker" ? "bg-primary text-primary-content" : "bg-secondary text-secondary-content";
  const ring = self ? "ring-4 ring-info/50" : approx ? "ring-4 ring-base-content/10 opacity-80" : "";
  const dashed = approx ? "border-dashed" : "border-solid";
  return L.divIcon({
    className: "shyftra-pin",
    html: `<div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${dashed} ${colour} ${ring}">${kind === "worker" ? WORKER_SVG : SITE_SVG}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}