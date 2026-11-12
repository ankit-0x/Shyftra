// client/src/store/transactionSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../api/axios";

export const fetchTransactions = createAsyncThunk(
  "transactions/fetch",
  async ({ page = 1, limit = 20, direction, append = false }, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/api/transactions", {
        params: { page, limit, direction },
      });
      return { ...data, append };
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load transactions");
    }
  }
);

const transactionSlice = createSlice({
  name: "transactions",
    initialState: {
    list: [],
    page: 1,
    total: 0,
    hasMore: false,
    totals: {
      credit: { total: 0, count: 0 },
      debit: { total: 0, count: 0 },
    },
    status: "idle",
    error: null,
  },
  reducers: {
    resetTransactions(state) {
      state.list = [];
      state.page = 1;
      state.total = 0;
      state.hasMore = false;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
            .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.status = "succeeded";
        const { transactions, page, total, hasMore, append, totals } =
          action.payload;
        state.list = append ? [...state.list, ...transactions] : transactions;
        state.page = page;
        state.total = total;
        state.hasMore = hasMore;
        if (totals) state.totals = totals;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      });
  },
});

export const { resetTransactions } = transactionSlice.actions;
export default transactionSlice.reducer;