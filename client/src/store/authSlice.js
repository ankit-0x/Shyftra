// client/src/store/authSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../api/axios";

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/auth/me");
      return res.data.user ?? null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Not logged in");
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const res = await api.post("/api/auth/login", credentials);
      return res.data.user;
    } catch (err) {
      const d = err.response?.data;
      // code lets the UI offer "Resend verification email" for EMAIL_NOT_VERIFIED.
      return rejectWithValue({
        message: d?.error || "Login failed",
        code: d?.code ?? null,
        email: d?.email ?? null,
      });
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/register",
  async (payload, { rejectWithValue }) => {
    try {
      // The server no longer logs you in: it emails a verification link.
      const res = await api.post("/api/auth/register", payload);
      return { email: res.data.email ?? payload.email };
    } catch (err) {
      return rejectWithValue({
        message: err.response?.data?.error || "Registration failed",
        code: null,
        email: null,
      });
    }
  },
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  // Even if the request fails (offline), the UI must log out locally —
  // see the rejected case in extraReducers.
  await api.post("/api/auth/logout");
});

// PATCH /api/auth/change-password. The server answers 400 (never 401) for a wrong
// current password, so the axios interceptor does not mistake it for an expired session.
export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async (values, { rejectWithValue }) => {
    try {
      const res = await api.patch("/api/auth/change-password", values);
      return res.data;
    } catch (err) {
      const d = err.response?.data;
      return rejectWithValue({
        message: d?.error || "Could not change password",
        code: d?.code ?? null,
      });
    }
  },
);

// 🆕 Log out from ALL devices — backend bumps tokenVersion, kills sockets,
// clears this device's cookies. Frontend just resets local state.
export const logoutAllDevices = createAsyncThunk(
  "auth/logoutAllDevices",
  async (_, { rejectWithValue }) => {
    try {
      await api.post("/api/auth/logout-all");
      return true;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to log out from all devices",
      );
    }
  },
);

// ---- Change email (password re-auth -> code to NEW address -> verify) ----
// Errors come back as { message, code, retryAfter?, attemptsLeft? } so the UI
// can react to specific codes (WRONG_CURRENT_PASSWORD, SAME_EMAIL, OTP_COOLDOWN,
// OTP_INVALID, OTP_LOCKED, OTP_EXPIRED, OTP_NOT_REQUESTED, OTP_ALREADY_USED,
// EMAIL_CHANGE_CONFLICT, RATE_LIMITED, NETWORK).
function emailFlowError(err, fallback) {
  const d = err.response?.data;
  return {
    message: d?.error || fallback,
    code: d?.code ?? (err.response ? null : "NETWORK"),
    retryAfter: d?.retryAfter ?? null,
    attemptsLeft: d?.attemptsLeft ?? null,
  };
}

export const requestEmailChange = createAsyncThunk(
  "auth/requestEmailChange",
  async (values, { rejectWithValue }) => {
    try {
      const res = await api.post("/api/auth/change-email/request", values);
      return res.data; // { message, expiresInSeconds, resendInSeconds }
    } catch (err) {
      return rejectWithValue(emailFlowError(err, "Could not send the code"));
    }
  },
);

export const resendEmailChange = createAsyncThunk(
  "auth/resendEmailChange",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.post("/api/auth/change-email/resend");
      return res.data; // { message, expiresInSeconds, resendInSeconds }
    } catch (err) {
      return rejectWithValue(emailFlowError(err, "Could not resend the code"));
    }
  },
);

export const verifyEmailChange = createAsyncThunk(
  "auth/verifyEmailChange",
  async (code, { rejectWithValue }) => {
    try {
      const res = await api.post("/api/auth/change-email/verify", { code });
      return res.data; // { message, email, otherSessionsRevoked }
    } catch (err) {
      return rejectWithValue(emailFlowError(err, "Could not change your email"));
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    status: "idle",
    error: null,
    errorCode: null, // e.g. "EMAIL_NOT_VERIFIED"
    errorEmail: null, // email to resend verification to
    pendingVerificationEmail: null, // set after signup -> "check your email" screen
    authChecked: false,
  },
  reducers: {
    // NEW — the only functional change. Lets AuthModal clear a stale
    // error without needing a whole new failed/succeeded submit cycle.
    clearAuthError(state) {
      state.error = null;
      state.errorCode = null;
      state.errorEmail = null;
    },
    clearPendingVerification(state) {
      state.pendingVerificationEmail = null;
    },
    // ✅ NEW: hard-reset auth state when the refresh token is dead.
    clearAuth(state) {
      state.user = null;
      state.status = "idle";
      state.error = null;
      state.authChecked = true;
      try {
        localStorage.removeItem("shyftra_session_active");
      } catch {
         /* localStorage can throw in private mode / when storage is disabled */
      }
    },

    // ✅ NEW: Increment freeShiftsUsed locally (avoids extra /me call).
    // Called after successful post_shift to update freebie counter.
    incrementFreeShifts(state) {
      if (state.user && state.user.role === "employer") {
        state.user.freeShiftsUsed = (state.user.freeShiftsUsed ?? 0) + 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload ?? null;
        state.status = action.payload ? "succeeded" : "idle";
        state.authChecked = true;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.status = "idle";
        state.authChecked = true;
      })
      .addCase(loginUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
        state.errorCode = null;
        state.errorEmail = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "succeeded";
        try {
          localStorage.setItem("shyftra_session_active", "1");
        } catch {
           /* localStorage can throw in private mode / when storage is disabled */
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload?.message ?? "Login failed";
        state.errorCode = action.payload?.code ?? null;
        state.errorEmail = action.payload?.email ?? null;
      })
      .addCase(registerUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        // NOT logged in: just remember which inbox to tell the user to check.
        state.pendingVerificationEmail = action.payload.email;
        state.status = "idle";
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload?.message ?? "Registration failed";
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.status = "idle";
        try {
          localStorage.removeItem("shyftra_session_active");
        } catch {
           /* localStorage can throw in private mode / when storage is disabled */
        }
      })
      // BUG FIX: logout used to do nothing when the request failed (e.g. expired
      // access token) so the user stayed "logged in" in the UI.
      .addCase(logoutUser.rejected, (state) => {
        state.user = null;
        state.status = "idle";
        try {
          localStorage.removeItem("shyftra_session_active");
        } catch {
           /* localStorage can throw in private mode / when storage is disabled */
        }
      })
       .addCase(logoutAllDevices.fulfilled, (state) => {
        state.user = null;
        state.status = "idle";
        try {
          localStorage.removeItem("shyftra_session_active");
        } catch {
           /* localStorage can throw in private mode / when storage is disabled */
        }
      })
      // Email change succeeded — the user object in Redux still carries the
      // old address until the next fetchMe. Patch it in place.
      .addCase(verifyEmailChange.fulfilled, (state, action) => {
        if (state.user) state.user.email = action.payload.email;
      })

       // ✅ NEW: Profile uploads ko auth.user ke saath sync karo
      .addMatcher(
        (a) => a.type === "profile/uploadAvatar/fulfilled",
        (state, action) => {
          if (state.user) state.user.avatarUrl = action.payload;
        }
      )
      .addMatcher(
        (a) => a.type === "profile/uploadVerificationDoc/fulfilled",
        (state, action) => {
          if (state.user) state.user.verificationStatus = action.payload;
        }
      );
  },
});

export const {
  clearAuthError,
  clearPendingVerification,
  clearAuth,
  incrementFreeShifts,
} = authSlice.actions;
export default authSlice.reducer;
