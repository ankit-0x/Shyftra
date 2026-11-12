
import User from "../models/User.js";
import Strike from "../models/Strike.js";

 export const BAN_THRESHOLD = 3;

/**
 * The only function allowed to increment User.strikes. Logs a Strike row
 * (so a ban is explainable later) and auto-bans on the 3rd strike.
 */
export async function applyStrike({
  userId,
  reason,
  source, // "no_show" | "dispute_loss"
  shift = null,
  application = null,
  dispute = null,
  session,
}) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { strikes: 1 } },
    { returnDocument: 'after', session },
  );

  await Strike.create(
    [{ user: userId, reason, source, shift, application, dispute, strikeNumber: user.strikes }],
    { session },
  );

  if (user.strikes >= BAN_THRESHOLD && !user.isBanned) {
    await User.updateOne(
      { _id: userId },
      { isBanned: true, bannedAt: new Date(), banReason: `Reached ${BAN_THRESHOLD} strikes`, banEnforcedAt: null },
      { session },
    );
  }

  return user;
}