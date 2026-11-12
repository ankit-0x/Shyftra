// client/src/pages/EmployerHome.jsx
import { Navigate } from "react-router";
import { useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { useGeolocation } from "../hooks/useGeolocation";
import PostShiftForm from "../components/PostShiftForm";
import { Briefcase, MapPinOff } from "lucide-react";

function EmployerHome() {
  const { user } = useSelector((state) => state.auth);
  const { location, permissionDenied } = useGeolocation();

  // Workers/admins poking at /employer get sent to their dashboard.
  if (user && user.role !== "employer") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-base-200/50">
      <Helmet>
        <title>Post a Shift — Shyftra</title>
        <meta
          name="description"
          content="Post an hourly shift and get matched with verified workers nearby."
        />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 animate-fade-in">
        
        {/* Header Section */}
        <div className="mb-10 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full mb-2">
            <Briefcase className="w-10 h-10 text-primary" />
          </div>
          
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight text-base-content">
              Post a <span className="text-primary">Shift</span>
            </h1>
            <p className="mt-3 text-base-content/70 text-lg max-w-md mx-auto leading-relaxed">
              {!user 
                ? "Fill in the details — you'll create your employer account when you submit." 
                : "Post an hourly shift and get matched with verified workers nearby."}
            </p>
          </div>

          {/* Location Warning Alert */}
          {permissionDenied && (
            <div className="mt-4 inline-flex items-center gap-2 bg-warning/10 border border-warning/20 text-warning-content px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm">
              <MapPinOff className="w-4.5 h-4.5 shrink-0 text-warning" />
              <span>Location access denied — please set the address manually.</span>
            </div>
          )}
        </div>

        {/* Form Container */}
        <div className="max-w-xl mx-auto w-full">
          {/* We assume PostShiftForm renders its own card/background, 
              but we constrain its width here so it doesn't stretch too wide on desktop */}
          <PostShiftForm location={location} permissionDenied={permissionDenied} />
        </div>
        
      </div>
    </div>
  );
}

export default EmployerHome;