import mongoose from "mongoose";

const isPaise = (v) => v == null || Number.isInteger(v);
const paiseValidator = {
  validator: isPaise,
  message: "{PATH} must be an integer number of paise",
};
const shiftSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
     skillRequired: {
      type: [String], // <--- Yahan String ki jagah [String] kar dein
      required: true,
    },

    hourlyPay: {
      type: Number,
      required: true,
      min: 100, // ₹1 minimum
      validate: paiseValidator,
    },

    workersNeeded: {
      type: Number,
      default: 1,
      min: 1,
    },
    acceptedCount: { type: Number, default: 0, min: 0 },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator: function (v) {
          // `this` is the document being validated. On create it has both
          // startTime and endTime. On update, Mongoose may only run this if
          // endTime is touched — the service-level check is the real guard.
          return !this.startTime || !v || v > this.startTime;
        },
        message: "endTime must be after startTime",
      },
    },

    //GeoJson format
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
    address: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "filled", "cancelled", "completed", "expired"],
      default: "open",
    },
    //A reference to which Employer posted this shift.
    // ObjectId + ref lets us "populate" (auto-join) the employer's data later.
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
    },
    platformFee: {
      type: Number,
      validate: paiseValidator,
      required: true,
    },
    isFreebie: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

shiftSchema.index({ employer: 1, createdAt: -1 });
shiftSchema.index({ location: "2dsphere" });
shiftSchema.index({ status: 1, startTime: 1 });
shiftSchema.index({ createdAt: -1 });

export default mongoose.model("Shift", shiftSchema);
