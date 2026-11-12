// server/src/controllers/walletController.js
import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { razorpayXRequest } from "../config/razorpayx.js";
import mongoose from "mongoose";
import {
  adjustWallet,
  InsufficientFundsError,
} from "../services/walletService.js";
import { HttpError } from "../utils/HttpError.js";
import {
  MIN_WITHDRAWAL,
  MAX_WITHDRAWAL,
  MAX_TOPUP,
  TOPUP_HOLD_HOURS,
  EARNINGS_HOLD_HOURS,
} from "../config/businessRules.js";
import { computeWithdrawable } from "../services/withdrawalService.js";
import { z } from "zod";
import {
  sendPayoutOtp,
  verifyAndConsumePayoutOtp,
  verifyCurrentPassword,
  maskVpa,
  maskAccount,
  CLEAR_PAYOUT_OTP,
  PAYOUT_COOLDOWN_MS,
} from "../services/payoutVerification.js";
import { logSecurityEvent } from "../utils/securityAudit.js";
import { sendMailSafely } from "../utils/mailer.js";
import {
  payoutMethodChangedTemplate,
  payoutRequestedTemplate,
  payoutCompletedTemplate,
  payoutFailedTemplate,
} from "../utils/emailTemplates.js";
import { safeEmit } from "../utils/notify.js";

import { logError, logWarn } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function parseMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (Math.round(n * 100) / 100 !== n) return null;
  return n;
}

function toPaise(rupees) {
  return Math.round(rupees * 100);
}

function toRupees(paise) {
  return paise / 100;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ""), "utf8");
  const y = Buffer.from(String(b ?? ""), "utf8");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function payoutFilter(entity) {
  const or = [{ razorpayPayoutId: entity.id }];
  if (entity.reference_id && mongoose.isValidObjectId(entity.reference_id)) {
    or.push({ _id: entity.reference_id });
  }
  return { $or: or, type: "withdrawal" };
}

// ---------------------------------------------------------------------------
// Webhook-only helpers — isolated from the rest of the file
// ---------------------------------------------------------------------------

// Extracts a human-readable failure reason from a RazorpayX payout entity.
function extractPayoutFailureReason(entity, fallback) {
  return (
    entity.status_details?.description ||
    entity.status_details?.reason ||
    entity.failure_reason ||
    fallback
  );
}

// Builds a human-readable failure reason from a Razorpay payment entity.
//
// Razorpay inconsistency we've observed:
//   - Netbanking / UPI failures → error_description contains a real message
//     from the bank ("Your payment didn't go through as it was declined...").
//   - Card failures → error_description is the literal string "Payment failed",
//     with error_step = "payment_authorization" and error_source = "gateway".
//
// So we only trust error_description if it's genuinely informative. Otherwise
// we compose a method + source-aware message using error_step / error_source.
function buildPaymentFailureReason(payment) {
  const desc = String(payment.error_description ?? "").trim();
  const step = payment.error_step;
  const source = payment.error_source;
  const method = payment.method;

  // Description is only useful if it's not the generic "Payment failed"
  // (Razorpay sends this for cards) and has real content.
  const genericDesc =
    !desc ||
    /^payment failed\.?$/i.test(desc) ||
    /^payment was declined\.?$/i.test(desc) ||
    desc.length < 20;

  if (!genericDesc) return desc;

  // Context-based message using step + source + method
  if (step === "payment_authorization") {
    if (source === "bank") {
      return "Your bank declined the payment. Try another payment method or contact your bank.";
    }
    if (method === "card") {
      return "Card payment was rejected by the payment network. Check your card details or try another method.";
    }
    if (method === "netbanking") {
      return "Netbanking payment was declined. Try another bank or payment method.";
    }
    if (method === "upi") {
      return "UPI payment was declined. Verify the UPI ID or try another method.";
    }
    if (method === "wallet") {
      return "Wallet payment was declined. Try another wallet or payment method.";
    }
    return "Payment was declined. Please try another payment method.";
  }

  if (step === "authentication") {
    return "Payment authentication failed — please verify the OTP and try again.";
  }

  // If somehow we have a description but it's generic, still better than blank
  if (desc) return desc;

  return "Payment could not be completed. Please try again or use a different method.";
}

// Builds an atomic update-pipeline for terminal payout events.
//
// Uses `$ifNull` on `razorpayPayoutId` because that field has a UNIQUE
// partial index. If the incoming `entity.id` differs from what we stored
// at request time (rare, but possible in edge cases), a plain `$set`
// would throw E11000 and abort the whole refund. `$ifNull` keeps the
// existing value when present, so the write is always unique-index safe.
function buildPayoutTerminalUpdate({ status, failureReason, payoutId }) {
  return [
    {
      $set: {
        status,
        ...(failureReason != null && {
          failureReason: { $literal: failureReason },
        }),
        razorpayPayoutId: {
          $ifNull: ["$razorpayPayoutId", { $literal: payoutId }],
        },
      },
    },
  ];
}

// Marks a pending/processing withdrawal as failed and refunds the wallet.
// Returns { userId, amount } (paise) if a refund occurred, otherwise null.
async function refundFailedPayout(entity, failureReason) {
  const session = await mongoose.startSession();
  let userId = null;
  let amount = 0;
  try {
    await session.withTransaction(async () => {
      const transaction = await Transaction.findOneAndUpdate(
        {
          ...payoutFilter(entity),
          status: { $in: ["pending", "processing"] },
        },
        buildPayoutTerminalUpdate({
          status: "failed",
          failureReason,
          payoutId: entity.id,
        }),
        { returnDocument: "after", session, updatePipeline: true },
      );

      if (!transaction) return;

      await adjustWallet({
        userId: transaction.user,
        delta: transaction.amount,
        type: "payout_reversal",
        amount: transaction.amount,
        session,
      });

      userId = transaction.user;
      amount = transaction.amount;
    });
  } finally {
    session.endSession();
  }
  return userId ? { userId, amount } : null;
}

// Fire-and-forget email helpers (never block the webhook response)
async function sendPayoutSuccessEmail(tx) {
  try {
    const user = await User.findById(tx.user).select("name email");
    if (!user?.email) return;
    sendMailSafely({
      to: user.email,
      ...payoutCompletedTemplate({
        name: user.name,
        amount: (tx.amount / 100).toFixed(2),
        label: "your bank account",
      }),
    });
  } catch (err) {
    logError("sendPayoutSuccessEmail failed:", err);
  }
}

async function sendPayoutFailedEmail(userId, amountPaise, reason) {
  try {
    const user = await User.findById(userId).select("name email");
    if (!user?.email) return;
    sendMailSafely({
      to: user.email,
      ...payoutFailedTemplate({
        name: user.name,
        amount: (amountPaise / 100).toFixed(2),
        reason,
      }),
    });
  } catch (err) {
    logError("sendPayoutFailedEmail failed:", err);
  }
}

// ---------------------------------------------------------------------------
// TOP-UP (money IN) — unchanged
// ---------------------------------------------------------------------------

export async function createTopupOrder(req, res) {
  const amount = parseMoney(req.body.amount);
  const amountPaise = amount == null ? null : toPaise(amount);

  if (!amountPaise || amountPaise < 100 || amountPaise > MAX_TOPUP) {
    return res.status(400).json({
      error: `Enter an amount between ₹1 and ₹${MAX_TOPUP / 100} (at most 2 decimals)`,
    });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `topup_${req.user._id}_${Date.now()}`,
    });

    await Transaction.create({
      user: req.user._id,
      type: "topup",
      direction: "credit",
      amount: amountPaise,
      status: "pending",
      razorpayOrderId: order.id,
    });

    res.locals.rawMoney = true;
    res.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    logError("walletController:278", err);
    res.status(500).json({ error: "Failed to create payment order" });
  }
}

export async function verifyTopup(req, res) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;
  if (
    ![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(
      (v) => typeof v === "string" && v,
    )
  ) {
    return res.status(400).json({ error: "Payment verification failed" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (!safeEqual(expectedSignature, razorpay_signature)) {
    return res.status(400).json({ error: "Payment verification failed" });
  }

  const session = await mongoose.startSession();
  let response;
  let txUserId = null;
  let txAmount = 0;

  try {
    await session.withTransaction(async () => {
      // ✅ FIX: allow "failed" → "success" so retry-on-same-order works.
      // Also clear failureReason so the UI doesn't show a stale error
      // message on a now-successful transaction.
      const tx = await Transaction.findOneAndUpdate(
        {
          razorpayOrderId: razorpay_order_id,
          user: req.user._id,
          status: { $in: ["pending", "failed"] }, // ✅
        },
        {
          status: "success",
          razorpayPaymentId: razorpay_payment_id,
          failureReason: null, // ✅ clear stale reason
        },
        { returnDocument: "after", session },
      );

      if (!tx) {
        const existing = await Transaction.findOne({
          razorpayOrderId: razorpay_order_id,
          user: req.user._id,
        }).session(session);

        if (!existing) throw new HttpError(404, "Transaction not found");

        // Already success — idempotent
        response = {
          success: true,
          amount: toRupees(existing.amount),
          note: "Already verified",
        };
        return;
      }

      await adjustWallet({
        userId: req.user._id,
        delta: tx.amount,
        type: "topup",
        amount: tx.amount,
        transactionId: tx._id,
        session,
      });

      txUserId = tx.user;
      txAmount = tx.amount;
      response = { success: true, amount: toRupees(tx.amount) };
    });

    // ✅ FIX: emit AFTER commit so socket event reaches the client
    // and the transaction page + dashboard refresh instantly.
    if (txUserId) {
      safeEmit(txUserId, "wallet:updated", {
        reason: "topup",
        amount: txAmount,
      });
    }

    res.locals.rawMoney = true;
    res.json(response);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    logError("walletController:373", err);
    res.status(500).json({ error: "Failed to verify payment" });
  } finally {
    session.endSession();
  }
}

// POST /api/wallet/topup/fail
// Called by the client when checkout is dismissed or a payment is rejected
// BEFORE a webhook can fire (e.g. checkout-level validation errors, wrong
// payment method, user closes modal without paying).
//
// Safety: queries Razorpay BEFORE marking failed, so a payment that actually
// succeeded (but where the checkout was closed before redirect) is never
// wrongly marked as failed.
export async function failTopup(req, res) {
  const { razorpay_order_id } = req.body;
  if (typeof razorpay_order_id !== "string" || !razorpay_order_id) {
    return res.status(400).json({ error: "order_id required" });
  }

  try {
    // Belt-and-suspenders: ask Razorpay if a payment was actually made.
    // If yes → don't touch the transaction (webhook / verify will handle it).
    let alreadyPaid = false;
    try {
      const payments = await razorpay.orders.fetchPayments(razorpay_order_id);
      alreadyPaid = (payments?.items ?? []).some(
        (p) => p.status === "captured" || p.status === "authorized",
      );
    } catch (razorpayErr) {
      // Can't confirm with Razorpay — leave pending, let webhook resolve later
      logWarn("failTopup: Razorpay lookup failed:", razorpayErr);
      return res.json({ ok: false, note: "Deferred to webhook" });
    }

    if (alreadyPaid) {
      return res.json({ ok: false, note: "Payment exists — will reconcile" });
    }

    const failed = await Transaction.findOneAndUpdate(
      {
        razorpayOrderId: razorpay_order_id,
        user: req.user._id,
        status: "pending",
      },
      {
        status: "failed",
        failureReason: "Payment was cancelled or rejected before completion",
      },
      { returnDocument: "after" },
    );

    if (failed) {
      safeEmit(failed.user, "wallet:updated", {
        reason: "topup_failed",
        amount: failed.amount,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    logError("failTopup error:", err);
    res.status(500).json({ error: "Failed to mark transaction" });
  }
}

// ---------------------------------------------------------------------------
// PAYOUT / WITHDRAW (money OUT) — unchanged
// ---------------------------------------------------------------------------

const payoutMethodSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("vpa"),
    vpa: z
      .string()
      .trim()
      .regex(
        /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/,
        "Enter a valid UPI ID (e.g. name@bank)",
      ),
    currentPassword: z.string().min(1, "Password is required").max(128),
  }),
  z.object({
    type: z.literal("bank_account"),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{9,18}$/, "Account number must be 9-18 digits"),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
    currentPassword: z.string().min(1, "Password is required").max(128),
  }),
]);

export async function getPayoutMethod(req, res) {
  const u = await User.findById(req.user._id).select(
    "+razorpayFundAccountId payoutMode payoutMethodLabel payoutCooldownUntil",
  );
  res.json({
    hasMethod: !!u?.razorpayFundAccountId,
    label: u?.payoutMethodLabel ?? null,
    mode: u?.payoutMode ?? null,
    cooldownUntil:
      u?.payoutCooldownUntil && u.payoutCooldownUntil > new Date()
        ? u.payoutCooldownUntil
        : null,
  });
}

export async function addPayoutMethod(req, res) {
  const parsed = payoutMethodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  }
  const input = parsed.data;

  if (!(await verifyCurrentPassword(req.user._id, input.currentPassword))) {
    await logSecurityEvent(req, req.user._id, "payout_reauth_failed", {
      action: "payout_method",
    });
    return res
      .status(403)
      .json({ error: "Incorrect password", code: "REAUTH_FAILED" });
  }

  try {
    const me = await User.findById(req.user._id).select("+razorpayContactId");
    let contactId = me.razorpayContactId;
    if (!contactId) {
      const contact = await razorpayXRequest("/contacts", "POST", {
        name: me.name,
        email: me.email,
        contact: me.phone,
        type: me.role === "worker" ? "employee" : "vendor",
      });
      contactId = contact.id;
      await User.findByIdAndUpdate(me._id, { razorpayContactId: contactId });
    }

    const fundAccountPayload =
      input.type === "vpa"
        ? {
            contact_id: contactId,
            account_type: "vpa",
            vpa: { address: input.vpa },
          }
        : {
            contact_id: contactId,
            account_type: "bank_account",
            bank_account: {
              name: me.name,
              ifsc: input.ifsc,
              account_number: input.accountNumber,
            },
          };

    const fundAccount = await razorpayXRequest(
      "/fund_accounts",
      "POST",
      fundAccountPayload,
    );

    const label =
      input.type === "vpa"
        ? `UPI ${maskVpa(input.vpa)}`
        : `Bank ${maskAccount(input.accountNumber)}`;
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + PAYOUT_COOLDOWN_MS);

    await User.findByIdAndUpdate(me._id, {
      razorpayFundAccountId: fundAccount.id,
      payoutMode: input.type === "vpa" ? "UPI" : "IMPS",
      payoutMethodLabel: label,
      payoutMethodChangedAt: now,
      payoutCooldownUntil: cooldownUntil,
      ...CLEAR_PAYOUT_OTP,
    });

    await logSecurityEvent(req, me._id, "payout_method_set", {
      label,
      mode: input.type,
      hadPreviousMethod: !!me.payoutMethodLabel,
    });
    sendMailSafely({
      to: me.email,
      ...payoutMethodChangedTemplate({
        name: me.name,
        label,
        until:
          cooldownUntil.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) +
          " IST",
        resetUrl: `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")}/forgot-password`,
      }),
    });

    res.json({ fundAccountId: fundAccount.id, label, cooldownUntil });
  } catch (err) {
    logError("walletController:576", err);
    const msg =
      err.razorpayStatus === 400 ? err.message : "Failed to add payout method";
    res.status(500).json({ error: msg });
  }
}

async function loadCashoutContext(req) {
  const rupees = parseMoney(req.body.amount);
  if (!rupees)
    throw new HttpError(400, "A valid amount is required (at most 2 decimals)");
  const amount = toPaise(rupees);
  if (amount < MIN_WITHDRAWAL || amount > MAX_WITHDRAWAL) {
    throw new HttpError(
      400,
      `Withdrawals must be between ₹${MIN_WITHDRAWAL / 100} and ₹${MAX_WITHDRAWAL / 100}`,
    );
  }
  const me = await User.findById(req.user._id).select(
    "+razorpayFundAccountId payoutMode payoutMethodLabel payoutCooldownUntil name email",
  );
  if (!me.razorpayFundAccountId)
    throw new HttpError(400, "Add a payout method before cashing out");
  if (me.payoutCooldownUntil && me.payoutCooldownUntil > new Date()) {
    await logSecurityEvent(req, me._id, "payout_blocked_cooldown", {
      until: me.payoutCooldownUntil,
    });
    const e = new HttpError(
      403,
      "Withdrawals to your new payout method unlock after the 24-hour safety period.",
    );
    e.code = "PAYOUT_COOLDOWN";
    e.cooldownUntil = me.payoutCooldownUntil;
    throw e;
  }
  return { me, amount };
}

function sendHttpError(res, err) {
  if (err instanceof HttpError) {
    const body = { error: err.message };
    for (const k of ["code", "retryAfter", "attemptsLeft", "cooldownUntil"])
      if (err[k] != null) body[k] = err[k];
    return res.status(err.status).json(body);
  }
  return null;
}

export async function sendCashoutOtp(req, res) {
  try {
    const { me, amount } = await loadCashoutContext(req);
    const info = await sendPayoutOtp(me._id, {
      purpose: "cashout",
      context: String(amount),
    });
    await logSecurityEvent(req, me._id, "payout_otp_sent", {
      amountPaise: amount,
    });
    res.json({ sent: true, ...info });
  } catch (err) {
    if (sendHttpError(res, err)) return;
    logError("sendCashoutOtp failed", err);
    res.status(500).json({ error: "Failed to send code" });
  }
}

export async function requestPayout(req, res) {
  let me, amount;
  try {
    ({ me, amount } = await loadCashoutContext(req));
    await verifyAndConsumePayoutOtp(me._id, {
      purpose: "cashout",
      context: String(amount),
      code: String(req.body.otp ?? ""),
    });
  } catch (err) {
    if (err.code?.startsWith?.("OTP_"))
      await logSecurityEvent(req, req.user._id, "payout_otp_failed", {
        code: err.code,
      });
    if (sendHttpError(res, err)) return;
    logError("requestPayout precheck failed", err);
    return res.status(500).json({ error: "Failed to initiate payout" });
  }
  const fundAccountId = me.razorpayFundAccountId;

  const debitSession = await mongoose.startSession();
  let transaction;

  try {
    await debitSession.withTransaction(async () => {
      const { withdrawable } = await computeWithdrawable(
        req.user._id,
        debitSession,
      );
      if (amount > withdrawable) {
        throw new HttpError(
          400,
          `Only ₹${(withdrawable / 100).toFixed(2)} can be withdrawn right now. Recent top-ups (${TOPUP_HOLD_HOURS}h) and earnings (${EARNINGS_HOLD_HOURS}h) are held before withdrawal.`,
        );
      }
      [transaction] = await Transaction.create(
        [
          {
            user: req.user._id,
            type: "withdrawal",
            direction: "debit",
            amount,
            status: "pending",
          },
        ],
        { session: debitSession },
      );

      await adjustWallet({
        userId: req.user._id,
        delta: -amount,
        type: "withdrawal",
        amount,
        status: "pending",
        transactionId: transaction._id,
        session: debitSession,
      });
    });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    logError("requestPayout: debit phase failed", err);
    return res.status(500).json({ error: "Failed to initiate payout" });
  } finally {
    debitSession.endSession();
  }

  try {
    const payout = await razorpayXRequest(
      "/payouts",
      "POST",
      {
        account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
        fund_account_id: fundAccountId,
        amount,
        currency: "INR",
        mode: me.payoutMode || "UPI",
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: transaction._id.toString(),
      },
      transaction._id.toString(),
    );

    await Transaction.updateOne(
      { _id: transaction._id, status: "pending" },
      { status: "processing", razorpayPayoutId: payout.id },
    );

    await logSecurityEvent(req, me._id, "payout_requested", {
      amountPaise: amount,
      label: me.payoutMethodLabel,
      transactionId: transaction._id,
    });
    sendMailSafely({
      to: me.email,
      ...payoutRequestedTemplate({
        name: me.name,
        amount: (amount / 100).toFixed(2),
        label: me.payoutMethodLabel || "your payout method",
      }),
    });

      safeEmit(req.user._id, "wallet:updated", {
      reason: "payout_initiated",
      amount,
    });

    return res.json({
      success: true,
      payoutId: payout.id,
      status: "processing",
    });
  } catch (err) {
    logError("requestPayout: RazorpayX call failed", err);

    let existing = null;
    try {
      const lookup = await razorpayXRequest(
        `/payouts?account_number=${encodeURIComponent(process.env.RAZORPAYX_ACCOUNT_NUMBER)}&reference_id=${transaction._id.toString()}`,
        "GET",
      );
      existing = lookup?.items?.[0] || null;
    } catch (lookupErr) {
      logError("requestPayout: lookup also failed", lookupErr);
      return res
        .status(500)
        .json({
          error: "Payout status is uncertain — please check again shortly",
        });
    }

    if (existing) {
      const statusMap = {
        queued: "processing",
        pending: "processing",
        processing: "processing",
        processed: "success",
        reversed: "reversed",
        rejected: "failed",
        cancelled: "failed",
        failed: "failed",
      };
      const newStatus = statusMap[existing.status] || "processing";
      const isDead = newStatus === "failed" || newStatus === "reversed";

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const updated = await Transaction.findOneAndUpdate(
            { _id: transaction._id, status: "pending" },
            {
              status: newStatus,
              razorpayPayoutId: existing.id,
              ...(isDead && {
                failureReason: `RazorpayX reported: ${existing.status}`,
              }),
            },
            { returnDocument: "after", session },
          );

          if (!updated) return;

          if (isDead) {
            await adjustWallet({
              userId: updated.user,
              delta: updated.amount,
              type: "payout_reversal",
              amount: updated.amount,
              session,
            });
          }
        });
      } finally {
        session.endSession();
      }

      if (isDead) {
        return res
          .status(500)
          .json({ error: "Payout failed — your wallet has been refunded" });
      }
      return res.json({
        success: true,
        payoutId: existing.id,
        status: newStatus,
        note: "Payout reconciled after a network error",
      });
    }

    const refundSession = await mongoose.startSession();
    try {
      await refundSession.withTransaction(async () => {
        const updated = await Transaction.findOneAndUpdate(
          { _id: transaction._id, status: "pending" },
          {
            status: "failed",
            failureReason: err.message || "Payout API failed",
          },
          { returnDocument: "after", session: refundSession },
        );

        if (!updated) return;

        await adjustWallet({
          userId: updated.user,
          delta: updated.amount,
          type: "payout_reversal",
          amount: updated.amount,
          session: refundSession,
        });
      });
    } catch (refundErr) {
      logError("requestPayout: refund compensation failed", refundErr);
      return res
        .status(500)
        .json({
          error: "Payout failed and automatic refund failed — contact support",
        });
    } finally {
      refundSession.endSession();
    }

    return res
      .status(500)
      .json({ error: "Failed to process payout — requires RazorpayX access" });
  }
}

// ---------------------------------------------------------------------------
// WEBHOOK — Razorpay + RazorpayX. Every handler is idempotent.
// ---------------------------------------------------------------------------
export async function handleRazorpayWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  if (!secret || !signature || !Buffer.isBuffer(req.body)) {
    return res.status(400).send("Bad request");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("hex");

  if (!safeEqual(expectedSignature, signature)) {
    return res.status(400).send("Invalid signature");
  }

  let body;
  try {
    body = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }
  const { event, payload } = body;

  try {
    // ============================================================
    // 1. order.paid — top-up confirmation
    // ============================================================
    // 1. order.paid — top-up confirmation (handles retry-on-same-order too)
    if (event === "order.paid") {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;

      const session = await mongoose.startSession();
      let txUserId = null;
      let txAmount = 0;
      try {
        await session.withTransaction(async () => {
          const tx = await Transaction.findOneAndUpdate(
            {
              razorpayOrderId: orderId,
              status: { $in: ["pending", "failed"] }, // ✅ allow retry success
            },
            {
              status: "success",
              razorpayPaymentId: payment.id,
              failureReason: null, // ✅ clear stale reason
            },
            { returnDocument: "after", session },
          );

          if (tx) {
            await adjustWallet({
              userId: tx.user,
              delta: tx.amount,
              type: "topup",
              amount: tx.amount,
              transactionId: tx._id,
              session,
            });
            txUserId = tx.user;
            txAmount = tx.amount;
          }
        });
      } finally {
        session.endSession();
      }

      if (txUserId) {
        safeEmit(txUserId, "wallet:updated", {
          reason: "topup",
          amount: txAmount,
        });
      }
    }

    // ============================================================
    // 2. payment.failed — top-up payment failed. No wallet change.
    // ============================================================

    if (event === "payment.failed") {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;

      if (orderId) {
        const failureReason = buildPaymentFailureReason(payment);

        const failed = await Transaction.findOneAndUpdate(
          {
            razorpayOrderId: orderId,
            status: { $in: ["pending", "failed"] },
          },
          {
            status: "failed",
            failureReason,
            razorpayPaymentId: payment.id,
          },
          { returnDocument: "after" },
        );

        if (failed) {
          safeEmit(failed.user, "wallet:updated", {
            reason: "topup_failed",
            amount: failed.amount,
          });
        }
      }
    }

    // ============================================================
    // 3. payout.processed — money reached the bank.
    // ============================================================
    if (event === "payout.processed") {
      const entity = payload.payout.entity;

      const updated = await Transaction.findOneAndUpdate(
        {
          ...payoutFilter(entity),
          status: { $in: ["pending", "processing"] },
        },
        buildPayoutTerminalUpdate({
          status: "success",
          payoutId: entity.id,
        }),
        { returnDocument: "after", updatePipeline: true },
      );

      if (updated) {
        safeEmit(updated.user, "wallet:updated", {
          reason: "payout_success",
          amount: updated.amount,
        });
        sendPayoutSuccessEmail(updated).catch(() => {});
      }
    }

    // ============================================================
    // 4. payout.rejected — rejected by an approver.
    // ============================================================
    if (event === "payout.rejected") {
      const entity = payload.payout.entity;
      const reason = extractPayoutFailureReason(
        entity,
        "Payout rejected by approver",
      );

      const refunded = await refundFailedPayout(entity, reason);
      if (refunded) {
        safeEmit(refunded.userId, "wallet:updated", {
          reason: "payout_rejected",
          amount: refunded.amount,
        });
        sendPayoutFailedEmail(refunded.userId, refunded.amount, reason).catch(
          () => {},
        );
      }
    }

    // ============================================================
    // 5. payout.failed — beneficiary bank / NPCI / partner bank down.
    //    ⚠️ Not available in RazorpayX Test Mode. Subscribe in Live
    //    Dashboard before go-live. No code changes needed.
    // ============================================================
    if (event === "payout.failed") {
      const entity = payload.payout.entity;
      const reason = extractPayoutFailureReason(
        entity,
        "Payout failed due to bank/NPCI downtime",
      );

      const refunded = await refundFailedPayout(entity, reason);
      if (refunded) {
        safeEmit(refunded.userId, "wallet:updated", {
          reason: "payout_failed",
          amount: refunded.amount,
        });
        sendPayoutFailedEmail(refunded.userId, refunded.amount, reason).catch(
          () => {},
        );
      }
    }

    // ============================================================
    // 6. payout.reversed — money left, then came back.
    //    Uses the same buildPayoutTerminalUpdate helper for consistency
    //    with payout.processed / refundFailedPayout. Filter includes
    //    "success" because a processed payout can later be reversed.
    // ============================================================
    if (event === "payout.reversed") {
      const entity = payload.payout.entity;
      const reason = extractPayoutFailureReason(
        entity,
        "Payout reversed by bank",
      );

      const session = await mongoose.startSession();
      let txUserId = null;
      let txAmount = 0;
      try {
        await session.withTransaction(async () => {
          const transaction = await Transaction.findOneAndUpdate(
            {
              ...payoutFilter(entity),
              status: { $in: ["pending", "processing", "success"] },
            },
            buildPayoutTerminalUpdate({
              status: "reversed",
              failureReason: reason,
              payoutId: entity.id,
            }),
            { returnDocument: "after", session, updatePipeline: true },
          );
          if (transaction) {
            await adjustWallet({
              userId: transaction.user,
              delta: transaction.amount,
              type: "payout_reversal",
              amount: transaction.amount,
              session,
            });
            txUserId = transaction.user;
            txAmount = transaction.amount;
          }
        });
      } finally {
        session.endSession();
      }

      if (txUserId) {
        safeEmit(txUserId, "wallet:updated", {
          reason: "payout_reversed",
          amount: txAmount,
        });
        sendPayoutFailedEmail(txUserId, txAmount, reason).catch(() => {});
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    logError("Webhook processing error:", error);
    res.status(500).send("Error");
  }
}

// ---------------------------------------------------------------------------
// WALLET SUMMARY
// ---------------------------------------------------------------------------
export async function getWalletSummary(req, res) {
  try {
    const s = await computeWithdrawable(req.user._id);
    res.locals.rawMoney = true;
    res.json({
      balance: s.balance / 100,
      held: s.held / 100,
      withdrawable: s.withdrawable / 100,
    });
  } catch (err) {
    logError("walletController:1136", err);
    res.status(500).json({ error: "Failed to load wallet" });
  }
}
