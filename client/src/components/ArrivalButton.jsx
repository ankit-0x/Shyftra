// client/src/components/ArrivalButton.jsx
import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { markArrived } from "../store/applicationsSlice";

function ArrivalButton({ app }) {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);

  if (app.arrivedAt) {
    return (
      <div className="inline-flex items-center gap-2 bg-success/10 border border-success/20 px-3 py-2 rounded-xl text-success text-xs font-semibold">
        <CheckCircle2 className="w-4 h-4 shrink-0" /> 
        <span>Arrived at {new Date(app.arrivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    );
  }

  function handleClick() {
    if (!navigator.geolocation) return toast.error("Your browser can't share location");
    setBusy(true);

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        navigator.geolocation.clearWatch(watchId);
        await dispatch(
          markArrived({
            shiftId: app.shift._id,
            applicationId: app._id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        );
        setBusy(false);
      },
      (err) => {
        navigator.geolocation.clearWatch(watchId);
        setBusy(false);
        console.log(err);
        toast.error(err.code === 1 ? "Allow location access to confirm you've arrived" : "Couldn't get your location — try again");
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 60000 },
    );
  }

  return (
    <button 
      type="button" 
      className="btn btn-sm btn-outline btn-secondary rounded-xl gap-2 shadow-sm hover:shadow" 
      onClick={handleClick} 
      disabled={busy}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
      I've arrived
    </button>
  );
}

export default ArrivalButton;