// client/src/components/map/LocationMap.jsx
// The Leaflet part of LocationPicker. Loaded lazily so the form itself stays light.
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { pinIcon } from "./mapIcons";

const INDIA_CENTER = [20.5937, 78.9629];

// Moves the camera ONLY when `focusKey` changes (a search / "use my location" result),
// not after every drag, so the map never jumps under the user's finger.
function Recenter({ lat, lng, focusKey, centerHint }) {
  const map = useMap();
  const flownToHint = useRef(false);

  // Existing: fly to pin when focusKey bumps (search / use-my-location)
  useEffect(() => {
    if (focusKey > 0 && lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on focusKey only
  }, [focusKey]);

  // 👇 NAYA: centerHint late aaye (geolocation resolve hone par) → fly karo
  useEffect(() => {
    if (!flownToHint.current && centerHint && lat == null && lng == null) {
      map.setView([centerHint.lat, centerHint.lng], 12, { animate: true });
      flownToHint.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerHint?.lat, centerHint?.lng, lat, lng]);

  return null;
}

function ClickToPlace({ onMove }) {
  useMapEvents({ click: (e) => onMove(e.latlng.lat, e.latlng.lng) });
  return null;
}

function LocationMap({ lat, lng, focusKey, centerHint, interactive, onMove }) {
  const icon = useMemo(() => pinIcon({ kind: "employer" }), []);
  const hasPin = lat != null && lng != null;
  const center = hasPin ? [lat, lng] : centerHint ? [centerHint.lat, centerHint.lng] : INDIA_CENTER;
  const zoom = hasPin ? 16 : centerHint ? 12 : 5;

  const locationIqKey = import.meta.env.VITE_LOCATIONIQ_API_KEY;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-2xl z-0"
      aria-label="Map for choosing the work site"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://locationiq.com/">LocationIQ</a>'
        url={`https://{s}-tiles.locationiq.com/v3/streets/r/{z}/{x}/{y}.png?key=${locationIqKey}`}
        subdomains={['a', 'b', 'c']}
        maxZoom={18}
      />
      <Recenter lat={lat} lng={lng} focusKey={focusKey} centerHint={centerHint} />
      {interactive && <ClickToPlace onMove={onMove} />}
      {hasPin && (
        <Marker
          position={[lat, lng]}
          icon={icon}
          draggable={interactive}
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onMove(p.lat, p.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}

export default LocationMap;