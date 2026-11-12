// client/src/schemas/password.js
// ONE password rule for signup, reset-password and change-password.
// Server twin: server/src/utils/passwordSchema.js — keep both in sync.
import { z } from "zod";

export const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "One special character (e.g. !@#$%)", test: (p) => /[^a-zA-Z0-9]/.test(p) },
  { id: "max", label: "At most 128 characters", test: (p) => p.length <= 128 },
];

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(128, { message: "Password is too long" })
  .refine((p) => /[A-Z]/.test(p), { message: "Password must contain at least one uppercase letter" })
  .refine((p) => /[a-z]/.test(p), { message: "Password must contain at least one lowercase letter" })
  .refine((p) => /[0-9]/.test(p), { message: "Password must contain at least one number" })
  .refine((p) => /[^a-zA-Z0-9]/.test(p), { message: "Password must contain at least one special character (e.g. !@#$%)" });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string().min(1, "Confirm your password"), })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, { message: "New passwords do not match", path: ["confirmNewPassword"] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: "New password must be different from the current one", path: ["newPassword"] });
