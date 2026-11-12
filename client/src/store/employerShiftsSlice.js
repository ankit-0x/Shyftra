// client/src/store/employerShiftsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import api from "../api/axios";

export const createShift = createAsyncThunk(
  "employerShifts/create",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post("/api/shifts", payload);
      toast.success("Shift posted!");
      return res.data.shift;
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Failed to post shift";
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

export const fetchMyShifts = createAsyncThunk(
  "employerShifts/fetchMine",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/shifts");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load your shifts",
      );
    }
  },
);

export const fetchEmployerStats = createAsyncThunk(
  "employerShifts/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/shifts/employer/stats");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load dashboard stats",
      );
    }
  },
);

export const fetchApplicants = createAsyncThunk(
  "employerShifts/fetchApplicants",
  async (shiftId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/api/shifts/${shiftId}/applications`);
      return { shiftId, applicants: res.data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load applicants",
      );
    }
  },
);

export const updateApplicationStatus = createAsyncThunk(
  "employerShifts/updateApplicationStatus",
  async ({ shiftId, applicationId, status }, { rejectWithValue }) => {
    try {
      const res = await api.put(
        `/api/shifts/${shiftId}/applications/${applicationId}`,
        { status },
      );
      return {
        shiftId,
        application: res.data.application,
        shiftStatus: res.data.shiftStatus,
      }; // FIXED: was res.data.shfitStatus
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to update application",
      );
    }
  },
);

export const cancelShift = createAsyncThunk(
  "employer/cancelShift",
  async (shiftId, { rejectWithValue }) => {
    try {
      await api.delete(`/api/shifts/${shiftId}`);
      return shiftId;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to cancel shift",
      );
    }
  },
);

// PUT /api/shifts/:id — edit an open/filled shift. Once anyone has applied,
// the server locks pay/time/location/worker-count and only allows
// title + description; we surface its explanation verbatim.
export const updateShift = createAsyncThunk(
  "employerShifts/updateShift",
  async ({ shiftId, changes }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/api/shifts/${shiftId}`, changes);
      return res.data.shift ?? res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to update shift",
      );
    }
  },
);

export const generateOtp = createAsyncThunk(
  "employer/generateOtp",
  async ({ shiftId, workerId }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/shifts/${shiftId}/generate-otp`, null, {
        params: { workerId },
      });
      return {
        shiftId,
        workerId,
        otp: res.data.otp,
        expiresInMinutes: res.data.expiresInMinutes ?? 15,
      };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to generate code",
      );
    }
  },
);

// NEW — fetch the currently-valid code from the backend (Redis is the
// source of truth). Used after a page refresh so the employer doesn't
// have to regenerate. No browser storage.
export const fetchActiveOtp = createAsyncThunk(
  "employer/fetchActiveOtp",
  async ({ shiftId, workerId }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/api/shifts/${shiftId}/active-otp`, {
        params: { purpose: "entry", workerId },
      });
      return {
        shiftId,
        workerId,
        otp: res.data.otp ?? null,
        expiresAt: res.data.expiresAt ?? null,
      };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load active code",
      );
    }
  },
);

// NEW — pre-shift cancellation, employer-initiated (early or late).
export const employerCancelApplication = createAsyncThunk(
  "employerShifts/employerCancel",
  async ({ shiftId, applicationId, reason }, { rejectWithValue }) => {
    try {
      const res = await api.post(
        `/api/shifts/${shiftId}/applications/${applicationId}/employer-cancel`,
        { reason },
      );
      return {
        shiftId,
        application: res.data.application,
        wasLateCancellation: res.data.wasLateCancellation,
      };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to cancel worker",
      );
    }
  },
);

// NEW — worker no-show, only valid once the shift's start time has passed.
export const markNoShow = createAsyncThunk(
  "employerShifts/markNoShow",
  async ({ shiftId, applicationId, reason }, { rejectWithValue }) => {
    try {
      const res = await api.post(
        `/api/shifts/${shiftId}/applications/${applicationId}/mark-no-show`,
        { reason },
      );
      return { shiftId, application: res.data.application };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to mark no-show",
      );
    }
  },
);

export const employerClockOut = createAsyncThunk(
  "employerShifts/clockOut",
  async ({ shiftId, workerId, otp }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/shifts/${shiftId}/clock-out`, {
        workerId,
        otp,
      });
      return { shiftId, workerId, record: res.data.record };
    } catch (err) {
      return rejectWithValue({
        workerId,
        message: err.response?.data?.error || "Failed to clock out worker",
      });
    }
  },
);

export const forceClockOut = createAsyncThunk(
  "employerShifts/forceClockOut",
  async ({ shiftId, applicationId, exitTime }, { rejectWithValue }) => {
    try {
      const res = await api.post(
        `/api/shifts/${shiftId}/applications/${applicationId}/force-clock-out`,
        { exitTime },
      );
      return { shiftId, record: res.data.record };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to force clock-out",
      );
    }
  },
);

const employerShiftsSlice = createSlice({
  name: "employerShifts",
  initialState: {
    myShifts: [],
    applicantsByShift: {},
    status: "idle",
    shiftCreatedSuccess: false,
    otpByWorkerId: {},
    otpExpiresAtByWorkerId: {}, // ← NEW
    stats: null,
  },
  reducers: {
    resetSuccessFlag: (state) => {
      state.shiftCreatedSuccess = false;
    },
    // Live: a worker tapped "I've arrived" (socket shift:worker_arrived).
    workerArrived: (state, action) => {
      const { shiftId, applicationId } = action.payload;
      const apps = state.applicantsByShift[shiftId];
      const app = apps?.find((a) => a._id === applicationId);
      if (app) app.arrivedAt = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createShift.fulfilled, (state, action) => {
        state.myShifts.unshift(action.payload);
        state.shiftCreatedSuccess = true;
      })
      .addCase(updateShift.fulfilled, (state, action) => {
        const updated = action.payload;
        const i = state.myShifts.findIndex((s) => s._id === updated._id);
        if (i !== -1) state.myShifts[i] = { ...state.myShifts[i], ...updated };
      })
      .addCase(fetchMyShifts.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMyShifts.fulfilled, (state, action) => {
        state.myShifts = action.payload;
        state.status = "succeeded";
      })
      .addCase(fetchMyShifts.rejected, (state) => {
        state.status = "failed";
      })
       .addCase(fetchEmployerStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      .addCase(fetchApplicants.fulfilled, (state, action) => {
        state.applicantsByShift[action.payload.shiftId] =
          action.payload.applicants;
      })
      .addCase(updateApplicationStatus.fulfilled, (state, action) => {
        const { shiftId, application, shiftStatus } = action.payload;
        const list = state.applicantsByShift[shiftId];
        if (list) {
          const app = list.find((a) => a._id === application._id);
          // CHANGED: merge the whole updated object, not just .status — an
          // accepted application now also carries escrowAmount/escrowStatus
          // that the UI needs immediately, without a full refetch.
          if (app) Object.assign(app, application);
        }
        if (shiftStatus) {
          const shift = state.myShifts.find((s) => s._id === shiftId);
          if (shift) shift.status = shiftStatus;
        }
        toast.success(`Application ${application.status}`);
      })
      .addCase(updateApplicationStatus.rejected, (state, action) => {
        // `silent: true` opts out of the generic error toast — MyShifts
        // shows a dedicated topup modal instead. EmployerDashboard doesn't
        // pass it, so its toast is unchanged.
        if (action.meta.arg?.silent) return;
        toast.error(action.payload || "Failed to update application");
      })
      .addCase(cancelShift.fulfilled, (state, action) => {
        const shift = state.myShifts.find((s) => s._id === action.payload);
        if (shift) shift.status = "cancelled";
        toast.success("Shift cancelled");
      })
      .addCase(cancelShift.rejected, (state, action) => {
        toast.error(action.payload || "Failed to cancel shift");
      })
      .addCase(generateOtp.fulfilled, (state, action) => {
        const { workerId, otp, expiresInMinutes } = action.payload;
        state.otpByWorkerId[workerId] = otp;
        state.otpExpiresAtByWorkerId[workerId] =
          Date.now() + expiresInMinutes * 60 * 1000;
        toast.success("Code generated — share it with the worker");
      })
      .addCase(generateOtp.rejected, (state, action) => {
        toast.error(action.payload || "Failed to generate code");
      })
      .addCase(fetchActiveOtp.fulfilled, (state, action) => {
        const { workerId, otp, expiresAt } = action.payload;
        if (otp) {
          state.otpByWorkerId[workerId] = otp;
          state.otpExpiresAtByWorkerId[workerId] = expiresAt;
        } else {
          delete state.otpByWorkerId[workerId];
          delete state.otpExpiresAtByWorkerId[workerId];
        }
      })
      // NEW
      .addCase(employerCancelApplication.fulfilled, (state, action) => {
        const { shiftId, application, wasLateCancellation } = action.payload;
        const list = state.applicantsByShift[shiftId];
        if (list) {
          const app = list.find((a) => a._id === application._id);
          if (app) Object.assign(app, application);
        }
        toast.success(
          wasLateCancellation
            ? `Worker cancelled — ₹${application.penaltyToWorker} penalty paid, ₹${application.refundToEmployer} refunded`
            : `Worker cancelled — ₹${application.refundToEmployer} refunded in full`,
        );
      })
      .addCase(employerCancelApplication.rejected, (state, action) => {
        toast.error(action.payload || "Failed to cancel worker");
      })
      .addCase(markNoShow.fulfilled, (state, action) => {
        const { shiftId, application } = action.payload;
        const list = state.applicantsByShift[shiftId];
        if (list) {
          const app = list.find((a) => a._id === application._id);
          if (app) Object.assign(app, application);
        }
        toast.success("Marked as no-show — full refund issued");
      })
      .addCase(markNoShow.rejected, (state, action) => {
        toast.error(action.payload || "Failed to mark no-show");
      })
      .addCase(employerClockOut.fulfilled, (state, action) => {
        const { shiftId, workerId, record } = action.payload;
        const list = state.applicantsByShift[shiftId];
        if (list) {
          const app = list.find((a) => a.worker?._id === workerId);
          if (app) {
            app.status = "completed";
            app.shiftRecord = record;
          }
        }
        // OTP no longer relevant once the worker is clocked out.
        delete state.otpByWorkerId[workerId];
        delete state.otpExpiresAtByWorkerId[workerId];
        toast.success(`Clocked out — worker earned ₹${record.amountEarned}`);
      })
      .addCase(employerClockOut.rejected, (state, action) => {
        toast.error(action.payload?.message || "Failed to clock out worker");
      })
      .addCase(forceClockOut.fulfilled, (state, action) => {
        const { shiftId, record } = action.payload;
        const list = state.applicantsByShift[shiftId];
        if (list) {
          const app = list.find((a) => a._id === record.application);
          if (app) {
            app.status = "pending_resolution";
            app.shiftRecord = record;
          }
        }
        toast.success(
          "Force-clocked out — a 24-hour dispute window has started",
        );
      })
      .addCase(forceClockOut.rejected, (state, action) => {
        toast.error(action.payload || "Failed to force clock-out");
      });
  },
});

export const { resetSuccessFlag, workerArrived } = employerShiftsSlice.actions;
export default employerShiftsSlice.reducer;
