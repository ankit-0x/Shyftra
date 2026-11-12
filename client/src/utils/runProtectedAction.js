// client/src/utils/runProtectedAction.js
import { store } from "../store/store";
import { openAuthModal, closeAuthModal } from "../store/authModalSlice";
import { actionExecutors } from "./actionExecutors";

import {
  PLATFORM_FEE_FLAT,
  FREE_SHIFTS_LIMIT,
} from "../constants/businessRule";

const PENDING_POST_SHIFT_KEY = "shyftra_pending_post_shift";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export function savePendingPostShift(payload) {
  try {
    localStorage.setItem(
      PENDING_POST_SHIFT_KEY,
      JSON.stringify({ payload, savedAt: Date.now() }),
    );
  } catch {
    // ignore
  }
}

export function getPendingPostShift() {
  try {
    const raw = localStorage.getItem(PENDING_POST_SHIFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(PENDING_POST_SHIFT_KEY);
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export function clearPendingPostShift() {
  try {
    localStorage.removeItem(PENDING_POST_SHIFT_KEY);
  } catch {
    // ignore
  }
}

export function runProtectedAction(type, data) {
  const { user } = store.getState().auth;
  const { summary } = store.getState().wallet;

 

  // ---- Gate 1: LOGIN ----
  if (!user) {
   
    if (type === "post_shift") savePendingPostShift(data);
    const inferredRole = type === "post_shift" ? "employer" : "worker";
    store.dispatch(
      openAuthModal({
        mode: "signup",
        pendingAction: { type, data, inferredRole },
      }),
    );
    return;
  }

  // ---- Gate 2: VERIFICATION ----
  if (user.verificationStatus !== "verified") {
   
    if (type === "post_shift") savePendingPostShift(data);
    store.dispatch(
      openAuthModal({
        mode: "verify_prompt",
        pendingAction: { type, data, inferredRole: user.role },
      }),
    );
    return;
  }

   // ---- Gate 3: WALLET (only for post_shift) ----
  if (type === "post_shift") {
   
    let walletBalancePaise;
    if (typeof summary?.balance === "number") {
      walletBalancePaise = Math.round(summary.balance * 100); // rupees → paise
    } else if (typeof user.walletBalance === "number") {
      walletBalancePaise = Math.round(user.walletBalance * 100); // rupees → paise
    } else {
      walletBalancePaise = 0;
    }

    const feeInPaise = PLATFORM_FEE_FLAT * 100; // rupees → paise
    const freeShiftsUsed = user.freeShiftsUsed ?? 0;
    const isFreebie = freeShiftsUsed < FREE_SHIFTS_LIMIT;

    if (!isFreebie && walletBalancePaise < feeInPaise) {
     
      savePendingPostShift(data);
      store.dispatch(
        openAuthModal({
          mode: "topup_prompt",
          pendingAction: { type, data, inferredRole: user.role },
        }),
      );
      return;
    }
  }

  // ---- All gates passed → execute ----
 
  actionExecutors[type](data);

  if (type === "post_shift") clearPendingPostShift();

  // Ensure modal is closed (in case we came here from auth flow)
  store.dispatch(closeAuthModal());
}

