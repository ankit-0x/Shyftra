// server/src/utils/passwordSchema.js
// ONE password rule used by register, reset-password and change-password.
// (Client twin: client/src/schemas/password.js — keep both in sync.)
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(128, { message: "Password is too long" })
  .refine((p) => /[A-Z]/.test(p), { message: "Password must contain at least one uppercase letter" })
  .refine((p) => /[a-z]/.test(p), { message: "Password must contain at least one lowercase letter" })
  .refine((p) => /[0-9]/.test(p), { message: "Password must contain at least one number" })
  .refine((p) => /[^a-zA-Z0-9]/.test(p), {
    message: "Password must contain at least one special character (e.g. !@#$%)",
  });
