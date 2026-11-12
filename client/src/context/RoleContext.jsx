// client/src/context/RoleContext.jsx
// Shared "which side of the marketplace am I on?" state ("worker" | "employer"),
// remembered across refreshes. Read it with useRole() from hooks/useRole.js.
import { useState, useEffect, useMemo } from "react";
import { RoleContext } from "./roleContextObject";

export function RoleProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem("shyftra_role") || "worker");

  useEffect(() => {
    localStorage.setItem("shyftra_role", role);
  }, [role]);

  const value = useMemo(() => ({ role, setRole }), [role]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
