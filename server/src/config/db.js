import mongoose from "mongoose";

import { logError } from "../utils/logger.js";
export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    logError("❌ MongoDB connection failed:", err);
    process.exit(1); // stop the whole app — no point running with no database
  }
}