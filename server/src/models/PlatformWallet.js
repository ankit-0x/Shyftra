// server/src/models/PlatformWallet.js
import mongoose from "mongoose";

const isPaise = (v) => v == null || Number.isInteger(v);
const paiseValidator = { validator: isPaise, message: "{PATH} must be an integer number of paise" };

// Singleton — exactly one document, always addressed by the fixed _id
// "platform". Every flat posting fee lands here. This is the missing
// other side of the platform_fee ledger entry.
const platformWalletSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "platform" },
    balance: { type: Number, validate: paiseValidator, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("PlatformWallet", platformWalletSchema);