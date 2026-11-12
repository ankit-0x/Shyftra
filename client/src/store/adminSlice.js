// client/src/store/adminSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import api from "../api/axios";

// ============================================================
// 🆕 Constants (moved to top — Minor 4)
// ============================================================
export const USERS_PAGE_SIZE = 50;
export const PENDING_PAGE_SIZE = 20;
export const DISPUTES_PAGE_SIZE = 20;
export const SHIFTS_PAGE_SIZE = 50;

// ============================================================
// 🆕 Helper for stale-response detection (Minor 3)
// ============================================================
function sameQuery(a, b, keys) {
  if (!a || !b) return false;
  for (const k of keys) {
    if ((a[k] ?? null) !== (b[k] ?? null)) return false;
  }
  return true;
}

// 1. Fetch users waiting for verification (Employers & Workers)
export const fetchPendingUsers = createAsyncThunk(
  "admin/fetchPendingUsers",
  async ({ page = 1, role, q } = {}, { rejectWithValue }) => {
    try {
      const params = { page, limit: PENDING_PAGE_SIZE };
      if (role) params.role = role;
      if (q) params.q = q;
      const res = await api.get("/api/admin/pending", { params });
      return res.data; // { users, total, page, limit, hasMore }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load pending users",
      );
    }
  },
);

export const fetchAllUsers = createAsyncThunk(
  "admin/fetchAllUsers",
  async ({ page = 1, role, status, q } = {}, { rejectWithValue }) => {
    try {
      const params = { page, limit: USERS_PAGE_SIZE };
      if (role) params.role = role;
      if (status) params.status = status;
      if (q) params.q = q;
      const res = await api.get("/api/admin/users", { params });
      return res.data; // { users, total, page, limit, hasMore }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load users",
      );
    }
  },
);

export const fetchVerificationDocUrl = createAsyncThunk(
  "admin/fetchVerificationDocUrl",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/api/admin/${userId}/verification-doc-url`);
      return res.data.url;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load document",
      );
    }
  },
);

export const decideVerification = createAsyncThunk(
  "admin/decideVerification",
  async ({ userId, decision }, { rejectWithValue }) => {
    try {
      await api.patch(`/api/admin/${userId}/verify`, { decision });
      toast.success(`Marked as ${decision}`);

      // IMPROVEMENT: Return the data to update Redux locally instead of refetching the whole list!
      return { userId, decision };
    } catch (err) {
      const message =
        err.response?.data?.error || "Failed to update verification";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const toggleBlockUser = createAsyncThunk(
  "admin/toggleBlockUser",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/api/admin/users/${userId}/block`);
      toast.success(
        res.data.isActive ? "Account unblocked" : "Account blocked",
      );
      return { userId, isActive: res.data.isActive };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to update account";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

// ✅ NEW: Explicit unban (clears strikes + isBanned)
export const unbanUser = createAsyncThunk(
  "admin/unbanUser",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/admin/users/${userId}/unban`);
      toast.success("User unbanned — strikes reset to 0");
      return { userId, user: res.data.user };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to unban user";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

// ✅ NEW: Reset strikes only
export const resetStrikes = createAsyncThunk(
  "admin/resetStrikes",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/admin/users/${userId}/reset-strikes`);
      toast.success(res.data.message || "Strikes reset to 0");
      return { userId, user: res.data.user };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to reset strikes";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

// Force logout: bumps the target's tokenVersion on the server (revokes every
// device) + closes their sockets. Requires the ADMIN's password.
// Failures are returned (not toasted) so the modal can show them inline.
export const forceLogoutUser = createAsyncThunk(
  "admin/forceLogoutUser",
  async ({ userId, password, reason }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/admin/users/${userId}/force-logout`, {
        password,
        reason,
      });
      toast.success(res.data.message || "User signed out of every device");
      return { userId };
    } catch (err) {
      const d = err.response?.data;
      return rejectWithValue({
        message: d?.error || "Failed to force logout",
        code: d?.code ?? null,
      });
    }
  },
);

export const fetchAllShifts = createAsyncThunk(
  "admin/fetchAllShifts",
  async ({ page = 1, status, q } = {}, { rejectWithValue }) => {
    try {
      const params = { page, limit: SHIFTS_PAGE_SIZE };
      if (status) params.status = status;
      if (q) params.q = q;
      const res = await api.get("/api/admin/shifts", { params });
      // res.data = { shifts, total, page, limit, hasMore }
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load shifts",
      );
    }
  },
);

export const fetchAnalytics = createAsyncThunk(
  "admin/fetchAnalytics",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/admin/analytics");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load analytics",
      );
    }
  },
);

export const cancelAdminShift = createAsyncThunk(
  "admin/cancelShift",
  async (shiftId, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/api/admin/shifts/${shiftId}/cancel`);
      // ✅ Use server's message — includes refund amount
      toast.success(res.data?.message || "Shift cancelled successfully");
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to cancel shift";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const deleteAdminShift = createAsyncThunk(
  "admin/deleteShift",
  async (shiftId, { rejectWithValue }) => {
    try {
      await api.delete(`/api/admin/shifts/${shiftId}`);
      toast.success("Shift deleted permanently");
      // IMPROVEMENT: Safely return the argument ID instead of relying on the backend response structure
      return shiftId;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to delete shift";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const fetchFullUserProfile = createAsyncThunk(
  "admin/fetchFullUserProfile",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/api/admin/users/${userId}/profile`);
      return res.data;
    } catch (err) {
      toast.error("Failed to load user profile");
      return rejectWithValue(err.response?.data?.error);
    }
  },
);

// 8. Disputes — GET /api/admin/disputes[?status=]  (awaiting_proof | under_review | resolved)
export const fetchAdminDisputes = createAsyncThunk(
  "admin/fetchDisputes",
  async ({ status, page = 1, q } = {}, { rejectWithValue }) => {
    try {
      const params = { page, limit: DISPUTES_PAGE_SIZE };
      if (status && status !== "all") params.status = status;
      if (q) params.q = q;
      const res = await api.get("/api/admin/disputes", { params });
      return res.data; // { disputes, total, page, limit, hasMore }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load disputes",
      );
    }
  },
);

// PUT /api/admin/disputes/:id/resolve  { ruledFor: "worker"|"employer", resolution }
export const ruleOnDispute = createAsyncThunk(
  "admin/ruleOnDispute",
  async (
    { disputeId, ruledFor, resolution },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const res = await api.put(`/api/admin/disputes/${disputeId}/resolve`, {
        ruledFor,
        resolution,
      });
      toast.success(`Ruled in the ${ruledFor}'s favour`);

      dispatch(fetchPlatformWallet());
      dispatch(fetchAnalytics());

      return {
        disputeId,
        dispute: res.data.dispute ?? res.data,
        ruledFor,
        resolution,
      };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to rule on dispute";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

// 9. Ledger integrity checks — GET /api/admin/ledger, POST /api/admin/ledger/run
export const fetchLedgerChecks = createAsyncThunk(
  "admin/fetchLedgerChecks",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/admin/ledger");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load ledger checks",
      );
    }
  },
);

export const runLedgerCheckNow = createAsyncThunk(
  "admin/runLedgerCheckNow",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post("/api/admin/ledger/run");
      if (res.data?.ok) toast.success("Ledger balanced ✔");
      else toast.error("Ledger mismatch detected — see the issues list");
      dispatch(fetchLedgerChecks());
      return res.data;
    } catch (err) {
      const message = err.response?.data?.error || "Ledger check failed to run";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const fetchPlatformWallet = createAsyncThunk(
  "admin/fetchPlatformWallet",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/admin/platform-wallet");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load platform wallet",
      );
    }
  },
);

// Banned Wallet Action
export const handleWalletAction = createAsyncThunk(
  "admin/handleWalletAction",
  async (
    { userId, action, password, reason },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const res = await api.post(`/api/admin/users/${userId}/wallet-action`, {
        action,
        password,
        reason,
      });
      toast.success(res.data.message);

      dispatch(fetchPlatformWallet());
      dispatch(fetchAnalytics());

      return { userId };
    } catch (err) {
      const d = err.response?.data;
      return rejectWithValue({
        message: d?.error || "Failed to process",
        code: d?.code,
      });
    }
  },
);

const adminSlice = createSlice({
  name: "admin",
  initialState: {
    pendingUsers: [],
    pendingPage: 1, // 🆕
    pendingHasMore: false, // 🆕
    pendingTotal: 0, // 🆕
    pendingQuery: null,

    allUsers: [],
    usersPage: 1,
    usersHasMore: false,
    usersTotal: 0, // 🆕
    usersQuery: null,

    allShifts: [],
    shiftsPage: 1,
    shiftsHasMore: false,
    shiftsTotal: 0,
    shiftsQuery: null,

    analytics: null,
    platformWallet: null,

    disputes: [],
    disputesPage: 1, // 🆕
    disputesHasMore: false, // 🆕
    disputesTotal: 0, // 🆕
    disputesQuery: null,

    ledgerChecks: [],
    isLoadingDisputes: false,
    isLoadingLedger: false,
    isRunningLedger: false,

    // Read Loading States
    isLoadingWorkers: false,
    isLoadingUsers: false,
    isLoadingShifts: false,
    isLoadingAnalytics: false,
    isLoadingPlatformWallet: false,
    // Write Action Loading State (For disabling buttons during mutations)
    isActionLoading: false,

    error: null,
  },
  reducers: {
    clearAdminErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- Fetch Pending Users ---
      .addCase(fetchPendingUsers.pending, (state, action) => {
        state.isLoadingWorkers = true;
        state.error = null;
        state.pendingQuery = action.meta.arg; // 🆕
      })
      .addCase(fetchPendingUsers.fulfilled, (state, action) => {
        if (
          !sameQuery(state.pendingQuery, action.meta.arg, ["page", "role", "q"])
        )
          return; // 🆕
        const { users, page, hasMore, total } = action.payload;
        state.isLoadingWorkers = false;
        state.pendingUsers =
          page === 1 ? users : [...state.pendingUsers, ...users];
        state.pendingPage = page;
        state.pendingHasMore = hasMore;
        state.pendingTotal = total;
      })
      .addCase(fetchPendingUsers.rejected, (state, action) => {
        if (
          !sameQuery(state.pendingQuery, action.meta.arg, ["page", "role", "q"])
        )
          return; // 🆕
        state.isLoadingWorkers = false;
        state.error = action.payload;
      })

      // --- Fetch All Users ---
      .addCase(fetchAllUsers.pending, (state, action) => {
        state.isLoadingUsers = true;
        state.error = null;
        state.usersQuery = action.meta.arg; // 🆕
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        if (
          !sameQuery(state.usersQuery, action.meta.arg, [
            "page",
            "role",
            "status",
            "q",
          ])
        )
          return; // 🆕
        const { users, page, hasMore, total } = action.payload;
        state.isLoadingUsers = false;
        state.allUsers = page === 1 ? users : [...state.allUsers, ...users];
        state.usersPage = page;
        state.usersHasMore = hasMore;
        state.usersTotal = total;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        if (
          !sameQuery(state.usersQuery, action.meta.arg, [
            "page",
            "role",
            "status",
            "q",
          ])
        )
          return; // 🆕
        state.isLoadingUsers = false;
        state.error = action.payload;
      })

      // --- Fetch All Shifts (paginated) ---
      .addCase(fetchAllShifts.pending, (state, action) => {
        state.isLoadingShifts = true;
        state.error = null;
        state.shiftsQuery = action.meta.arg; // 🆕
      })
      .addCase(fetchAllShifts.fulfilled, (state, action) => {
        if (
          !sameQuery(state.shiftsQuery, action.meta.arg, [
            "page",
            "status",
            "q",
          ])
        )
          return; // 🆕
        const { shifts, page, hasMore, total } = action.payload;
        state.isLoadingShifts = false;
        state.allShifts = page === 1 ? shifts : [...state.allShifts, ...shifts];
        state.shiftsPage = page;
        state.shiftsHasMore = hasMore;
        state.shiftsTotal = total;
      })
      .addCase(fetchAllShifts.rejected, (state, action) => {
        if (
          !sameQuery(state.shiftsQuery, action.meta.arg, [
            "page",
            "status",
            "q",
          ])
        )
          return; // 🆕
        state.isLoadingShifts = false;
        state.error = action.payload;
      })

      // --- Fetch Analytics ---
      .addCase(fetchAnalytics.pending, (state) => {
        state.isLoadingAnalytics = true;
        state.error = null;
      })
      .addCase(fetchAnalytics.fulfilled, (state, action) => {
        state.isLoadingAnalytics = false;
        state.analytics = action.payload;
      })
      .addCase(fetchAnalytics.rejected, (state, action) => {
        state.isLoadingAnalytics = false;
        state.error = action.payload;
      })

      // --- Disputes ---
      .addCase(fetchAdminDisputes.pending, (state, action) => {
        state.isLoadingDisputes = true;
        state.disputesQuery = action.meta.arg; // 🆕
      })
      .addCase(fetchAdminDisputes.fulfilled, (state, action) => {
        if (
          !sameQuery(state.disputesQuery, action.meta.arg, [
            "page",
            "status",
            "q",
          ])
        )
          return; // 🆕
        const { disputes, page, hasMore, total } = action.payload;
        state.isLoadingDisputes = false;
        state.disputes =
          page === 1 ? disputes : [...state.disputes, ...disputes];
        state.disputesPage = page;
        state.disputesHasMore = hasMore;
        state.disputesTotal = total;
      })
      .addCase(fetchAdminDisputes.rejected, (state, action) => {
        if (
          !sameQuery(state.disputesQuery, action.meta.arg, [
            "page",
            "status",
            "q",
          ])
        )
          return; // 🆕
        state.isLoadingDisputes = false;
        state.error = action.payload;
      })

      .addCase(ruleOnDispute.pending, (state) => {
        state.isActionLoading = true;
      })
      .addCase(ruleOnDispute.rejected, (state) => {
        state.isActionLoading = false;
      })
      .addCase(ruleOnDispute.fulfilled, (state, action) => {
        state.isActionLoading = false;
        const { disputeId, ruledFor, resolution } = action.payload;
        const d = state.disputes.find((x) => x._id === disputeId);
        if (d) {
          d.status = "resolved";
          d.ruledFor = ruledFor;
          d.resolution = resolution;
          d.resolvedAt = new Date().toISOString();
        }
      })

      // --- Ledger ---
      .addCase(fetchLedgerChecks.pending, (state) => {
        state.isLoadingLedger = true;
      })
      .addCase(fetchLedgerChecks.fulfilled, (state, action) => {
        state.isLoadingLedger = false;
        state.ledgerChecks = action.payload;
      })
      .addCase(fetchLedgerChecks.rejected, (state, action) => {
        state.isLoadingLedger = false;
        state.error = action.payload;
      })
      .addCase(runLedgerCheckNow.pending, (state) => {
        state.isRunningLedger = true;
      })
      .addCase(runLedgerCheckNow.fulfilled, (state) => {
        state.isRunningLedger = false;
      })
      .addCase(runLedgerCheckNow.rejected, (state) => {
        state.isRunningLedger = false;
      })

      // --- Decide Verification (Local Optimistic Update) ---
      .addCase(decideVerification.fulfilled, (state, action) => {
        state.isActionLoading = false;
        // Instantly remove them from pending queue without refetching
        state.pendingUsers = state.pendingUsers.filter(
          (u) => u._id !== action.payload.userId,
        );
        state.pendingTotal = Math.max(0, state.pendingTotal - 1);
        // ✅ FIX 5a: Update the User Management list instantly as well
        const u = state.allUsers.find((x) => x._id === action.payload.userId);
        if (u) u.verificationStatus = action.payload.decision;
      })

      // --- Toggle Block User ---
      .addCase(toggleBlockUser.fulfilled, (state, action) => {
        state.isActionLoading = false;
        // 1. Update in User Management list
        const user = state.allUsers.find(
          (u) => u._id === action.payload.userId,
        );
        if (user) user.isActive = action.payload.isActive;

        // 2. Update in pending users list (Fallback)
        const pendingUser = state.pendingUsers.find(
          (w) => w._id === action.payload.userId,
        );
        if (pendingUser) pendingUser.isActive = action.payload.isActive;
      })

      // ✅ NEW: Unban — update both lists
      .addCase(unbanUser.fulfilled, (state, action) => {
        state.isActionLoading = false;
        const user = state.allUsers.find(
          (u) => u._id === action.payload.userId,
        );
        if (user) {
          user.isActive = true;
          user.isBanned = false;
          user.strikes = 0;
        }
        const pendingUser = state.pendingUsers.find(
          (w) => w._id === action.payload.userId,
        );
        if (pendingUser) {
          pendingUser.isActive = true;
          pendingUser.isBanned = false;
          pendingUser.strikes = 0;
        }
      })

      // ✅ NEW: Reset strikes — update both lists
      .addCase(resetStrikes.fulfilled, (state, action) => {
        state.isActionLoading = false;
        const user = state.allUsers.find(
          (u) => u._id === action.payload.userId,
        );
        if (user) {
          user.strikes = 0;
          if (action.payload.user?.isBanned === false) user.isBanned = false;
        }
        const pendingUser = state.pendingUsers.find(
          (w) => w._id === action.payload.userId,
        );
        if (pendingUser) {
          pendingUser.strikes = 0;
          if (action.payload.user?.isBanned === false)
            pendingUser.isBanned = false;
        }
      })

      // --- Cancel Shift ---
      // --- Cancel Shift ---
      .addCase(cancelAdminShift.fulfilled, (state, action) => {
        state.isActionLoading = false;
        // Backend returns { message, shift } — use the .shift key
        const shift = action.payload?.shift ?? action.payload;
        if (!shift?._id) return;
        const index = state.allShifts.findIndex((s) => s._id === shift._id);
        if (index !== -1) {
          state.allShifts[index] = shift;
        }
      })

      // --- Delete Shift ---
      .addCase(deleteAdminShift.fulfilled, (state, action) => {
        state.isActionLoading = false;
        // Instantly remove shift from UI
        state.allShifts = state.allShifts.filter(
          (s) => s._id !== action.payload,
        );
        state.shiftsTotal = Math.max(0, state.shiftsTotal - 1);
      })

      // --- Fetch Platform Wallet ---
      .addCase(fetchPlatformWallet.pending, (state) => {
        state.isLoadingPlatformWallet = true;
      })
      .addCase(fetchPlatformWallet.fulfilled, (state, action) => {
        state.isLoadingPlatformWallet = false;
        state.platformWallet = action.payload;
      })
      .addCase(fetchPlatformWallet.rejected, (state, action) => {
        state.isLoadingPlatformWallet = false;
        state.error = action.payload;
      })
      // ✅ NEW: Handle Wallet Action — update balance to 0 instantly in UI
      .addCase(handleWalletAction.fulfilled, (state, action) => {
        state.isActionLoading = false;
        const user = state.allUsers.find(
          (u) => u._id === action.payload.userId,
        );
        if (user) {
          user.walletBalance = 0;
        }
      })
      // --- MUTATIONS (Action Loading States) ---
      // --- MUTATIONS (Action Loading States) ---
      .addMatcher(
        (action) =>
          action.type.endsWith("/pending") &&
          [
            "admin/decideVerification",
            "admin/toggleBlockUser",
            "admin/unbanUser",
            "admin/resetStrikes", // ✅ NEW
            "admin/cancelShift",
            "admin/deleteShift",
            "admin/handleWalletAction", // ✅ Wallet Action
          ].includes(action.type.replace("/pending", "")),
        (state) => {
          state.isActionLoading = true;
        },
      )
      .addMatcher(
        (action) =>
          action.type.endsWith("/rejected") &&
          [
            "admin/decideVerification",
            "admin/toggleBlockUser",
            "admin/unbanUser",
            "admin/resetStrikes", // ✅ NEW
            "admin/cancelShift",
            "admin/deleteShift",
            "admin/handleWalletAction", // ✅ Wallet Action
          ].includes(action.type.replace("/rejected", "")),
        (state) => {
          state.isActionLoading = false;
        },
      );
  },
});

export const { clearAdminErrors } = adminSlice.actions;
export default adminSlice.reducer;
