// server/src/models/Employer.js
import mongoose from "mongoose";

const isPaise = (v) => v == null || Number.isInteger(v);
const paiseValidator = { validator: isPaise, message: "{PATH} must be an integer number of paise" };
const employerSchema = new mongoose.Schema(
  {
    // Link to the User account (Strictly required just like Worker)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Humesha ek user se juda hona chahiye
      unique: true, // Ek user ka ek hi employer profile ho sakta hai
    },
    businessName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    address: {
      type: String,
    },

    totalSpent: {
      type: Number,
      validate: paiseValidator,
      default: 0,
    },
    shiftsPosted: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0, // Starts at 0 reviews
    },
  },
  { timestamps: true },
);

export default mongoose.model("Employer", employerSchema);
