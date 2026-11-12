// server/src/middleware/roles.js
// Must run AFTER requireAuth in a route's middleware chain, since it
// depends on req.user already being set.

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Requires ${role} role` });
    }
    next();
  };
}

export const isWorker = requireRole("worker");
export const isEmployer = requireRole("employer");
export const isAdmin = requireRole("admin");

export function requireVerified(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.verificationStatus !== "verified") {
    return res.status(403).json({
      error: "Your account must be verified before you can do this",
      verificationStatus: req.user.verificationStatus,
    });
  }
  next();
}