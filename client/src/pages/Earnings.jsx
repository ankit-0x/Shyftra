// client/src/pages/Earnings.jsx
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  fetchEarningsSummary,
  fetchEarningsStats,
  fetchShiftHistory,
  fetchCompensationHistory,
} from "../store/earningsSlice";
import WalletCard from "../components/WalletCard";
import VerificationBanner from "../components/VerificationBanner";
import {
  IndianRupee,
  Briefcase,
  Clock,
  Building2,
  Award,
  AlertCircle,
  Loader2,
  BarChart3,
  History,
  Gift,
} from "lucide-react";

const formatINR = (n) =>
  Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const formatAxis = (v) => {
  const n = Number(v) || 0;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
};

const dayKeyIST = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const COMP_LABELS = {
  cancellation_penalty: "Late-cancel compensation",
  dispute_payout: "Dispute payout",
};

function EarningsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 sm:p-3 text-xs">
      <p className="font-bold text-gray-900 text-[11px] sm:text-xs">
        {d.date.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
        {d.isToday && (
          <span className="ml-1.5 text-[9px] font-bold text-[#fc8d62] bg-[#fc8d62]/10 px-1.5 py-0.5 rounded">
            TODAY
          </span>
        )}
      </p>
      <p className="text-[#fc8d62] font-bold mt-1 text-xs sm:text-sm">
        ₹{formatINR(d.earned)}
      </p>
      <p className="text-gray-500 mt-0.5 text-[10px] sm:text-xs">
        {d.shifts} shift{d.shifts === 1 ? "" : "s"} completed
      </p>
    </div>
  );
}

function Earnings() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [range, setRange] = useState(30);

  const { summary, stats, history, compensations, status, error } = useSelector(
    (state) => state.earnings,
  );

  useEffect(() => {
    dispatch(fetchEarningsSummary());
    dispatch(fetchEarningsStats("daily"));
    dispatch(fetchShiftHistory());
    dispatch(fetchCompensationHistory());
  }, [dispatch]);

  const chartData = useMemo(() => {
    const byDay = new Map();
    (Array.isArray(stats) ? stats : []).forEach((s) => {
      if (!s?.period) return;
      const key = dayKeyIST(new Date(s.period));
      byDay.set(key, {
        earned: Math.round(s.totalEarned || 0),
        shifts: s.shiftsCompleted || 0,
      });
    });

    const now = new Date();
    const out = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = dayKeyIST(d);
      const hit = byDay.get(key);
      out.push({
        key,
        date: d,
        label: d.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        }),
        earned: hit?.earned || 0,
        shifts: hit?.shifts || 0,
        isToday: i === 0,
      });
    }
    return out;
  }, [stats, range]);

  const chartStats = useMemo(() => {
    const total = chartData.reduce((s, d) => s + d.earned, 0);
    const activeDays = chartData.filter((d) => d.earned > 0).length;
    const avgPerActiveDay = activeDays > 0 ? total / activeDays : 0;
    const best = chartData.reduce(
      (m, d) => (d.earned > m.earned ? d : m),
      { earned: 0, label: "—" },
    );
    return { total, activeDays, avgPerActiveDay, best };
  }, [chartData]);

  if (user?.role !== "worker") {
    return (
      <div className="min-h-screen bg-base-200/50 p-6 flex flex-col items-center justify-center text-center">
        <Briefcase className="w-16 h-16 text-base-content/20 mb-4" />
        <p className="opacity-70 text-lg">
          This page is only available for worker accounts.
        </p>
      </div>
    );
  }

  const isLoading =
    status?.summary === "loading" ||
    status?.stats === "loading" ||
    status?.history === "loading" ||
    status?.compensations === "loading";

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-base-content/70">Crunching your earnings data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center items-center p-6 text-center">
        <div className="bg-error/10 border border-error/20 p-6 rounded-2xl max-w-md">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-3" />
          <h2 className="text-lg font-bold text-error mb-2">
            Failed to load data
          </h2>
          <p className="text-sm text-error/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200/50 px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-base-content">
            Earnings Overview
          </h1>
          <p className="text-sm sm:text-base text-base-content/70 mt-0.5 sm:mt-1">
            Track your shifts, payouts, and bonuses.
          </p>
        </div>

        <VerificationBanner />

        {/* ═══════ Top Grid ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6">
          {/* Left Column: Wallet + Stats (fills chart's height) */}
          <div className="lg:col-span-4 flex flex-col gap-3 sm:gap-4">
            <WalletCard />

            {/* Stats: grid-cols-2 on mobile, vertical stack (flex-1) on desktop */}
            <div className="grid grid-cols-2 lg:flex lg:flex-col gap-2.5 sm:gap-3 lg:gap-4 lg:flex-1">
              {/* Total Earned */}
              <div className="card bg-base-100 shadow-sm border border-base-200 p-3 sm:p-4 flex flex-col justify-between min-w-0 lg:flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] sm:text-xs font-bold text-base-content/50 uppercase tracking-wider truncate">
                    Total Earned
                  </p>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <IndianRupee className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-success" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-success truncate mt-2">
                  {formatINR(summary?.totalEarnings)}
                </div>
                <p className="text-[10px] sm:text-xs text-base-content/40 mt-1 truncate">
                  lifetime earnings
                </p>
              </div>

              {/* Shifts */}
              <div className="card bg-base-100 shadow-sm border border-base-200 p-3 sm:p-4 flex flex-col justify-between min-w-0 lg:flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] sm:text-xs font-bold text-base-content/50 uppercase tracking-wider truncate">
                    Shifts
                  </p>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Briefcase className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-base-content truncate mt-2">
                  {summary?.totalShifts || 0}
                </div>
                <p className="text-[10px] sm:text-xs text-base-content/40 mt-1 truncate">
                  shifts completed
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Chart */}
          <div className="lg:col-span-8 card bg-base-100 shadow-sm border border-base-200 p-3 sm:p-4 md:p-5 min-w-0">
            {/* Header with range selector */}
            <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3 md:mb-4 border-b border-base-200 pb-2 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                <h2 className="font-bold text-sm sm:text-base md:text-lg truncate">
                  Daily Earnings
                </h2>
              </div>
              <div className="flex bg-base-200/60 rounded-lg p-0.5 shrink-0">
                {[7, 30].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-colors ${
                      range === r
                        ? "bg-base-100 text-base-content shadow-sm"
                        : "text-base-content/60 hover:text-base-content"
                    }`}
                  >
                    {r}D
                  </button>
                ))}
              </div>
            </div>

            {chartStats.total === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 sm:h-64 md:h-80 text-base-content/40">
                <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 mb-2 opacity-20" />
                <p className="text-xs sm:text-sm">
                  No earnings in the last {range} days.
                </p>
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2 sm:mb-3 md:mb-4">
                  <div className="bg-base-200/40 rounded-lg p-2 sm:p-2.5 border border-base-200 min-w-0">
                    <p className="text-[9px] sm:text-[10px] font-bold text-base-content/50 uppercase tracking-wider truncate">
                      Total
                    </p>
                    <p className="text-[11px] sm:text-sm font-bold text-base-content mt-0.5 truncate">
                      ₹{formatINR(chartStats.total)}
                    </p>
                  </div>
                  <div className="bg-base-200/40 rounded-lg p-2 sm:p-2.5 border border-base-200 min-w-0">
                    <p className="text-[9px] sm:text-[10px] font-bold text-base-content/50 uppercase tracking-wider truncate">
                      Avg/Day
                    </p>
                    <p className="text-[11px] sm:text-sm font-bold text-base-content mt-0.5 truncate">
                      ₹{formatINR(chartStats.avgPerActiveDay)}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-base-content/40 truncate">
                      {chartStats.activeDays} active
                    </p>
                  </div>
                  <div className="bg-base-200/40 rounded-lg p-2 sm:p-2.5 border border-base-200 min-w-0">
                    <p className="text-[9px] sm:text-[10px] font-bold text-base-content/50 uppercase tracking-wider truncate">
                      Best Day
                    </p>
                    <p className="text-[11px] sm:text-sm font-bold text-success mt-0.5 truncate">
                      ₹{formatINR(chartStats.best.earned)}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-base-content/40 truncate">
                      {chartStats.best.label}
                    </p>
                  </div>
                </div>

                {/* Chart */}
                <div className="h-56 sm:h-64 md:h-80 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 5, right: 2, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(0,0,0,0.06)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        dy={6}
                        interval={range === 7 ? 0 : 4}
                        minTickGap={20}
                      />
                      <YAxis
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={45}
                        tickFormatter={formatAxis}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(0,0,0,0.04)" }}
                        content={<EarningsTooltip />}
                      />
                      <Bar dataKey="earned" radius={[3, 3, 0, 0]} maxBarSize={40}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={entry.isToday ? "#fc8d62" : "#fc8d6280"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══════ Bottom Grid ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
          {/* Shift History */}
          <div className="card bg-base-100 shadow-sm border border-base-200 p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-base-200">
              <History className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <h2 className="font-bold text-sm sm:text-base md:text-lg truncate">
                Shift History
              </h2>
            </div>

            {!history || history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 sm:py-10 text-base-content/40">
                <History className="w-8 h-8 sm:w-10 sm:h-10 mb-2 opacity-20" />
                <p className="text-xs sm:text-sm">No completed shifts yet.</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto pr-1">
                {history.map((record) => (
                  <div
                    key={record._id}
                    className="flex justify-between items-center gap-2 p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-base-200/40 border border-base-200 hover:border-primary/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm sm:text-base text-base-content truncate">
                        {record.shift?.title || "Unknown Shift"}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-base-content/60 mt-0.5 sm:mt-1">
                        <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                        <span className="truncate">
                          {record.shift?.employer?.businessName}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-success text-xs sm:text-sm flex items-center justify-end gap-0.5">
                        <IndianRupee className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        {formatINR(record.amountEarned)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-base-content/60 flex items-center justify-end gap-1 mt-0.5 sm:mt-1">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {record.hoursWorked} hrs
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compensations */}
          <div className="card bg-base-100 shadow-sm border border-base-200 p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-base-200">
              <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <h2 className="font-bold text-sm sm:text-base md:text-lg truncate">
                Compensations & Bonuses
              </h2>
            </div>

            {!compensations || compensations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 sm:py-10 text-base-content/40">
                <Award className="w-8 h-8 sm:w-10 sm:h-10 mb-2 opacity-20" />
                <p className="text-xs sm:text-sm">
                  No compensations or bonuses yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto pr-1">
                {compensations.map((c) => {
                  const label =
                    COMP_LABELS[c.type] || c.type.replaceAll("_", " ");
                  return (
                    <div
                      key={c._id}
                      className="flex justify-between items-center gap-2 p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-base-200/40 border border-base-200 hover:border-primary/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm sm:text-base text-base-content capitalize truncate">
                          {label}
                        </p>
                        <p className="text-[10px] sm:text-xs text-base-content/60 mt-0.5 sm:mt-1 truncate">
                          {c.shift?.title
                            ? `Ref: ${c.shift.title}`
                            : "System standard payout"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-success text-xs sm:text-sm flex items-center justify-end gap-0.5">
                          +<IndianRupee className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {formatINR(c.amount)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-base-content/60 mt-0.5 sm:mt-1">
                          {new Date(c.createdAt).toLocaleDateString(undefined, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Earnings;