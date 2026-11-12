// client/src/hooks/useRole.js
import { useContext } from "react";
import { RoleContext } from "../context/roleContextObject";

// Components call useRole() instead of importing useContext + RoleContext.
export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used inside a RoleProvider");
  return context;
}
