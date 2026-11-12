// client/src/pages/Dashboard.jsx
import { useSelector } from "react-redux";
import { Navigate } from "react-router";
import { Helmet } from "react-helmet-async";
import WorkerDashboard from "../components/WorkerDashboard";
import EmployerDashboard from "../components/EmployerDashboard";

function Dashboard() {
  const { user } = useSelector((state) => state.auth);

  // ProtectedRoute should already prevent this, but belt-and-suspenders.
  if (!user) return <Navigate to="/" replace />;

  // Admin routing
  if (user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  // Employer Dashboard
  if (user.role === "employer") {
    return (
      <>
        <Helmet>
          <title>Employer Dashboard — Shyftra</title>
          <meta
            name="description"
            content="Manage your posted shifts, applicants and wallet."
          />
        </Helmet>
        <EmployerDashboard />
      </>
    );
  }

  // Worker Dashboard (Default authenticated view)
  if (user.role === "worker") {
    return (
      <>
        <Helmet>
          <title>Dashboard — Shyftra</title>
          <meta
            name="description"
            content="Your applications, nearby shifts and account status."
          />
        </Helmet>
        <WorkerDashboard />
      </>
    );
  }

  // Unknown role — bail out to landing.
  return <Navigate to="/" replace />;
}

export default Dashboard;