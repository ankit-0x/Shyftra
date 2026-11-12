// client/src/context/roleContextObject.js
// The context object lives in its own file so RoleContext.jsx can export
// ONLY a component (required for React fast-refresh).
import { createContext } from "react";

export const RoleContext = createContext(null);
