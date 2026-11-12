// client/src/components/UserMenu.jsx
import { Link, useLocation } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../store/authSlice";
import {
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  Search,
  FileText,
  IndianRupee,
  Shield,
  PlusCircle,
  Users,
  Wallet,
  Briefcase,
} from "lucide-react";

function UserMenu({ alwaysShowLinks = false }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  if (!user) return null;

  const handleLogout = () => {
    // Blur active element to close dropdown before logging out
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    dispatch(logoutUser());
  };

  // ✅ Helper to close dropdown on click
  const handleLinkClick = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Controls visibility on different screen sizes
  const linkClassWrapper = alwaysShowLinks ? "" : "md:hidden";
  const dividerClass = alwaysShowLinks
    ? "my-1 h-[1px] bg-base-200"
    : "my-1 h-[1px] bg-base-200 md:hidden";

  // ✅ Helper function for dropdown menu active states
  const getMenuClass = (path) => {
    const isActive = location.pathname === path;
    return `py-2.5 gap-3 rounded-xl transition-colors flex items-center px-3 ${
      isActive
        ? "bg-primary/10 text-primary font-bold"
        : "hover:bg-base-200 hover:text-base-content text-base-content/80 font-medium"
    }`;
  };

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        aria-label="User menu"
        className="btn btn-ghost btn-circle avatar placeholder ring-1 ring-base-300 hover:ring-primary/50 transition-all shadow-sm"
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`${user.name || "User"} avatar`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold uppercase">
              {user.name ? user.name.charAt(0) : "?"}
            </span>
          )}
        </div>
      </div>

      <ul
        tabIndex={0}
        className="mt-3 z-100 p-2 shadow-xl shadow-base-content/10 menu menu-sm dropdown-content bg-base-100 rounded-2xl w-60 border border-base-200"
      >
        {/* User info header */}
        <li className="px-4 py-3 cursor-default pointer-events-none">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-base-content text-sm block truncate">
              {user.name}
            </span>
            <span className="text-xs font-medium text-base-content/60 uppercase tracking-wider block truncate">
              {user.role}
            </span>
          </div>
        </li>

        <div className="my-1 h-px bg-base-200"></div>

        {/* ---------- Role-specific links ---------- */}
        {user.role === "worker" && (
          <>
            <li className={linkClassWrapper}>
              <Link
                to="/worker"
                className={getMenuClass("/worker")}
                onClick={handleLinkClick}
              >
                <Search className="w-4 h-4" /> Browse Shifts
              </Link>
            </li>
            <li className={linkClassWrapper}>
              <Link
                to="/dashboard"
                className={getMenuClass("/dashboard")}
                onClick={handleLinkClick}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
            </li>
            <li className={linkClassWrapper}>
              <Link
                to="/applications"
                className={getMenuClass("/applications")}
                onClick={handleLinkClick}
              >
                <FileText className="w-4 h-4" /> Applications
              </Link>
            </li>
            <li className={linkClassWrapper}>
              <Link
                to="/earnings"
                className={getMenuClass("/earnings")}
                onClick={handleLinkClick}
              >
                <IndianRupee className="w-4 h-4" /> Earnings
              </Link>
            </li>
          </>
        )}

                {user.role === "employer" && (
          <>
            <li className={linkClassWrapper}>
              <Link
                to="/dashboard"
                className={getMenuClass("/dashboard")}
                onClick={handleLinkClick}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
            </li>
            <li className={linkClassWrapper}>
              <Link
                to="/my-shifts"
                className={getMenuClass("/my-shifts")}
                onClick={handleLinkClick}
              >
                <Briefcase className="w-4 h-4" /> My Shifts
              </Link>
            </li>
            <li className={linkClassWrapper}>
              <Link
                to="/employer"
                className={getMenuClass("/employer")}
                onClick={handleLinkClick}
              >
                <PlusCircle className="w-4 h-4" /> Post a Shift
              </Link>
            </li>
            <li className={linkClassWrapper}>
              <Link
                to="/browse-workers"
                className={getMenuClass("/browse-workers")}
                onClick={handleLinkClick}
              >
                <Users className="w-4 h-4" /> Browse Workers
              </Link>
            </li>
          </>
        )}

        {user.role === "admin" && (
          <li className={linkClassWrapper}>
            <Link
              to="/admin"
              className={getMenuClass("/admin")}
              onClick={handleLinkClick}
            >
              <Shield className="w-4 h-4" /> Admin Console
            </Link>
          </li>
        )}

        {/* ---------- Global links (Profile + Logout) ---------- */}
        <li>
          <Link
            to="/transactions"
            className={getMenuClass("/transactions")}
            onClick={handleLinkClick}
          >
            <Wallet className="w-4 h-4" /> Transactions
          </Link>
        </li>
       
        <li>
          <Link
            to="/profile"
            className={getMenuClass("/profile")}
            onClick={handleLinkClick}
          >
            <UserIcon className="w-4 h-4" /> Profile
          </Link>
        </li>

        <div className="my-1 h-px bg-base-200"></div>

        <li>
          <button
            onClick={handleLogout}
            className="py-2.5 gap-3 text-error font-medium hover:bg-error/10 hover:text-error rounded-xl mt-1 flex items-center px-3"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </li>
      </ul>
    </div>
  );
}

export default UserMenu;
