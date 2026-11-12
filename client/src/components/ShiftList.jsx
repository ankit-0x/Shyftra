// client/src/components/ShiftList.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import ShiftCard from "./ShiftCard";
import ShiftCardSkeleton from "./ShiftCardSkeleton";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { SearchX, AlertCircle, Loader2 } from "lucide-react";
import { useLiveTick } from "../hooks/useLiveTick";

// ✅ FIX: Server now paginates /nearby at 20/page (same as /open)
const PAGE_SIZE = 20;

function ShiftList({ location, filters, refreshKey = 0, showAll = false }) {
  const debouncedMinPay = useDebouncedValue(filters.minPay, 400);
  const debouncedSkill = useDebouncedValue(filters.skill, 400);
  const liveTick = useLiveTick("shifts:changed");

  const [shifts, setShifts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const hasLocation = !!(location?.lat && location?.lng);
  const canFetch = showAll || hasLocation;

  const buildParams = (p) => {
    // ✅ FIX: page included for BOTH endpoints
    const params = { page: p, _r: refreshKey };
    if (!showAll) {
      params.lat = location.lat;
      params.lng = location.lng;
      params.radius = filters.radius;
      if (debouncedSkill) params.skill = debouncedSkill;
      if (debouncedMinPay) params.minPay = Math.round(debouncedMinPay * 100);
      if (filters.date) params.date = filters.date;
    }
    return params;
  };

  useEffect(() => {
    if (!canFetch) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setShifts([]);
    setPage(1);
    setHasMore(false);

    api
      .get(showAll ? "/api/shifts/open" : "/api/shifts/nearby", {
        params: buildParams(1),
      })
      .then((r) => {
        if (cancelled) return;
        const data = Array.isArray(r.data) ? r.data : [];
        setShifts(data);
        setInitialLoaded(true);
        // ✅ FIX: same rule for both — 20 items = assume more exists
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.error || e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canFetch,
    showAll,
    refreshKey,
    liveTick,
    location?.lat,
    location?.lng,
    filters.radius,
    debouncedSkill,
    debouncedMinPay,
    filters.date,
  ]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const r = await api.get(
        showAll ? "/api/shifts/open" : "/api/shifts/nearby",
        { params: buildParams(nextPage) },
      );
      const data = Array.isArray(r.data) ? r.data : [];

      setShifts((prev) => [...prev, ...data]);
      setPage(nextPage);

      // ✅ FIX: same rule for both endpoints
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // ─── Render states ───────────────────────────────────
  if (!canFetch) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShiftCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (loading && !initialLoaded) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShiftCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error && shifts.length === 0) {
    return (
      <div className="bg-error/10 border border-error/20 p-8 rounded-3xl text-center max-w-xl mx-auto mt-8 flex flex-col items-center shadow-sm">
        <AlertCircle className="w-10 h-10 text-error mb-3" />
        <h3 className="text-lg font-extrabold text-error tracking-tight">
          Failed to load shifts
        </h3>
        <p className="text-sm font-medium text-error/80 mt-1.5">{error}</p>
      </div>
    );
  }

  if (initialLoaded && shifts.length === 0) {
    return (
      <div className="bg-base-100 rounded-3xl border border-base-200 p-10 sm:p-14 text-center flex flex-col items-center justify-center max-w-2xl mx-auto mt-6 sm:mt-10 shadow-sm">
        <div className="w-16 h-16 bg-base-200/50 rounded-2xl flex items-center justify-center mb-4">
          <SearchX className="w-8 h-8 text-base-content/30" />
        </div>
        <h3 className="text-xl font-extrabold text-base-content tracking-tight">
          No shifts found
        </h3>
        <p className="text-sm font-medium text-base-content/60 mt-2 max-w-sm leading-relaxed">
          We couldn't find any shifts matching your current filters. Try
          widening your search radius or clearing some criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 py-2">
        {shifts.map((shift) => (
          <div key={shift._id} className="h-full animate-fade-in">
            <ShiftCard shift={shift} />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 pt-2 pb-4">
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn btn-outline rounded-xl gap-2 min-w-40"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        ) : (
          shifts.length > 0 && (
            <p className="text-xs text-base-content/50 font-medium">
              {showAll
                ? `All ${shifts.length} open shift${shifts.length === 1 ? "" : "s"} shown`
                : `All ${shifts.length} nearby shift${shifts.length === 1 ? "" : "s"} shown`}
            </p>
          )
        )}
      </div>

      {error && shifts.length > 0 && (
        <div className="bg-error/10 border border-error/20 p-3 rounded-xl text-center text-sm text-error">
          {error}
        </div>
      )}
    </div>
  );
}

export default ShiftList;
