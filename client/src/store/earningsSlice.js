// client/src/store/earningsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../api/axios";

export const fetchEarningsSummary = createAsyncThunk(
  "earnings/fetchSummary",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/earnings/summary");
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load earnings");
    }
  }
);

export const fetchEarningsStats = createAsyncThunk(
  "earnings/fetchStats",
  async (period = "daily", { rejectWithValue }) => {
    try {
      const res = await api.get("/api/earnings/stats", { params: { period } });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load stats");
    }
  }
);

export const fetchShiftHistory = createAsyncThunk(
  "earnings/fetchHistory",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/earnings/history");
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load history");
    }
  }
);

// ✅ NEW: compensation history (cancellation penalties, dispute payouts)
export const fetchCompensationHistory = createAsyncThunk(
  "earnings/fetchCompensations",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/earnings/compensations");
      
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load compensations"
      );
    }
  }
);

const earningsSlice = createSlice({
  name: "earnings",
  initialState: {
    summary: {},
    stats: [],
    history: [],
    compensations: [],   // ✅ NEW
    status: {
      summary: "idle",
      stats: "idle",
      history: "idle",
      compensations: "idle",   // ✅ NEW
    },
    error: null,
  },
  reducers: {
    clearEarningsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- SUMMARY ---
      .addCase(fetchEarningsSummary.pending, (state) => {
        state.status.summary = "loading";
        state.error = null;
      })
      .addCase(fetchEarningsSummary.fulfilled, (state, action) => {
        state.status.summary = "succeeded";
        state.summary = action.payload;
      })
      .addCase(fetchEarningsSummary.rejected, (state, action) => {
        state.status.summary = "failed";
        state.error = action.payload;
      })

      // --- STATS ---
      .addCase(fetchEarningsStats.pending, (state) => {
        state.status.stats = "loading";
        state.error = null;
      })
      .addCase(fetchEarningsStats.fulfilled, (state, action) => {
        state.status.stats = "succeeded";
        state.stats = action.payload;
      })
      .addCase(fetchEarningsStats.rejected, (state, action) => {
        state.status.stats = "failed";
        state.error = action.payload;
      })

      // --- HISTORY ---
      .addCase(fetchShiftHistory.pending, (state) => {
        state.status.history = "loading";
        state.error = null;
      })
      .addCase(fetchShiftHistory.fulfilled, (state, action) => {
        state.status.history = "succeeded";
        state.history = action.payload;
      })
      .addCase(fetchShiftHistory.rejected, (state, action) => {
        state.status.history = "failed";
        state.error = action.payload;
      })

      // --- COMPENSATIONS ✅ NEW ---
      .addCase(fetchCompensationHistory.pending, (state) => {
        state.status.compensations = "loading";
        state.error = null;
      })
      .addCase(fetchCompensationHistory.fulfilled, (state, action) => {
        state.status.compensations = "succeeded";
        state.compensations = action.payload;
      })
      .addCase(fetchCompensationHistory.rejected, (state, action) => {
        state.status.compensations = "failed";
        state.error = action.payload;
      });
  },
});

export const { clearEarningsError } = earningsSlice.actions;
export default earningsSlice.reducer;