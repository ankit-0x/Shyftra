// client/src/store/authModalSlice.js
import { createSlice } from "@reduxjs/toolkit";

const authModalSlice = createSlice({
  name: "authModal",
  initialState: {
    isOpen: false,
    mode: "login", // "login" | "signup"
    // pendingAction is PLAIN DATA ONLY — never a function — because Redux
    // state must be serializable. It describes WHAT the user wanted to do.
    pendingAction: null, // { type, data, inferredRole } | null
  },
  reducers: {
    openAuthModal(state, action) {
      state.isOpen = true;
      state.mode = action.payload?.mode || "login";
      state.pendingAction = action.payload?.pendingAction || null;
    },
    closeAuthModal(state) {
      state.isOpen = false;
    },
    switchAuthMode(state, action) {
      state.mode = action.payload;
    },
    clearPendingAction(state) {
      state.pendingAction = null;
    },
  },
});

export const { openAuthModal, closeAuthModal, switchAuthMode, clearPendingAction } =
  authModalSlice.actions;
export default authModalSlice.reducer;