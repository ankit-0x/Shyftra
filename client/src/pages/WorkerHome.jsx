// client/src/pages/WorkerHome.jsx   (route: /worker)
// Public shift browser. Guests and workers both see this.
import { useState } from "react";
import { Navigate } from "react-router";
import { useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { useGeolocation } from "../hooks/useGeolocation";
import FilterBar from "../components/FilterBar";
import ShiftList from "../components/ShiftList";

function WorkerHome() {
  const { user } = useSelector((state) => state.auth);
  const { location, permissionDenied } = useGeolocation();
  const [filters, setFilters] = useState({ skill: "", minPay: "", radius: "10", date: "" });
  const [refreshKey, setRefreshKey] = useState(0); // ✅ new
  const [showAll, setShowAll] = useState(false); // uses GET /api/shifts/open

  // Employers/admins poking at /worker get sent to their dashboard.
  if (user && user.role !== "worker") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Helmet>
        <title>Find hourly work near you — Shyftra</title>
        <meta
          name="description"
          content="Browse open hourly shifts near you. No signup needed to look around."
        />
      </Helmet>

      <div className="p-6 text-center">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight">
          Find <span className="text-primary">hourly work</span>
        </h1>
        <p className="mt-2 text-muted">Browse shifts near you.</p>
        {permissionDenied && (
          <p className="text-xs text-muted mt-1">
            (Location access denied — showing results for a default city)
          </p>
        )}
        {permissionDenied && (
          <button type="button" className="btn btn-xs btn-outline rounded-full mt-2" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show shifts near the default city" : "Show all open shifts instead"}
          </button>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-10">
        <FilterBar
          filters={filters}
          onChange={(f, v) => setFilters((p) => ({ ...p, [f]: v }))}
          mode="shifts"
          onRefresh={() => setRefreshKey((k) => k + 1)} // ✅ new
        />
        <ShiftList
          location={location}
          filters={filters}
          refreshKey={refreshKey} // ✅ new
          showAll={showAll}
        />
      </div>
    </div>
  );
}

export default WorkerHome;