// client/src/store/disputesSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import api from "../api/axios";

export const fetchMyDisputes = createAsyncThunk("disputes/fetchMine", async (_, { rejectWithValue }) => {
  try {
    const res = await api.get("/api/disputes/mine");
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Failed to load disputes");
  }
});

export const fetchDispute = createAsyncThunk("disputes/fetchOne", async (disputeId, { rejectWithValue }) => {
  try {
    const res = await api.get(`/api/disputes/${disputeId}`);
    return res.data.dispute;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Failed to load dispute");
  }
});

export const submitDisputeEvidence = createAsyncThunk(
  "disputes/submitEvidence",
  async ({ disputeId, files }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      // Deliberately NOT setting a Content-Type header — axios detects a
      // FormData body automatically and sets the multipart boundary
      // itself. Setting "multipart/form-data" manually here would strip
      // that boundary parameter and the server couldn't parse the body.
      const res = await api.post(`/api/disputes/${disputeId}/evidence`, formData);
      toast.success("Proof submitted — an admin will review it");
      return res.data.dispute;
    } catch (err) {
      const message = err.response?.data?.error || "Failed to submit proof";
      toast.error(message);
      return rejectWithValue(message);
    }
  },
);

const disputesSlice = createSlice({
  name: "disputes",
  initialState: { list: [], byId: {}, listStatus: "idle" },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyDisputes.pending, (state) => { state.listStatus = "loading"; })
      .addCase(fetchMyDisputes.fulfilled, (state, action) => {
        state.list = action.payload;
        state.listStatus = "succeeded";
        action.payload.forEach((d) => { state.byId[d._id] = d; });
      })
      .addCase(fetchMyDisputes.rejected, (state) => { state.listStatus = "failed"; })
      .addCase(fetchDispute.fulfilled, (state, action) => {
        state.byId[action.payload._id] = action.payload;
      })
      .addCase(submitDisputeEvidence.fulfilled, (state, action) => {
        state.byId[action.payload._id] = action.payload;
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export default disputesSlice.reducer;