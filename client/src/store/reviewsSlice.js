// client/src/store/reviewsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import api from "../api/axios";

export const fetchMyReviews = createAsyncThunk(
  "reviews/fetchMine",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/api/reviews/mine");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load reviews",
      );
    }
  },
);

export const submitReview = createAsyncThunk(
  "reviews/submit",
  async ({ shiftId, revieweeId, rating, comment }, { rejectWithValue, dispatch }) => {
    const key = `${shiftId}:${revieweeId}`;
    try {
      await api.post(`/api/shifts/${shiftId}/review`, {
        revieweeId,
        rating,
        comment,
      });
      toast.success("Thanks for your feedback!");

      // Refetch so "Reviews I've Given" instantly includes the new entry
      // with populated reviewee + shift data.
      dispatch(fetchMyReviews());

      return key;
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.error || "Failed to submit review";

      // 409 = duplicate. Treat as success so the button hides.
      if (status === 409) return key;

      toast.error(message);
      return rejectWithValue({ key, message });
    }
  },
);

export const fetchUserReviews = createAsyncThunk(
  "reviews/fetchForUser",
  async ({ userId, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(
        `/api/reviews/user/${userId}?page=${page}&limit=${limit}`,
      );
      return { userId, ...data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load reviews",
      );
    }
  },
);

const reviewsSlice = createSlice({
  name: "reviews",
  initialState: {
    reviewedKeys: [],
    myReviews: [],
    fetchStatus: "idle",
    submitStatus: "idle",
    reviewsByUserId: {}, // { [userId]: { reviews: [], total: 0 } }
    userReviewsStatus: {}, // { [userId]: "loading" | "succeeded" | "failed" }
  },
  reducers: {
    clearReviews: (state) => {
      state.reviewedKeys = [];
      state.myReviews = [];
      state.fetchStatus = "idle";
      state.submitStatus = "idle";
      state.reviewsByUserId = {};
      state.userReviewsStatus = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // --- fetchMyReviews ---
      .addCase(fetchMyReviews.pending, (state) => {
        state.fetchStatus = "loading";
      })
      .addCase(fetchMyReviews.fulfilled, (state, action) => {
        state.fetchStatus = "succeeded";
        state.myReviews = action.payload;

        // Derive compound keys from populated docs for button hiding
        state.reviewedKeys = action.payload.map(
          (r) => `${r.shift._id}:${r.reviewee._id}`,
        );
      })
      .addCase(fetchMyReviews.rejected, (state) => {
        state.fetchStatus = "failed";
      })

      // --- submitReview ---
      .addCase(submitReview.pending, (state) => {
        state.submitStatus = "loading";
      })
      .addCase(submitReview.fulfilled, (state, action) => {
        state.submitStatus = "idle";
        if (!state.reviewedKeys.includes(action.payload)) {
          state.reviewedKeys.push(action.payload);
        }
        // Note: no need to manually push into myReviews — the thunk
        // refetches fetchMyReviews, which repopulates it with fresh data.
      })
      .addCase(submitReview.rejected, (state) => {
        state.submitStatus = "idle";
      })

      // --- fetchUserReviews ---
      .addCase(fetchUserReviews.pending, (state, action) => {
        state.userReviewsStatus[action.meta.arg.userId] = "loading";
      })
      .addCase(fetchUserReviews.fulfilled, (state, action) => {
        const { userId, reviews, total, page } = action.payload;
        state.userReviewsStatus[userId] = "succeeded";

        if (page === 1) {
          state.reviewsByUserId[userId] = { reviews, total };
        } else {
          const existing = state.reviewsByUserId[userId];
          if (existing) {
            existing.reviews = [...existing.reviews, ...reviews];
            existing.total = total;
          } else {
            state.reviewsByUserId[userId] = { reviews, total };
          }
        }
      })
      .addCase(fetchUserReviews.rejected, (state, action) => {
        state.userReviewsStatus[action.meta.arg.userId] = "failed";
      });
  },
});

export const { clearReviews } = reviewsSlice.actions;
export default reviewsSlice.reducer;