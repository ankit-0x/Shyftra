// server/src/models/Worker.js
import mongoose from "mongoose";

const isPaise = (v) => v == null || Number.isInteger(v);
const paiseValidator = { validator: isPaise, message: "{PATH} must be an integer number of paise" };

const workerSchema = new mongoose.Schema(
  {
    // Link to the User account (Required now since it's real data)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    // Brought over from WorkerProfile
    bio: {
      type: String,
      maxlength: 1000,
    },
    hourlyRate: {
      type: Number,
    },
    totalEarnings: {
      type: Number,
      validate: paiseValidator,
      default: 0,
    },
    shiftsCompleted: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: null, // Starts as null (No reviews yet)
      min: 1,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0, // Starts at 0 reviews
    },
    // Geo-Location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], //[lng,lat]
        required: true,
      },
    },
      lastLocationUpdate: { type: Date, default: Date.now },
    isAvailable: { type: Boolean, default: false },
    bookingSeq: { type: Number, default: 0 }, // bumped on every accept, used to serialize concurrent accepts
  },
  { timestamps: true },
);

workerSchema.index({ location: "2dsphere" });

export default mongoose.model("Worker", workerSchema);
