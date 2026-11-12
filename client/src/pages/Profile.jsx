// client/src/pages/Profile.jsx
import { useEffect, useState } from "react"; // 🆕 useState
import { useNavigate, Link } from "react-router"; // 🆕 navigate
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDispatch, useSelector } from "react-redux";
import {
  AlertTriangle,
  Star,
  ShieldCheck,
  Upload,
  ChevronRight,
  Loader2,
  Mail,
  User as UserIcon,
  Briefcase,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  MessageSquare,
  LogOut, // 🆕
  Smartphone, // 🆕
} from "lucide-react";
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  uploadVerificationDoc,
} from "../store/profileSlice";
import { logoutAllDevices } from "../store/authSlice"; // 🆕
import AvatarSection from "../components/AvatarSection";
import ChangePasswordCard from "../components/ChangePasswordCard";
import ChangeEmailCard from "../components/ChangeEmailCard";
import ReviewList from "../components/ReviewList";
import MyReviewsList from "../components/MyReviewsList";
import { fetchMyReviews } from "../store/reviewsSlice";

const workerSchema = z.object({
  skills: z.string().min(1, "List at least one skill"),
  hourlyRate: z.coerce.number().positive("Enter a valid rate"),
  bio: z.string().max(1000).optional(),
});
const employerSchema = z.object({
  businessName: z.string().min(2),
  description: z.string().max(1000).optional(),
  address: z.string().optional(),
});
const adminSchema = z.object({});

const VERIFICATION_LABELS = {
  unverified: {
    text: "Not verified",
    style: "bg-base-200 text-base-content",
    icon: ShieldAlert,
  },
  pending: {
    text: "Verification pending",
    style: "bg-warning/10 text-warning border border-warning/20",
    icon: Clock,
  },
  verified: {
    text: "Verified",
    style: "bg-success/10 text-success border border-success/20",
    icon: CheckCircle2,
  },
  rejected: {
    text: "Verification rejected",
    style: "bg-error/10 text-error border border-error/20",
    icon: XCircle,
  },
};

function Profile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, status } = useSelector((state) => state.profile);
  const { user } = useSelector((state) => state.auth);

  // 🆕 Logout-all state
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const total = useSelector(
    (state) => state.reviews.reviewsByUserId[user?.id]?.total ?? 0,
  );
  const myReviewsCount = useSelector((state) => state.reviews.myReviews.length);

  useEffect(() => {
    dispatch(fetchProfile());
    dispatch(fetchMyReviews());
  }, [dispatch]);

  let schema;
  if (user?.role === "worker") schema = workerSchema;
  else if (user?.role === "employer") schema = employerSchema;
  else schema = adminSchema;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (data?.profile) {
      if (user?.role === "worker") {
        reset({
          skills: (data.profile.skills || []).join(", "),
          hourlyRate: data.profile.hourlyRate || "",
          bio: data.profile.bio || "",
        });
      } else if (user?.role === "employer") {
        reset({
          businessName: data.profile.businessName || "",
          description: data.profile.description || "",
          address: data.profile.address || "",
        });
      }
    }
  }, [data, user, reset]);

  function onSubmit(formValues) {
    if (user?.role === "worker") {
      dispatch(
        updateProfile({
          ...formValues,
          skills: formValues.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      );
    } else if (user?.role === "employer") {
      dispatch(updateProfile(formValues));
    }
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (file) dispatch(uploadAvatar(file));
  }

  function handleDocChange(e) {
    const file = e.target.files[0];
    if (file) dispatch(uploadVerificationDoc(file));
  }

  // 🆕 Logout from all devices
 async function handleLogoutAll() {
  setIsLoggingOutAll(true);
  try {
    await dispatch(logoutAllDevices()).unwrap();
    toast.success("Logged out from all devices");
    navigate("/", { replace: true });
  } catch (err) {
    // 🆕 Ensure we always pass a STRING to toast — never an Error object
    const message =
      typeof err === "string"
        ? err
        : err?.message || "Failed to log out from all devices";
    toast.error(message);
    setIsLoggingOutAll(false);
    setShowLogoutAllConfirm(false);
  }
}

  if (status === "loading" || !data) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-base-content/60 font-medium">Loading profile...</p>
      </div>
    );
  }

  const verification =
    VERIFICATION_LABELS[data.verificationStatus] ||
    VERIFICATION_LABELS.unverified;
  const VerificationIcon = verification.icon;

  return (
    <div className="min-h-screen bg-base-200/50 text-base-content py-8 px-4 md:py-12 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-base-content">
            Profile Settings
          </h1>
          <p className="text-base-content/60 mt-1 text-sm font-medium">
            Manage your personal information, verification, and professional
            details.
          </p>
        </div>

        {/* Identity & Avatar Card */}
        <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          <div className="shrink-0">
            <AvatarSection
              data={data}
              handleAvatarChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-3 w-full">
            <div>
              <h2 className="text-2xl font-bold text-base-content">
                {data.name || "User Profile"}
              </h2>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-4 mt-1 text-sm text-base-content/60">
                <span className="capitalize font-semibold text-primary">
                  {user?.role}
                </span>
                <span className="hidden sm:inline text-base-300">•</span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {data.email}
                </span>
              </div>
            </div>

            {user?.role !== "admin" && (
              <div className="inline-flex items-center gap-2 bg-base-200/50 px-4 py-2 rounded-xl border border-base-200 mt-2">
                {data.profile?.rating != null ? (
                  <>
                    <Star className="w-5 h-5 fill-warning text-warning" />
                    <span className="font-bold text-base">
                      {data.profile.rating}
                    </span>
                    <span className="text-xs text-base-content/50 font-medium ml-1">
                      ({data.profile.ratingCount} reviews)
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-medium text-base-content/60 px-1">
                    No reviews yet
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Account Standing Alert (Only shown if strikes > 0 or banned) */}
        {user?.role !== "admin" && (user?.strikes > 0 || user?.isBanned) && (
          <div
            className={`rounded-2xl shadow-sm border p-5 sm:p-6 flex items-start gap-3 ${user.isBanned ? "bg-error/10 border-error/20" : "bg-warning/10 border-warning/20"}`}
          >
            <AlertTriangle
              className={`w-6 h-6 shrink-0 mt-0.5 ${user.isBanned ? "text-error" : "text-warning"}`}
            />
            <div>
              <h3
                className={`font-bold text-lg leading-none mb-2 ${user.isBanned ? "text-error" : "text-warning"}`}
              >
                {user.isBanned ? "Account Banned" : "Account Standing Warning"}
              </h3>
              {user.isBanned ? (
                <p className="text-sm text-base-content/80 leading-relaxed">
                  {user.banReason ||
                    "This account has been permanently banned for repeated violations."}
                </p>
              ) : (
                <p className="text-sm text-base-content/80 leading-relaxed">
                  You have{" "}
                  <strong className="text-base-content">{user.strikes}</strong>{" "}
                  strike
                  {user.strikes > 1 ? "s" : ""} on your account. Reaching 3
                  strikes results in a permanent ban.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Identity Verification Section */}
        {user?.role !== "admin" && (
          <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-base-200 bg-base-200/30 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">Identity Verification</h3>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${verification.style}`}
              >
                <VerificationIcon className="w-4 h-4" />
                {verification.text}
              </span>
            </div>
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <p className="text-sm text-base-content/70 max-w-md leading-relaxed">
                Uploading a government ID builds trust. Documents are securely
                reviewed by our team before your status is updated.
              </p>
              <label className="btn btn-outline hover:bg-base-200 hover:text-base-content shrink-0 rounded-xl gap-2">
                <Upload className="w-4 h-4" /> Upload ID
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDocChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Profile Edit Form */}
        {user?.role !== "admin" && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden"
          >
            <div className="p-6 border-b border-base-200 bg-base-200/30">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {user?.role === "worker" ? (
                  <UserIcon className="w-5 h-5 text-primary" />
                ) : (
                  <Briefcase className="w-5 h-5 text-primary" />
                )}
                {user?.role === "worker"
                  ? "Worker Details"
                  : "Business Details"}
              </h3>
            </div>

            <div className="p-6 space-y-5">
              {user?.role === "worker" ? (
                <>
                  <div className="form-control">
                    <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                      Skills
                    </label>
                    <input
                      {...register("skills")}
                      placeholder="e.g. Electrician, Plumber, Forklift Operator"
                      className="input input-bordered w-full focus:outline-primary/50 focus:border-primary transition-all bg-base-100"
                    />
                    {errors.skills && (
                      <p className="text-error text-xs mt-1.5 font-medium">
                        {errors.skills.message}
                      </p>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                      Hourly Rate (₹)
                    </label>
                    <input
                      {...register("hourlyRate")}
                      type="number"
                      placeholder="Enter your expected rate"
                      className="input input-bordered w-full focus:outline-primary/50 focus:border-primary transition-all bg-base-100"
                    />
                    {errors.hourlyRate && (
                      <p className="text-error text-xs mt-1.5 font-medium">
                        {errors.hourlyRate.message}
                      </p>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                      Professional Bio
                    </label>
                    <textarea
                      {...register("bio")}
                      placeholder="Briefly describe your experience and work ethic..."
                      className="textarea textarea-bordered w-full h-28 focus:outline-primary/50 focus:border-primary transition-all resize-none bg-base-100 leading-relaxed"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-control">
                    <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                      Business Name
                    </label>
                    <input
                      {...register("businessName")}
                      placeholder="Official company or branch name"
                      className="input input-bordered w-full focus:outline-primary/50 focus:border-primary transition-all bg-base-100"
                    />
                    {errors.businessName && (
                      <p className="text-error text-xs mt-1.5 font-medium">
                        {errors.businessName.message}
                      </p>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                      Business Address
                    </label>
                    <input
                      {...register("address")}
                      placeholder="Complete street address"
                      className="input input-bordered w-full focus:outline-primary/50 focus:border-primary transition-all bg-base-100"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                      About Your Business
                    </label>
                    <textarea
                      {...register("description")}
                      placeholder="What does your company do? What kind of workers do you usually need?"
                      className="textarea textarea-bordered w-full h-28 focus:outline-primary/50 focus:border-primary transition-all resize-none bg-base-100 leading-relaxed"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-5 border-t border-base-200 bg-base-200/30 flex justify-end">
              <button
                type="submit"
                className="btn btn-primary w-full sm:w-auto sm:px-8 rounded-xl shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}

               {/* Change email — every role, including admin */}
        <ChangeEmailCard />

        {/* Change password — every role, including admin */}
        <ChangePasswordCard />

                {/* Security Section — Logout from all devices (visible to ALL roles,
            including admin — admins need this most if their session is stolen) */}
        <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden">
          <div className="p-6 border-b border-base-200 bg-base-200/30">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-error" />
              Security
            </h3>
          </div>
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-base-content/60" />
                Log out from all devices
              </p>
              <p className="text-sm text-base-content/60 mt-1 leading-relaxed max-w-lg">
                Use this if you think your account is compromised. You'll be
                signed out from every device — including this one — and will
                need to log in again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutAllConfirm(true)}
              className="btn btn-outline btn-error gap-2 shrink-0 rounded-xl"
            >
              <LogOut className="w-4 h-4" /> Log out all devices
            </button>
          </div>
        </div>

        {/* Reviews Section */}
        {user?.role !== "admin" && user?.id && (
          <div className="grid md:grid-cols-2 gap-6 pt-4">
            {/* Reviews Received */}
            <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-6 flex flex-col h-full">
              <div className="flex justify-between items-center border-b border-base-200 pb-3 mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary" />
                  Reviews
                  {total > 0 && (
                    <span className="text-sm font-medium text-base-content/50 ml-1">
                      ({total})
                    </span>
                  )}
                </h3>
                {total > 3 && (
                  <Link
                    to={`/reviews/${user.id}`}
                    className="text-sm font-medium text-primary hover:text-primary-focus flex items-center gap-1 hover:underline"
                  >
                    See all <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
              <div className="flex-1">
                <ReviewList userId={user.id} limit={3} />
              </div>
            </div>

            {/* Reviews Given */}
            <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-6 flex flex-col h-full">
              <div className="flex justify-between items-center border-b border-base-200 pb-3 mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Given
                  {myReviewsCount > 0 && (
                    <span className="text-sm font-medium text-base-content/50 ml-1">
                      ({myReviewsCount})
                    </span>
                  )}
                </h3>
                {myReviewsCount > 3 && (
                  <Link
                    to="/profile/reviews-given"
                    className="text-sm font-medium text-primary hover:text-primary-focus flex items-center gap-1 hover:underline"
                  >
                    See all <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
              <div className="flex-1">
                <MyReviewsList limit={3} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🆕 Logout All Confirmation Modal */}
      {showLogoutAllConfirm && (
        <div className="modal modal-open z-100" role="dialog" aria-modal="true">
          <div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            onClick={() => !isLoggingOutAll && setShowLogoutAllConfirm(false)}
          />
          <div className="modal-box max-w-md rounded-3xl p-6">
            <div className="w-12 h-12 bg-error/10 text-error rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-xl text-center mb-2">
              Log out from all devices?
            </h3>
            <p className="text-sm text-base-content/70 text-center leading-relaxed mb-6">
              You'll be signed out from every device — including this one.
              You'll need to log in again with your password.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-ghost flex-1 rounded-xl"
                onClick={() => setShowLogoutAllConfirm(false)}
                disabled={isLoggingOutAll}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error flex-1 rounded-xl gap-2"
                onClick={handleLogoutAll}
                disabled={isLoggingOutAll}
              >
                {isLoggingOutAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                {isLoggingOutAll ? "Logging out..." : "Yes, log out all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
