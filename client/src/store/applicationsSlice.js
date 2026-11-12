// client/src/store/applicationsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../api/axios";
import toast from "react-hot-toast";
import { fetchMe } from "./authSlice";

export const applyToShift = createAsyncThunk("applications/apply", async (shiftId, { rejectWithValue }) => {
  try {
    const res = await api.post(`/api/shifts/${shiftId}/apply`, {});
    toast.success("Application Sent!");
    return { shiftId, application: res.data.application };
  } catch (err) {
    const message = err.response?.data?.error || "Failed to apply";
    toast.error(message);
    return rejectWithValue({ shiftId, message });
  }
});

// Dual-mode:
//   fetchMyApplications()                    → unpaged (array, up to 50)
//   fetchMyApplications({ q: "foo" })        → unpaged + search
//   fetchMyApplications({ page: 1, limit: 20 }) → paged
//   fetchMyApplications({ page: 2, ..., append: true }) → paginated append
export const fetchMyApplications = createAsyncThunk(
  "applications/fetchMine",
  async (params = {}, { rejectWithValue }) => {
    try {
      const queryParams = {};
      if (params.page !== undefined) {
        queryParams.page = params.page;
        queryParams.limit = params.limit || 20;
      }
      if (params.q) queryParams.q = params.q;
      if (params.status && params.status !== "all") {
        queryParams.status = params.status;
      }

      const res = await api.get("/api/shifts/applied", { params: queryParams });

      if (Array.isArray(res.data)) {
        return { applications: res.data, paged: false, append: false };
      }
      return {
        applications: res.data.applications,
        page: res.data.page,
        limit: res.data.limit,
        total: res.data.total,
        hasMore: res.data.hasMore,
        paged: true,
        append: !!params.append,
        q: params.q || "",
        status: params.status || "all",
      };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load applications",
      );
    }
  },
);

export const withdrawApplication = createAsyncThunk(
  "applications/withdraw",
  async ({ shiftId, applicationId, reason }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/shifts/${shiftId}/applications/${applicationId}/withdraw`, { reason });
      toast.success("Application withdrawn");
      return { shiftId, application: res.data.application };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to withdraw";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const workerCancelApplication = createAsyncThunk(
  "applications/workerCancel",
  async ({ shiftId, applicationId, reason }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post(`/api/shifts/${shiftId}/applications/${applicationId}/worker-cancel`, { reason });
      const { application, freeCancellation, strikes, isBanned } = res.data;

      if (isBanned) {
        toast.error("That was your 3rd strike — your account has been suspended.", { duration: 8000 });
      } else if (freeCancellation) {
        toast.success("Shift cancelled — no strike, thanks for the notice");
      } else {
        toast.success(`Shift cancelled — strike added (${strikes} of 3)`);
      }
      dispatch(fetchMe());
      return { shiftId, application, freeCancellation, strikes, isBanned };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to cancel";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const markArrived = createAsyncThunk(
  "applications/markArrived",
  async ({ shiftId, applicationId, lat, lng }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/shifts/${shiftId}/applications/${applicationId}/arrived`, { lat, lng });
      toast.success("Arrival confirmed — your employer has been notified");
      return { applicationId, arrivedAt: res.data.arrivedAt };
    } catch (err) {
      const message = err.response?.data?.error || "Couldn't confirm arrival";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

const CANCEL_FIELDS = [
  "status", "noShow", "strikeApplied", "cancelledAt", "cancellationReason",
  "escrowStatus", "escrowReleasedAt", "refundToEmployer", "penaltyToWorker",
];

function applyServerApplication(state, action) {
  const { shiftId, application } = action.payload;
  const listApp = state.list.find((a) => a._id === application._id);
  if (listApp) {
    CANCEL_FIELDS.forEach((field) => {
      if (application[field] !== undefined) listApp[field] = application[field];
    });
  }
  if (state.byShiftId[shiftId]) {
    state.byShiftId[shiftId].status = application.status;
    state.byShiftId[shiftId].noShow = application.noShow;
  }
}

const applicationsSlice = createSlice({
  name: "applications",
    initialState: {
    byShiftId: {},
    list: [],
    listStatus: "idle", // loading state — keep as-is
    // Pagination state — only populated when a paged fetch runs.
    listPage: 1,
    listLimit: 20,
    listTotal: 0,
    listHasMore: false,
    listQuery: "",
    listFilter: "all", // ← NEW: current status filter chip
  },
  reducers: {
    applicationStatusChanged(state, action) {
      const { applicationId, status, shiftId, noShow, escrowAmount } = action.payload;
      const app = state.list.find((a) => a._id === applicationId);
      if (app) {
        app.status = status;
        if (escrowAmount != null) app.escrowAmount = escrowAmount;
        if (noShow !== undefined) app.noShow = noShow;
      }
      if (shiftId && state.byShiftId[shiftId]) {
        state.byShiftId[shiftId].status = status;
        if (escrowAmount != null) state.byShiftId[shiftId].escrowAmount = escrowAmount;
        if (noShow !== undefined) state.byShiftId[shiftId].noShow = noShow;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(applyToShift.pending, (state, action) => {
        state.byShiftId[action.meta.arg] = { status: "applying" };
      })
      .addCase(applyToShift.fulfilled, (state, action) => {
        const { shiftId, application } = action.payload;
        state.byShiftId[shiftId] = {
          status: application.status,
          id: application._id,
          noShow: application.noShow,
          escrowAmount: application.escrowAmount,
        };
        const row = state.list.find((a) => a._id === application._id);
        if (row) row.status = application.status;
      })
      .addCase(applyToShift.rejected, (state, action) => {
        delete state.byShiftId[action.meta.arg];
      })
      .addCase(fetchMyApplications.pending, (state) => { state.listStatus = "loading"; })
            .addCase(fetchMyApplications.fulfilled, (state, action) => {
        const {
          applications,
          paged,
          append,
          page,
          limit,
          total,
          hasMore,
          q,
          status,
        } = action.payload;

        if (paged) {
          state.list = append ? [...state.list, ...applications] : applications;
          state.listPage = page;
          state.listLimit = limit;
          state.listTotal = total;
          state.listHasMore = hasMore;
          state.listQuery = q || "";
          state.listFilter = status || "all";
        } else {
          // Unpaged (WorkerDashboard + socket refreshes) — full replace, reset pagination
          state.list = applications;
          state.listPage = 1;
          state.listTotal = applications.length;
          state.listHasMore = false;
          // Note: don't touch listFilter here — unpaged callers don't filter.
        }

        state.listStatus = "succeeded";

        applications.forEach((app) => {
          if (app.shift?._id) {
            state.byShiftId[app.shift._id] = {
              status: app.status,
              id: app._id,
              noShow: app.noShow,
              escrowAmount: app.escrowAmount,
            };
          }
        });
      })
      .addCase(fetchMyApplications.rejected, (state) => { state.listStatus = "failed"; })
      .addCase(markArrived.fulfilled, (state, action) => {
        const app = state.list.find((a) => a._id === action.payload.applicationId);
        if (app) app.arrivedAt = action.payload.arrivedAt;
      })
      .addCase(workerCancelApplication.fulfilled, applyServerApplication)
      .addCase(withdrawApplication.fulfilled, applyServerApplication);
  },
});

export const { applicationStatusChanged } = applicationsSlice.actions;
export default applicationsSlice.reducer;