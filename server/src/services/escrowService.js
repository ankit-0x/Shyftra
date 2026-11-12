// server/src/services/escrowService.js
import { adjustWallet, creditPlatform } from "./walletService.js";
import { PLATFORM_FEE_FLAT } from "../config/businessRules.js";
import { HttpError } from "../utils/HttpError.js";

export async function chargePlatformFee({ employerUserId, shiftId, session }) {
  await adjustWallet({
    userId: employerUserId,
    delta: -PLATFORM_FEE_FLAT,
    type: "platform_fee",
    amount: PLATFORM_FEE_FLAT,
    shift: shiftId,
    session,
  });


  // NEW: the fee has to land somewhere. Same transaction, same session —
  // these two writes commit or roll back together, never independently.
  await creditPlatform({
    delta: PLATFORM_FEE_FLAT, type: "platform_fee", amount: PLATFORM_FEE_FLAT,
    shift: shiftId, session,
  });

  return PLATFORM_FEE_FLAT;
}

/**
 * Locks the full possible payout for one accepted worker out of the
 * employer's wallet, and snapshots the shift's economics onto the
 * Application so later payout math never has to trust the live Shift doc
 * (see ground rule #2 from the models message).
 */
export async function lockEscrow({ application, shift, employerUserId, session }) {
  const hours = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
const maxPayout = Math.round(hours * shift.hourlyPay); // integer paise

  // NEW: reject inverted or zero-length shifts before we ever touch wallets.
  // Without this, hours <= 0 makes maxPayout <= 0, and the delta below
  // becomes -maxPayout which is POSITIVE — credits the employer instead of
  // debiting them. Same class of bug for NaN/Infinity from corrupted docs.
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new HttpError(400, "Shift has an invalid duration; cannot lock escrow");
  }
  if (!Number.isFinite(maxPayout) || maxPayout <= 0) {
    throw new HttpError(400, "Computed escrow amount is invalid");
  }

  await adjustWallet({
    userId: employerUserId,
    delta: -maxPayout,
    type: "escrow_lock",
    amount: maxPayout,
    shift: shift._id,
    application: application._id,
    session,
  });

  application.maxPayout = maxPayout;
  application.escrowAmount = maxPayout;
  application.escrowStatus = "locked";
  application.escrowLockedAt = new Date();
  application.hourlyPayAtLock = shift.hourlyPay;
  application.scheduledStartAtLock = shift.startTime;
  application.scheduledEndAtLock = shift.endTime;
  application.status = "accepted";
  await application.save({ session });

  return application;
}