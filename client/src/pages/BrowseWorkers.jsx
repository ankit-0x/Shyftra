// client/src/pages/BrowseWorkers.jsx   (route: /browse-workers)
// Employer-only: browse and filter available workers.
import { useState } from "react";
import { Navigate } from "react-router";
import { useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { useGeolocation } from "../hooks/useGeolocation";
import FilterBar from "../components/FilterBar";
import WorkerList from "../components/WorkerList";

function BrowseWorkers() {
  const { user } = useSelector((state) => state.auth);
  const { location, permissionDenied } = useGeolocation();
  const [filters, setFilters] = useState({
    skill: "",
    minPay: "",
    radius: "10",
    date: "",
  });
  const [refreshKey, setRefreshKey] = useState(0);

    // Guests (user === null) are allowed to browse.
  // Only authenticated non-employer users get redirected.
  if (user && user.role !== "employer") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Helmet>
        <title>Browse workers — Shyftra</title>
        <meta
          name="description"
          content="Find verified hourly workers near you by skill, pay and distance."
        />
      </Helmet>

      <div className="p-6 text-center">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight">
          Browse <span className="text-primary">workers</span>
        </h1>
        <p className="mt-2 text-muted">
          Filter verified workers by skill, pay range and distance.
        </p>
        {permissionDenied && (
          <p className="text-xs text-muted mt-1">
            (Location access denied — showing results for a default city)
          </p>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-10">
        <FilterBar
          filters={filters}
          onChange={(field, value) =>
            setFilters((prev) => ({ ...prev, [field]: value }))
          }
          mode="workers"
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
        <WorkerList
          location={location}
          filters={filters}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
}

export default BrowseWorkers;