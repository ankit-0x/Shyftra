// client/src/App.jsx
import { lazy, Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react"; // ✅ NEW: Replaced standard spinners

import Header from "./components/Header";
import AuthModal from "./components/AuthModal";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";
import ErrorBoundary from "./components/ErrorBoundary";

import { fetchMe, clearAuth } from "./store/authSlice";
import { useRole } from "./hooks/useRole";
import { socket } from "./socket";
import { useSocketEvents } from "./hooks/useSocketEvents";
import api from "./api/axios";

// Route-level code splitting
const Landing = lazy(() => import("./pages/Landing"));
const ShiftDetail = lazy(() => import("./pages/ShiftDetail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const WorkerHome = lazy(() => import("./pages/WorkerHome"));
const EmployerHome = lazy(() => import("./pages/EmployerHome"));
const BrowseWorkers = lazy(() => import("./pages/BrowseWorkers"));
const MyApplications = lazy(() => import("./pages/MyApplications"));
const MyShifts = lazy(() => import("./pages/Myshifts"));
const Earnings = lazy(() => import("./pages/Earnings"));
const Profile = lazy(() => import("./pages/Profile"));
const AllReviews = lazy(() => import("./pages/AllReviews"));
const MyGivenReviews = lazy(() => import("./pages/MyGivenReviews"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboard"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));

// ✅ NEW: Unified, polished loading component for both Suspense and Auth checks
function FullScreenLoader({ message = "Loading..." }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
      <p className="text-base-content/60 font-medium text-sm tracking-wide">
        {message}
      </p>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { authChecked, user } = useSelector((state) => state.auth);
  const { setRole } = useRole();

  // --- BUSINESS LOGIC (Untouched) ---
  useEffect(() => {
    if (authChecked && user && user.role !== "admin") setRole(user.role);
  }, [authChecked, user, setRole]);

  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);
  // Interceptor-triggered force logout (expired tokens, revoked sessions)
  useEffect(() => {
    const handler = () => {
      api.post("/api/auth/logout").catch(() => {});
      dispatch(clearAuth()); // reducer already clears the flag
      socket.disconnect();
      toast.error("Your session has ended. Please log in again.", {
        id: "session-ended", // stable id dedupes consecutive toasts
        duration: 5000,
      });
    };
    window.addEventListener("auth:force-logout", handler);
    return () => window.removeEventListener("auth:force-logout", handler);
  }, [dispatch]);

  // Server-initiated socket drop ("io server disconnect") = force logout or ban.
  // Socket.io does NOT auto-reconnect on server disconnects, so the tab would sit
  // silently. Ping /me once to trip the normal 401 -> refresh -> force-logout chain.
  useEffect(() => {
    const onDisconnect = (reason) => {
      if (reason === "io server disconnect") {
        api.get("/api/auth/me").catch(() => {});
      }
    };
    socket.on("disconnect", onDisconnect);
    return () => socket.off("disconnect", onDisconnect);
  }, []);

  // ✅ NEW: Handle expired cookies on socket reconnect
  useEffect(() => {
    let retrying = false;
    const onConnectError = (err) => {
      // "Unauthorized" means the access token expired while we were disconnected
      if (err?.message !== "Unauthorized" || retrying) return;
      retrying = true;

      // Calling /me triggers the axios interceptor, which silently refreshes the token
      api
        .get("/api/auth/me")
        .then(() => socket.connect())
        .catch(() => {})
        .finally(() => {
          setTimeout(() => {
            retrying = false;
          }, 5000);
        });
    };
    socket.on("connect_error", onConnectError);
    return () => socket.off("connect_error", onConnectError);
  }, []);

  // Detect "cookies vanished" case — no 401 fires, so interceptor never runs.
  // Only fire if user WAS logged in during this browser (flag persisted).
  useEffect(() => {
    if (!authChecked) return;
    try {
      if (user) {
        localStorage.setItem("shyftra_session_active", "1");
        return;
      }
      if (localStorage.getItem("shyftra_session_active") === "1") {
        localStorage.removeItem("shyftra_session_active");
        toast.error("Your session has ended. Please log in again.", {
          id: "session-ended",
          duration: 5000,
        });
      }
    } catch {
      /* localStorage can throw in private mode / when storage is disabled */
    }
  }, [user, authChecked]);

  const isLoggedIn = !!user;

  useEffect(() => {
    if (authChecked) {
      // Agar pehle se connected hai, toh disconnect karke naya connect karein
      // taaki updated cookies (token) socket handshake mein jayein
      if (socket.connected) {
        socket.disconnect();
      }
      socket.connect();
    }
    return () => {
      socket.disconnect();
    };
  }, [authChecked, isLoggedIn]); // 👈 Yahan isLoggedIn add karna zaroori hai

  useEffect(() => {
    let watchId;
    if (authChecked && isLoggedIn && user?.role === "worker") {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          socket.emit("update_location", { lat: latitude, lng: longitude });
        },
        (error) => {
          console.error("Location tracking error:", error);
          if (error.code === 1) {
            toast.error(
              "Please enable location permissions to receive shifts.",
              { id: "loc-error" },
            );
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 },
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [authChecked, isLoggedIn, user?.role]);

  useSocketEvents();
  // ----------------------------------

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <FullScreenLoader message="Authenticating..." />
      </div>
    );
  }

  const showAppHeader = location.pathname !== "/";

  return (
    // ✅ NEW: Added flex-col to root so the main content area naturally expands
    <div className="min-h-screen bg-base-200 text-base-content flex flex-col font-sans selection:bg-primary/20">
      {showAppHeader && <Header />}

      {/* ✅ NEW: main wrapper ensures child pages stretch to fill the screen correctly on mobile */}
      <main className="flex-1 flex flex-col relative w-full">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<FullScreenLoader />}>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route
                  path="/"
                  element={
                    <PageTransition>
                      <Landing />
                    </PageTransition>
                  }
                />

                {/* Public pages */}
                <Route
                  path="/worker"
                  element={
                    <PageTransition>
                      <WorkerHome />
                    </PageTransition>
                  }
                />
                <Route
                  path="/employer"
                  element={
                    <PageTransition>
                      <EmployerHome />
                    </PageTransition>
                  }
                />

                {/* Public account-recovery pages (work logged-out AND logged-in) */}
                <Route
                  path="/verify-email/:token"
                  element={
                    <PageTransition>
                      <VerifyEmail />
                    </PageTransition>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <PageTransition>
                      <ForgotPassword />
                    </PageTransition>
                  }
                />
                <Route
                  path="/reset-password/:token"
                  element={
                    <PageTransition>
                      <ResetPassword />
                    </PageTransition>
                  }
                />

                {/* Protected unified dashboard */}
                <Route
                  path="/dashboard"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <AdminDashboardPage />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />

                {/* Other protected pages */}
                <Route
                  path="/shifts/:id"
                  element={
                    <PageTransition>
                      <ShiftDetail />
                    </PageTransition>
                  }
                />
                <Route
                  path="/applications"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <MyApplications />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />
                <Route
                  path="/my-shifts"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <MyShifts />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />
                <Route
                  path="/earnings"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <Earnings />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />

                <Route
                  path="/transactions"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <TransactionHistory />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />

                <Route
                  path="/profile"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />
                <Route
                  path="/reviews/:userId"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <AllReviews />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />
                <Route
                  path="/profile/reviews-given"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <MyGivenReviews />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />
                <Route
                  path="/browse-workers"
                  element={
                    <PageTransition>
                      <ProtectedRoute>
                        <BrowseWorkers />
                      </ProtectedRoute>
                    </PageTransition>
                  }
                />

                {/* Fallback 404 */}
                <Route
                  path="*"
                  element={
                    <PageTransition>
                      <Navigate to="/" replace />
                    </PageTransition>
                  }
                />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </main>

      <AuthModal />

      {/* ✅ NEW: Styled the toaster to match a modern UI */}
      <Toaster
        position="top-right"
        toastOptions={{
          className:
            "!bg-base-100 !text-base-content !shadow-lg !border !border-base-200 !rounded-xl",
          duration: 4000,
        }}
      />
    </div>
  );
}

export default App;
