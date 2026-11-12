// client/src/store/attendanceSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import api from "../api/axios";
import { fetchMyApplications } from "./applicationsSlice";

export const clockIn = createAsyncThunk(
  "attendance/clockIn",
  async ({ shiftId, otp }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post(`/api/shifts/${shiftId}/clock-in`, { otp });
      toast.success("Clocked in!");
      dispatch(fetchMyApplications());
      return res.data.record;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to clock in";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

// NEW — replaces the old worker-side clockOut. The worker now generates
// their OWN exit code (mirroring how the employer generates the entry
// code) rather than clocking themselves out directly.
export const generateExitOtp = createAsyncThunk(
  "attendance/generateExitOtp",
  async (shiftId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/api/shifts/${shiftId}/generate-exit-otp`);
      return {
        shiftId,
        otp: res.data.otp,
        expiresInMinutes: res.data.expiresInMinutes ?? 15,
      };
    } catch (err) {
      const message =
        err.response?.data?.error || "Failed to generate exit code";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

export const fetchActiveExitOtp = createAsyncThunk(
  "attendance/fetchActiveExitOtp",
  async (shiftId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/api/shifts/${shiftId}/active-otp`, {
        params: { purpose: "exit" },
      });
      return {
        shiftId,
        otp: res.data.otp ?? null,
        expiresAt: res.data.expiresAt ?? null,
      };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load active exit code",
      );
    }
  },
);

// NEW — the worker's response to a Force Clock-Out they disagree with.
export const raiseDispute = createAsyncThunk(
  "attendance/raiseDispute",
  async ({ shiftRecordId, reason, claimedTime }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post(
        `/api/disputes/shift-record/${shiftRecordId}`,
        { reason, claimedTime }, // 👈 Pass claimedTime
      );
      toast.success("Dispute raised — your employer has 48 hours to respond");
      dispatch(fetchMyApplications());
      return res.data.dispute;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to raise dispute";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

const attendanceSlice = createSlice({
  name: "attendance",
  initialState: {
    exitOtpByShiftId: {},
    exitOtpExpiresAtByShiftId: {}, // ← NEW
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(generateExitOtp.fulfilled, (state, action) => {
        const { shiftId, otp, expiresInMinutes } = action.payload;
        const expires = expiresInMinutes ?? 15; // ← add
        state.exitOtpByShiftId[shiftId] = otp;
        state.exitOtpExpiresAtByShiftId[shiftId] =
          Date.now() + expires * 60 * 1000;
      })
      .addCase(fetchActiveExitOtp.fulfilled, (state, action) => {
        const { shiftId, otp, expiresAt } = action.payload;
        if (otp) {
          state.exitOtpByShiftId[shiftId] = otp;
          state.exitOtpExpiresAtByShiftId[shiftId] = expiresAt;
        } else {
          delete state.exitOtpByShiftId[shiftId];
          delete state.exitOtpExpiresAtByShiftId[shiftId];
        }
      })
      // Once the worker clocks out, the exit OTP is no longer relevant.
      .addCase("applications/workerCancel/fulfilled", (state, action) => {
        const shiftId = action.payload?.shiftId;
        if (shiftId) {
          delete state.exitOtpByShiftId[shiftId];
          delete state.exitOtpExpiresAtByShiftId[shiftId];
        }
      });
  },
});

export default attendanceSlice.reducer;
