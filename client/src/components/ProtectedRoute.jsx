// client/src/components/ProtectedRoute.jsx
// Wrap any <Route> element in this to require login. There is NO redirect to
// a /login page anywhere — matching the "modal, not a separate page" rule,
// even for direct-URL access.
import { useEffect } from "react";
import { Navigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { openAuthModal } from "../store/authModalSlice";

function ProtectedRoute({ children }) {
  const dispatch = useDispatch();
  const { user, authChecked } = useSelector((state) => state.auth);

  useEffect(() => {
    // Wait until we actually know if the user is signed in — otherwise a
    // hard-refresh on /dashboard flashes the login modal for a user who
    // is, in fact, logged in (their /me request just hasn't returned yet).
    if (authChecked && !user) {
      dispatch(openAuthModal({ mode: "login" }));
    }
  }, [authChecked, user, dispatch]);

  // While the initial /me call is in flight, render nothing (App already
  // shows a global loader during this time, so we're effectively invisible).
  if (!authChecked) return null;

  if (!user) {
    // Bounce back to the homepage — the modal (opened above) appears on top.
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;