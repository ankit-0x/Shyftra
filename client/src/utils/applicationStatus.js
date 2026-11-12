// client/src/utils/applicationStatus.js
export const STATUS_STYLES = {
  pending: "badge-warning",
  accepted: "badge-success",
  rejected: "badge-error",
  withdrawn: "badge-ghost",
  in_progress: "badge-info",
  pending_resolution: "badge-warning",
  disputed: "badge-error",
  completed: "badge-success",
  cancelled_by_worker: "badge-error",
  cancelled_by_employer: "badge-ghost",
  cancelled_by_admin: "badge-ghost",
  expired: "badge-ghost",
};

export function statusLabel(app) {
  if (!app?.status) return "";
  if (app.status === "cancelled_by_worker" && app.noShow) return "no show";
  return app.status.replaceAll("_", " ");
}

export const STATUS_MESSAGES = {
  pending: "Your application is awaiting a decision from the employer.",
  accepted: "You've been accepted — funds are secured for your pay.",
  rejected: "You weren't selected for this shift.",
  withdrawn: "You withdrew this application. You can apply again while the shift is open.",
  in_progress: "You're clocked in and working this shift right now.",
  pending_resolution: "Your exit time is awaiting confirmation.",
  disputed: "Your dispute is under review.",
  completed: "This shift is complete.",
  cancelled_by_worker: "You cancelled this shift, so you can't apply to it again.",
  cancelled_by_employer: "The employer cancelled your acceptance for this shift.",
  cancelled_by_admin: "An administrator cancelled this shift.",
  expired: "This shift expired without being worked.",
};

export const WORKING_STATUSES = ["accepted", "in_progress", "pending_resolution", "disputed", "completed"];

export function cancelActionFor(app) {
  if (!app) return null;
  if (app.status === "pending") return "withdraw";
  if (app.status === "accepted") {
    const record = app.shiftRecord;
    if (!record || record.status === "scheduled") return "cancel";
  }
  return null;
}