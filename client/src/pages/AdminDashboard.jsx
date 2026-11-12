// client/src/pages/AdminDashboard.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  fetchPendingUsers,
  fetchAllUsers,
  fetchVerificationDocUrl,
  decideVerification,
  toggleBlockUser,
  unbanUser,
  resetStrikes,
  fetchAllShifts,
  fetchAnalytics,
  cancelAdminShift,
  deleteAdminShift,
  fetchFullUserProfile,
  fetchPlatformWallet,
  handleWalletAction,
} from "../store/adminSlice";
import DisputesPanel from "../components/admin/DisputesPanel";
import LedgerPanel from "../components/admin/LedgerPanel";
import ConfirmActionModal from "../components/admin/ConfirmActionModal";
import ForceLogoutModal from "../components/admin/ForceLogoutModal";
import { useLiveTick } from "../hooks/useLiveTick";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import AdminSearchBar from "../components/admin/AdminSearchBar";

// --- ICONS ---
import {
  ShieldAlert,
  User,
  FileText,
  Check,
  X,
  Unlock,
  Ban,
  RefreshCw,
  Trash2,
  XCircle,
  IndianRupee,
  TrendingUp,
  ChevronRight,
  Loader2,
  UserCheck,
  Users,
  Briefcase,
  BarChart3,
  AlertCircle,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Mail,
  Phone,
  LogOut,
  Eye,
} from "lucide-react";

// --- WALLET ACTION MODAL ---
function WalletActionModal({ user, onClose }) {
  const dispatch = useDispatch();
  const [action, setAction] = useState("forfeit");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await dispatch(
        handleWalletAction({ userId: user._id, action, password, reason }),
      ).unwrap();
      onClose();
    } catch (err) {
      setError(err.message);
      if (err.code === "WRONG_PASSWORD") setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle z-200">
      <div
        className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <form
        onSubmit={submit}
        className="modal-box sm:max-w-md bg-base-100 p-6 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative"
      >
        <h3 className="font-extrabold text-lg mb-1">Resolve Wallet Balance</h3>
        <p className="text-sm text-base-content/70 mb-4">
          This user has{" "}
          <strong className="text-base-content">
            ₹{user.walletBalance.toFixed(2)}
          </strong>{" "}
          locked.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1 block">
              Action
            </label>
            <select
              className="select select-bordered w-full bg-base-100"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="forfeit">
                Forfeit to Platform (Policy violation)
              </option>
              <option value="refunded_offline">
                Mark as Refunded (Manual payout done)
              </option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1 block">
              Admin Password
            </label>
            <input
              type="password"
              placeholder="Confirm with your password"
              className={`input input-bordered w-full bg-base-100 ${error ? "input-error" : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1 block">
              Reason (Audit Log)
            </label>
            <input
              type="text"
              placeholder="e.g. Fraud confirmed via investigation"
              className="input input-bordered w-full bg-base-100"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={5}
            />
          </div>

          {error && (
            <p className="text-error text-xs font-medium bg-error/10 p-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        <div className="modal-action pt-4 mt-6 border-t border-base-200 flex gap-2">
          <button
            type="button"
            className="btn btn-ghost flex-1 rounded-xl"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-error flex-1 rounded-xl font-bold"
            disabled={busy || !password || reason.length < 5}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
}

// --- REUSABLE PROFILE MODAL WITH TRUST SCORECARD ---
function UserProfileModal({ userId, onClose }) {
  const dispatch = useDispatch();
  const { isActionLoading } = useSelector((state) => state.admin);

  const [reloadCount, setReloadCount] = useState(0);
  const [loaded, setLoaded] = useState({ key: null, data: null });
  const [confirmAction, setConfirmAction] = useState(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const wantedKey = userId ? `${userId}:${reloadCount}` : null;
  const loading = wantedKey !== null && loaded.key !== wantedKey;
  const data = loaded.key === wantedKey ? loaded.data : null;

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const key = `${userId}:${reloadCount}`;
    dispatch(fetchFullUserProfile(userId)).then((res) => {
      if (!cancelled) setLoaded({ key, data: res.payload || null });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadCount, dispatch]);

  async function handleViewDoc() {
    const result = await dispatch(fetchVerificationDocUrl(userId));
    if (result.payload) window.open(result.payload, "_blank", "noopener,noreferrer");
  }

  const handleAction = async (actionFunction) => {
    await dispatch(actionFunction);
    setReloadCount((n) => n + 1);
  };

  function askConfirm(config) {
    setConfirmAction(config);
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    await confirmAction.run();
    setConfirmAction(null);
  }

  if (!userId) return null;

  return (
    <dialog
      id="user_profile_modal"
      className="modal modal-open modal-bottom sm:modal-middle"
    >
      <div className="modal-box sm:max-w-2xl bg-base-100 p-0 overflow-hidden">
        {/* Header Strip */}
        <div className="bg-base-200/50 px-6 py-4 flex justify-between items-center border-b border-base-200">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Profile Details
          </h3>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            ✕
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
              <p className="text-sm text-base-content/60">
                Fetching full profile...
              </p>
            </div>
          ) : data?.user ? (
            <div className="space-y-6 animate-fade-in">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="avatar">
                  <div className="w-24 h-24 rounded-full bg-base-200 border-4 border-base-100 shadow-sm flex items-center justify-center">
                    {data.user.avatarUrl ? (
                      <img
                        src={data.user.avatarUrl}
                        alt="Avatar"
                        className="object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-base-content/20" />
                    )}
                  </div>
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h3 className="font-bold text-2xl text-base-content">
                    {data.user.role === "employer"
                      ? data.user.businessName || data.user.name
                      : data.user.name}
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2 text-sm text-base-content/70 justify-center sm:justify-start">
                    <span className="flex items-center gap-1.5 justify-center">
                      <Mail className="w-4 h-4" /> {data.user.email}
                    </span>
                    <span className="flex items-center gap-1.5 justify-center">
                      <Phone className="w-4 h-4" /> {data.user.phone}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                    <span
                      className={`badge font-medium capitalize ${data.user.role === "employer" ? "badge-secondary" : "badge-primary"}`}
                    >
                      {data.user.role}
                    </span>
                    {data.user.isActive === false && (
                      <span className="badge badge-error gap-1 font-medium text-white">
                        <Ban className="w-3 h-3" /> Blocked
                      </span>
                    )}
                    <span
                      className={`badge font-medium gap-1 ${data.user.verificationStatus === "verified" ? "badge-success text-white" : data.user.verificationStatus === "rejected" ? "badge-error text-white" : "badge-warning"}`}
                    >
                      {data.user.verificationStatus === "verified" && (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {data.user.verificationStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Scorecard */}
              <div className="bg-base-200/50 rounded-xl p-5 border border-base-200">
                <h4 className="font-bold mb-4 text-xs text-base-content/50 uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Platform Stats & Reliability
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(data.stats || {}).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-base-100 p-4 rounded-lg shadow-sm border border-base-200 text-center"
                    >
                      <p className="text-2xl font-bold text-primary mb-1">
                        {value}
                      </p>
                      <p className="text-xs text-base-content/60 font-medium capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2">
                <h4 className="font-bold mb-3 text-xs text-base-content/50 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Admin Actions
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.user.verificationStatus === "pending" && (
                    <>
                      <button
                        className="btn btn-outline btn-sm gap-2"
                        onClick={handleViewDoc}
                      >
                        <FileText className="w-4 h-4" /> View Document
                      </button>
                      <button
                        className="btn btn-success btn-sm text-white gap-2"
                        disabled={isActionLoading}
                        onClick={() =>
                          handleAction(
                            decideVerification({
                              userId,
                              decision: "verified",
                            }),
                          )
                        }
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}{" "}
                        Verify
                      </button>
                      <button
                        className="btn btn-error btn-sm text-white gap-2"
                        disabled={isActionLoading}
                        onClick={() =>
                          handleAction(
                            decideVerification({
                              userId,
                              decision: "rejected",
                            }),
                          )
                        }
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}{" "}
                        Reject
                      </button>
                    </>
                  )}

                  {/* ========================================================= */}
                  {/* ✅ 1. BLOCK / UNBLOCK BUTTON (Handles isActive) */}
                  {/* ========================================================= */}
                  <button
                    className={`btn btn-sm gap-2 ${data.user.isActive === false ? "btn-warning" : "btn-outline btn-error"}`}
                    disabled={isActionLoading}
                    onClick={() => handleAction(toggleBlockUser(userId))}
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : data.user.isActive === false ? (
                      <>
                        <Unlock className="w-4 h-4" /> Unblock User
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4" /> Block User
                      </>
                    )}
                  </button>

                  {/* ========================================================= */}
                  {/* ✅ 2. UNBAN BUTTON (Only if Banned but NOT blocked) */}
                  {/* ========================================================= */}
                  {data.user.isBanned && data.user.isActive !== false && (
                    <button
                      className="btn btn-success btn-sm text-white gap-2"
                      disabled={isActionLoading}
                      onClick={() =>
                        askConfirm({
                          title: "Unban this user?",
                          body: `This will clear their ban and reset their strikes to 0. They'll be able to log in again.`,
                          confirmLabel: "Unban & Reset",
                          variant: "success",
                          run: () => handleAction(unbanUser(userId)),
                        })
                      }
                    >
                      {isActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                      Unban & Reset ({data.user.strikes ?? 0})
                    </button>
                  )}

                  {/* ========================================================= */}
                  {/* ✅ 3. RESET STRIKES BUTTON (Only if NOT banned, but has strikes) */}
                  {/* ========================================================= */}
                  {!data.user.isBanned && (data.user.strikes ?? 0) > 0 && (
                    <button
                      className="btn btn-warning btn-sm gap-2"
                      disabled={isActionLoading}
                      onClick={() =>
                        askConfirm({
                          title: "Reset strikes?",
                          body: `This will reset strikes from ${data.user.strikes} to 0.`,
                          confirmLabel: "Reset Strikes",
                          variant: "warning",
                          run: () => handleAction(resetStrikes(userId)),
                        })
                      }
                    >
                      {isActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Reset Strikes ({data.user.strikes ?? 0})
                    </button>
                  )}

                  {/* ✅ 4. RESOLVE BALANCE BUTTON (If blocked/banned and has money) */}
                  {(data.user.isBanned || data.user.isActive === false) &&
                    data.user.walletBalance > 0 && (
                      <button
                        className="btn btn-error btn-sm text-white gap-2"
                        disabled={isActionLoading}
                        onClick={() => setWalletModalOpen(true)}
                      >
                        <Wallet className="w-4 h-4" />
                        Resolve Balance (₹{data.user.walletBalance.toFixed(2)})
                      </button>
                    )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 flex flex-col items-center">
              <AlertCircle className="w-12 h-12 text-error/30 mb-3" />
              <p className="text-base-content/70">
                User not found or error loading profile.
              </p>
            </div>
          )}
        </div>
      </div>
      <form
        method="dialog"
        className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <button>close</button>
      </form>

      <ConfirmActionModal
        open={!!confirmAction}
        title={confirmAction?.title}
        body={confirmAction?.body}
        confirmLabel={confirmAction?.confirmLabel}
        variant={confirmAction?.variant}
        isLoading={isActionLoading}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />

      {walletModalOpen && data?.user && (
        <WalletActionModal
          user={data.user}
          onClose={() => {
            setWalletModalOpen(false);
            setReloadCount((n) => n + 1); // Modal band hone pe balance 0 update dikhega
          }}
        />
      )}
    </dialog>
  );
}

// --- VERIFICATION QUEUE COMPONENT ---
function VerificationQueue({ onOpenProfile }) {
  const dispatch = useDispatch();
  const {
    pendingUsers,
    isLoadingWorkers,
    pendingPage,
    pendingHasMore,
    pendingTotal,
    error,
  } = useSelector((state) => state.admin);

  const [roleFilter, setRoleFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);
  const tick = useLiveTick("admin:queue_changed");

  useEffect(() => {
    dispatch(
      fetchPendingUsers({
        page: 1,
        role: roleFilter || undefined,
        q: debouncedSearch || undefined,
      }),
    );
  }, [dispatch, roleFilter, debouncedSearch, tick]);

  const isFirstLoad = isLoadingWorkers && pendingUsers.length === 0;
  const hasFilter = !!(roleFilter || debouncedSearch);
  const isEmpty = !isLoadingWorkers && pendingUsers.length === 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <AdminSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search name or email…"
        filterGroups={[
          {
            value: roleFilter,
            onChange: setRoleFilter,
            options: [
              { value: "", label: "All Pending" },
              { value: "worker", label: "Workers" },
              { value: "employer", label: "Employers" },
            ],
          },
        ]}
        rightSlot={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-base-200/60 rounded-lg text-xs font-semibold text-base-content/70 whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5" />
            {pendingTotal} pending
          </div>
        }
      />
      {/* 🆕 Error banner */}
      {error && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {isFirstLoad ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isEmpty ? (
        <div className="bg-base-100 rounded-xl border border-base-200 p-12 text-center flex flex-col items-center justify-center">
          <ShieldCheck className="w-12 h-12 text-success/30 mb-3" />
          <h3 className="text-lg font-bold">
            {hasFilter ? "No matching users" : "All caught up!"}
          </h3>
          <p className="text-base-content/60 mt-1">
            {hasFilter
              ? "Try a different search or clear the filter."
              : "No pending verifications at the moment."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pendingUsers.map((user) => (
            <div
              key={user._id}
              className="bg-base-100 rounded-xl shadow-sm border border-base-200 border-l-4 border-l-primary p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-r-primary/30 transition-colors"
            >
              <div>
                <p
                  className="font-bold text-lg text-base-content cursor-pointer hover:text-primary transition"
                  onClick={() => onOpenProfile(user._id)}
                >
                  {user.role === "employer"
                    ? user.businessName || user.name
                    : user.name}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`badge badge-sm font-medium capitalize ${user.role === "employer" ? "badge-secondary" : "badge-primary"}`}
                  >
                    {user.role}
                  </span>
                  <span className="text-xs text-base-content/60 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {user.email}
                  </span>
                </div>
              </div>
              <button
                className="btn btn-sm btn-ghost bg-base-200 hover:bg-primary hover:text-primary-content gap-2"
                onClick={() => onOpenProfile(user._id)}
              >
                Review <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingHasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="btn btn-outline btn-sm rounded-xl gap-2 min-w-40"
            disabled={isLoadingWorkers}
            onClick={() =>
              dispatch(
                fetchPendingUsers({
                  page: pendingPage + 1,
                  role: roleFilter || undefined,
                  q: debouncedSearch || undefined,
                }),
              )
            }
          >
            {isLoadingWorkers && <Loader2 className="w-4 h-4 animate-spin" />}
            Load more
          </button>
        </div>
      ) : (
        pendingUsers.length > 0 && (
          <p className="text-xs text-base-content/50 text-center py-2">
            All {pendingTotal} pending user
            {pendingTotal === 1 ? "" : "s"} shown
          </p>
        )
      )}
    </div>
  );
}
// --- USER MANAGEMENT COMPONENT ---
function UserManagement({ onOpenProfile }) {
  const dispatch = useDispatch();
  const {
    allUsers,
    isLoadingUsers,
    usersPage,
    usersHasMore,
    usersTotal,
    error,
  } = useSelector((state) => state.admin);

  const [forceLogoutTarget, setForceLogoutTarget] = useState(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  useEffect(() => {
    dispatch(
      fetchAllUsers({
        page: 1,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        q: debouncedSearch || undefined,
      }),
    );
  }, [dispatch, roleFilter, statusFilter, debouncedSearch]);

  const isFirstLoad = isLoadingUsers && allUsers.length === 0;
  const hasFilter = !!(roleFilter || statusFilter || debouncedSearch);
  const isEmpty = !isLoadingUsers && allUsers.length === 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <AdminSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search name, email, phone…"
        filterGroups={[
          {
            value: roleFilter,
            onChange: setRoleFilter,
            options: [
              { value: "", label: "All roles" },
              { value: "worker", label: "Workers" },
              { value: "employer", label: "Employers" },
            ],
          },
          {
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "", label: "All statuses" },
              { value: "blocked", label: "Blocked" },
              { value: "banned", label: "Banned" },
              { value: "strike", label: "Has strikes" },
            ],
          },
        ]}
        rightSlot={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-base-200/60 rounded-lg text-xs font-semibold text-base-content/70 whitespace-nowrap">
            <Users className="w-3.5 h-3.5" />
            {usersTotal} user{usersTotal === 1 ? "" : "s"}
          </div>
        }
      />

      {/* 🆕 Error banner */}
      {error && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {isFirstLoad ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isEmpty ? (
        <div className="bg-base-100 rounded-xl border border-base-200 p-12 text-center flex flex-col items-center justify-center">
          <Users className="w-12 h-12 text-base-content/20 mb-3" />
          <h3 className="text-lg font-bold">
            {hasFilter ? "No matching users" : "No users found"}
          </h3>
          <p className="text-base-content/60 mt-1">
            {hasFilter
              ? "Try a different search or clear the filters."
              : "There are no users yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {allUsers.map((user) => (
            <div
              key={user._id}
              className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-primary/30 transition-colors"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <p
                    className="font-bold text-lg text-base-content cursor-pointer hover:text-primary transition"
                    onClick={() => onOpenProfile(user._id)}
                  >
                    {user.role === "employer"
                      ? user.businessName || user.name
                      : user.name}
                  </p>
                  <span
                    className={`badge badge-sm font-medium capitalize ${user.role === "employer" ? "badge-secondary" : "badge-primary"}`}
                  >
                    {user.role}
                  </span>
                  {user.isActive === false && (
                    <span className="badge badge-error badge-sm text-white gap-1">
                      <Ban className="w-3 h-3" /> Blocked
                    </span>
                  )}
                  {user.isBanned && user.isActive !== false && (
                    <span className="badge badge-error badge-sm text-white gap-1">
                      <Ban className="w-3 h-3" /> Banned ({user.strikes ?? 0})
                    </span>
                  )}
                  {!user.isBanned && (user.strikes ?? 0) > 0 && (
                    <span className="badge badge-warning badge-sm text-white gap-1">
                      <AlertTriangle className="w-3 h-3" /> {user.strikes}{" "}
                      Strike
                      {user.strikes > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-base-content/60">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {user.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {user.phone}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="btn btn-sm btn-ghost border border-error/30 text-error hover:bg-error/10 gap-2"
                  onClick={() => setForceLogoutTarget(user)}
                  title="Sign this user out of every device"
                >
                  <LogOut className="w-4 h-4" /> Force logout
                </button>
                <button
                  className="btn btn-sm btn-ghost border border-base-200 gap-2"
                  onClick={() => onOpenProfile(user._id)}
                >
                  Manage <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {usersHasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="btn btn-outline btn-sm rounded-xl gap-2 min-w-40"
            disabled={isLoadingUsers}
            onClick={() =>
              dispatch(
                fetchAllUsers({
                  page: usersPage + 1,
                  role: roleFilter || undefined,
                  status: statusFilter || undefined,
                  q: debouncedSearch || undefined,
                }),
              )
            }
          >
            {isLoadingUsers && <Loader2 className="w-4 h-4 animate-spin" />}
            Load more users
          </button>
        </div>
      ) : (
        allUsers.length > 0 && (
          <p className="text-xs text-base-content/50 text-center py-2">
            All {usersTotal} user{usersTotal === 1 ? "" : "s"} shown
          </p>
        )
      )}

      {forceLogoutTarget && (
        <ForceLogoutModal
          user={forceLogoutTarget}
          onClose={() => setForceLogoutTarget(null)}
        />
      )}
    </div>
  );
}

// --- SHIFTS MANAGEMENT COMPONENT ---
function AllShifts({ onOpenProfile }) {
  const dispatch = useDispatch();
  const {
    allShifts,
    isLoadingShifts,
    isActionLoading,
    shiftsPage,
    shiftsHasMore,
    shiftsTotal,
    error,
  } = useSelector((state) => state.admin);

  const [confirmAction, setConfirmAction] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  const tick = useLiveTick("shifts:changed");

  useEffect(() => {
    dispatch(
      fetchAllShifts({
        page: 1,
        status: filterStatus || undefined,
        q: debouncedSearch || undefined,
      }),
    );
  }, [dispatch, filterStatus, debouncedSearch, tick]);

  function askConfirm(config) {
    setConfirmAction(config);
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    await confirmAction.run();
    setConfirmAction(null);
  }

  // ❌ NO EARLY RETURNS — compute flags instead
  const isFirstLoad = isLoadingShifts && allShifts.length === 0;
  const hasFilter = !!(filterStatus || debouncedSearch);
  const isEmpty = !isLoadingShifts && allShifts.length === 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ✅ SearchBar ALWAYS visible */}
      <AdminSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by title…"
        filterGroups={[
          {
            value: filterStatus,
            onChange: setFilterStatus,
            options: [
              { value: "", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "filled", label: "Filled" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
              { value: "expired", label: "Expired" },
            ],
          },
        ]}
        rightSlot={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-base-200/60 rounded-lg text-xs font-semibold text-base-content/70 whitespace-nowrap">
            <Briefcase className="w-3.5 h-3.5" />
            {shiftsTotal} {shiftsTotal === 1 ? "shift" : "shifts"}
          </div>
        }
      />
      {/* 🆕 Error banner */}
      {error && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Content area — swaps below the search bar */}
      {isFirstLoad ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isEmpty ? (
        <div className="bg-base-100 rounded-xl border border-base-200 p-12 text-center flex flex-col items-center justify-center">
          <Briefcase className="w-12 h-12 text-base-content/20 mb-3" />
          <h3 className="text-lg font-bold">
            {hasFilter ? "No matching shifts" : "No shifts found"}
          </h3>
          <p className="text-base-content/60 mt-1">
            {hasFilter
              ? "Try a different search term or clear the status filter."
              : "There are no shifts on the platform yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {allShifts.map((shift) => (
            <div
              key={shift._id}
              className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <p className="font-bold text-lg text-base-content truncate">
                    {shift.title}
                  </p>
                  <span
                    className={`badge badge-sm font-medium capitalize ${
                      shift.status === "open"
                        ? "badge-primary"
                        : shift.status === "cancelled"
                          ? "badge-error"
                          : shift.status === "completed"
                            ? "badge-success"
                            : "badge-neutral"
                    }`}
                  >
                    {shift.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-base-content/70 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 opacity-60" />
                    <span
                      className="font-medium text-primary cursor-pointer hover:underline"
                      onClick={() =>
                        onOpenProfile(
                          shift.employer?.user?._id || shift.employer?.user,
                        )
                      }
                    >
                      {shift.employer?.businessName || "Unknown Employer"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 opacity-60" />
                    {shift.acceptedCount ?? 0}/{shift.workersNeeded ?? 1} filled
                  </span>
                </div>
              </div>

                            <div className="flex gap-2 shrink-0">
                {/* ✅ NEW: opens role-aware ShiftDetail in admin view. Shows
                    "Open Admin Console" CTA there. Useful for deep inspection
                    of escrow, reviews, timeline, etc. */}
                <Link
                  to={`/shifts/${shift._id}`}
                  className="btn btn-sm btn-outline border-base-300 gap-2"
                  title="View shift details"
                >
                  <Eye className="w-4 h-4" /> View
                </Link>
                <button
                  className="btn btn-sm btn-outline btn-warning gap-2"
                  disabled={
                    shift.status === "cancelled" ||
                    shift.status === "completed" ||
                    isActionLoading
                  }
                  onClick={() =>
                    askConfirm({
                      title: "Cancel this shift?",
                      body: `This will refund any locked escrow back to the employer and notify accepted workers. The shift will be marked cancelled.`,
                      confirmLabel: "Cancel Shift",
                      variant: "warning",
                      run: () => dispatch(cancelAdminShift(shift._id)),
                    })
                  }
                >
                  <XCircle className="w-4 h-4" /> Cancel
                </button>
                <button
                  className="btn btn-sm btn-outline btn-error gap-2"
                  disabled={isActionLoading}
                  onClick={() =>
                    askConfirm({
                      title: "Permanently delete this shift?",
                      body: `This cannot be undone. Only allowed if the shift has no applications or records.`,
                      confirmLabel: "Delete",
                      variant: "error",
                      run: () => dispatch(deleteAdminShift(shift._id)),
                    })
                  }
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {shiftsHasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="btn btn-outline btn-sm rounded-xl gap-2 min-w-40"
            disabled={isLoadingShifts}
            onClick={() =>
              dispatch(
                fetchAllShifts({
                  page: shiftsPage + 1,
                  status: filterStatus || undefined,
                  q: debouncedSearch || undefined,
                }),
              )
            }
          >
            {isLoadingShifts && <Loader2 className="w-4 h-4 animate-spin" />}
            Load more shifts
          </button>
        </div>
      ) : (
        allShifts.length > 0 && (
          <p className="text-xs text-base-content/50 text-center py-2">
            All {shiftsTotal} shift{shiftsTotal === 1 ? "" : "s"} shown
          </p>
        )
      )}

      <ConfirmActionModal
        open={!!confirmAction}
        title={confirmAction?.title}
        body={confirmAction?.body}
        confirmLabel={confirmAction?.confirmLabel}
        variant={confirmAction?.variant}
        isLoading={isActionLoading}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

// --- ANALYTICS COMPONENT ---
function Analytics() {
  const dispatch = useDispatch();
  const { analytics, isLoadingAnalytics, platformWallet } = useSelector(
    (state) => state.admin,
  );

  useEffect(() => {
    dispatch(fetchAnalytics());
    dispatch(fetchPlatformWallet());
  }, [dispatch]);

  if (isLoadingAnalytics) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics)
    return <p className="opacity-70">No analytics data available.</p>;

  const usersChart = analytics.usersByRole?.map((u) => ({
    name: u._id,
    count: u.count,
  }));
  const shiftsChart = analytics.shiftsByStatus?.map((s) => ({
    name: s._id,
    count: s.count,
  }));
  const revenueRupees = (platformWallet?.balance ?? 0) / 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-base-100 rounded-xl p-5 border border-base-200 border-t-4 border-t-success shadow-sm relative overflow-hidden">
          <IndianRupee className="w-12 h-12 text-success/10 absolute right-4 bottom-4" />
          <p className="text-xs text-base-content/50 uppercase tracking-wider font-bold mb-1">
            Total Paid Out
          </p>
          <p className="text-3xl font-black text-success">
            ₹{analytics.totalPaidOut}
          </p>
        </div>

        <div className="bg-base-100 rounded-xl p-5 border border-base-200 border-t-4 border-t-primary shadow-sm relative overflow-hidden">
          <Briefcase className="w-12 h-12 text-primary/10 absolute right-4 bottom-4" />
          <p className="text-xs text-base-content/50 uppercase tracking-wider font-bold mb-1">
            Shifts Worked
          </p>
          <p className="text-3xl font-black text-primary">
            {analytics.totalShiftsWorked}
          </p>
        </div>

        <div className="bg-base-100 rounded-xl p-5 border border-base-200 border-t-4 border-t-warning shadow-sm relative overflow-hidden">
          <TrendingUp className="w-12 h-12 text-warning/10 absolute right-4 bottom-4" />
          <p className="text-xs text-base-content/50 uppercase tracking-wider font-bold mb-1">
            Platform Revenue
          </p>
          <p className="text-3xl font-black text-warning">
            ₹
            {revenueRupees.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs font-medium text-base-content/50 mt-2">
            From {platformWallet?.shiftsPosted ?? 0} shift
            {(platformWallet?.shiftsPosted ?? 0) === 1 ? "" : "s"} posted
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-base-100 rounded-xl border border-base-200 p-5 shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-base-200 pb-3">
            <Users className="w-5 h-5 text-primary" /> Verified Users
          </h3>
          <div className="h-62.5 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usersChart}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  className="capitalize"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    backgroundColor: "#ffffff",
                    color: "#111111",
                  }}
                  itemStyle={{ color: "#111111" }}
                  labelStyle={{ color: "#111111" }}
                />
                <Bar dataKey="count" fill="#fc8d62" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-base-100 rounded-xl border border-base-200 p-5 shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-base-200 pb-3">
            <Briefcase className="w-5 h-5 text-primary" /> Platform Shifts
          </h3>
          <div className="h-62.5 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={shiftsChart}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  className="capitalize"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    backgroundColor: "#ffffff",
                    color: "#111111",
                  }}
                  itemStyle={{ color: "#111111" }}
                  labelStyle={{ color: "#111111" }}
                />
                <Bar dataKey="count" fill="#95af92" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MAIN DASHBOARD CONTROLLER ---
export default function AdminDashboard() {
  const { user } = useSelector((state) => state.auth);
  const [tab, setTab] = useState("verification");
  const [selectedUserId, setSelectedUserId] = useState(null);

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center bg-base-200/50 text-center">
        <ShieldAlert className="w-20 h-20 text-error mb-4" />
        <h2 className="text-3xl font-bold text-base-content">Access Denied</h2>
        <p className="text-lg text-base-content/60 mt-2 max-w-md">
          This area is strictly restricted to platform administrators.
        </p>
      </div>
    );
  }

  const TABS = [
    { id: "verification", label: "Verification Queue", icon: UserCheck },
    { id: "users", label: "User Management", icon: Users },
    { id: "shifts", label: "All Shifts", icon: Briefcase },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "disputes", label: "Disputes", icon: AlertCircle },
    { id: "ledger", label: "Ledger", icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-base-200/50 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-base-content">
              Admin Console
            </h1>
            <p className="text-base-content/70 mt-1">
              Manage users, shifts, and platform health.
            </p>
          </div>

          {/* Admin Profile Chip */}
          <div className="bg-base-100 pl-2 pr-4 py-2 rounded-full shadow-sm border border-base-200 flex items-center gap-3 shrink-0">
            <div className="avatar">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold uppercase">
                    {user?.name?.charAt(0) || "A"}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="font-bold text-sm leading-none text-base-content">
                {user?.name}
              </p>
              <p className="text-[11px] font-medium text-primary uppercase tracking-wider mt-1 leading-none">
                {user?.role}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Tabs */}
        <div className="mb-6 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2 pb-2 min-w-max">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`btn btn-sm px-4 gap-2 border-0 shadow-none transition-colors ${
                    tab === t.id
                      ? "bg-primary text-primary-content hover:bg-primary/90"
                      : "bg-base-100 text-base-content/70 hover:bg-base-200 hover:text-base-content"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="min-h-[50vh]">
          {tab === "verification" && (
            <VerificationQueue onOpenProfile={setSelectedUserId} />
          )}
          {tab === "users" && (
            <UserManagement onOpenProfile={setSelectedUserId} />
          )}
          {tab === "shifts" && <AllShifts onOpenProfile={setSelectedUserId} />}
          {tab === "analytics" && <Analytics />}
          {tab === "disputes" && <DisputesPanel />}
          {tab === "ledger" && <LedgerPanel />}
        </div>

        {/* Global Profile Modal */}
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      </div>
    </div>
  );
}
