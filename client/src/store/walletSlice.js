import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import api from "../api/axios";

// GET /api/wallet/summary -> { balance, held, withdrawable } (rupees).
// This is the source of truth for every wallet number in the UI. The
// `user.walletBalance` copy on the auth user only refreshes on a full
// page load, so it goes stale after any escrow hold / release / top-up.
export const fetchWalletSummary = createAsyncThunk(
  "wallet/fetchSummary",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/api/wallet/summary");
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to load wallet");
    }
  },
);

export const topUpWallet = createAsyncThunk(
  "wallet/topUp",
  async (amount, { dispatch, rejectWithValue }) => {
    let orderId = null;

    // Fire-and-forget: mark this order's pending transaction as failed.
    // Called on dismiss / client-side failure — server checks Razorpay
    // first, so a genuine success is never wrongly marked.
    const markAsFailed = async () => {
      if (!orderId) return;
      try {
        await api.post("/api/wallet/topup/fail", {
          razorpay_order_id: orderId,
        });
      } catch (e) {
        // Silent — the reconciliation cron will clean this up later
        console.warn("topup/fail call failed:", e.message);
      }
    };

    try {
      const { data } = await api.post("/api/wallet/topup/create-order", { amount });
      orderId = data.orderId;

      return await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: "INR",
          order_id: data.orderId,
          name: "Shyftra Wallet Top-up",
          handler: async (response) => {
            try {
              const verifyRes = await api.post("/api/wallet/topup/verify", response);
              toast.success(`₹${verifyRes.data.amount} added to your wallet!`, {
                id: "wallet-topup-success",
              });
              await dispatch(fetchWalletSummary()).unwrap();
               window.dispatchEvent(new CustomEvent("transactions:changed"));
              resolve(verifyRes.data);
            } catch (err) {
              toast.error("Payment verification failed");
              reject(err);
            }
          },
          modal: {
            ondismiss: async () => {
              // ✅ NEW: user closed checkout — clean up the pending row
              await markAsFailed();
              reject(new Error("Payment cancelled by user"));
            },
          },
        });

        rzp.on("payment.failed", async function (response) {
          // ✅ NEW: belt-and-suspenders — mark failed immediately on client
          // side. The webhook may also fire; whichever lands first wins,
          // the other becomes a no-op.
          await markAsFailed();
          toast.error(response.error.description || "Payment failed", {
            id: "wallet-topup-failed",
          });
          reject(new Error(response.error.description || "Payment failed"));
        });

        rzp.open();
      });
    } catch (err) {
      // If order was created but something threw unexpectedly, clean up
      await markAsFailed();
      const message =
        err.response?.data?.error || err.message || "Failed to start payment";
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Helper: turn an axios error into a plain serialisable object for rejectWithValue.
function toRejection(err, fallback) {
  const d = err.response?.data || {};
  return {
    message: d.error || (err.response ? fallback : "Network error — check your connection."),
    code: d.code || (err.response ? null : "NETWORK"),
    retryAfter: d.retryAfter,
    attemptsLeft: d.attemptsLeft,
    cooldownUntil: d.cooldownUntil,
  };
}

// GET /api/wallet/payout-method -> { hasMethod, label, mode, cooldownUntil }
export const fetchPayoutMethod = createAsyncThunk(
  "wallet/fetchPayoutMethod",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/api/wallet/payout-method");
      return data;
    } catch (err) {
      return rejectWithValue(toRejection(err, "Failed to load payout method"));
    }
  },
);

// payload: { type, vpa | accountNumber+ifsc, currentPassword }
// Errors are shown INSIDE the verification modal, so no toast on failure here.
export const addPayoutMethod = createAsyncThunk(
  "wallet/addPayoutMethod",
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post("/api/wallet/payout-method", payload);
      toast.success("Payout method saved. Withdrawals to it unlock in 24 hours.");
      dispatch(fetchPayoutMethod());
      return res.data;
    } catch (err) {
      return rejectWithValue(toRejection(err, "Failed to save payout method"));
    }
  },
);

// Step 1 of cash-out: email a 6-digit code bound to this amount.
export const sendPayoutOtp = createAsyncThunk(
  "wallet/sendPayoutOtp",
  async (amount, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/wallet/payout-otp", { amount });
      return data;
    } catch (err) {
      return rejectWithValue(toRejection(err, "Could not send the code"));
    }
  },
);

// Step 2 of cash-out: payload { amount, otp }
export const requestPayout = createAsyncThunk(
  "wallet/requestPayout",
  async ({ amount, otp }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post("/api/wallet/payout", { amount, otp });
      toast.success(`₹${amount} is on its way!`);
      dispatch(fetchWalletSummary());
       window.dispatchEvent(new CustomEvent("transactions:changed"));
      return res.data;
    } catch (err) {
      // If the response never arrived the payout MAY have happened: refresh numbers.
      if (!err.response) dispatch(fetchWalletSummary());
      return rejectWithValue(toRejection(err, "Payout failed"));
    }
  },
);

const walletSlice = createSlice({
  name: "wallet",
  initialState: {
    summary: null, // { balance, held, withdrawable }
    status: "idle",
    payoutMethod: null, // { hasMethod, label, mode, cooldownUntil }
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWalletSummary.pending, (state) => {
        if (!state.summary) state.status = "loading";
      })
      .addCase(fetchWalletSummary.fulfilled, (state, action) => {
        state.summary = action.payload;
        state.status = "succeeded";
      })
      .addCase(fetchWalletSummary.rejected, (state) => {
        state.status = "failed";
      })
      .addCase(fetchPayoutMethod.fulfilled, (state, action) => {
        state.payoutMethod = action.payload;
      });
  },
});
export default walletSlice.reducer;