// client/src/components/Header.jsx
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { Menu, X } from "lucide-react";
import { openAuthModal } from "../store/authModalSlice";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

function Header() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    dispatch(openAuthModal({ mode: "login" }));
  };
  const handleSignupClick = () => {
    setMobileMenuOpen(false);
    dispatch(openAuthModal({ mode: "signup" }));
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinkClass = (path) => {
    const isActive = location.pathname === path;
    return `btn btn-sm rounded-full transition-all ${
      isActive
        ? "bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/20"
        : "btn-ghost text-base-content/70 hover:text-base-content hover:bg-base-200 font-medium"
    }`;
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-base-100/80 backdrop-blur-lg border-b border-base-200 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        {/* Left Side: Logo */}
        <div className="shrink-0 flex items-center">
          <BrandLogo size="sm" />
        </div>

        {/* Right Side Navigation */}
        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            /* ================= LOGGED IN STATE ================= */
            <>
              <nav className="hidden md:flex items-center gap-1 mr-2">
                {user.role === "worker" && (
                  <>
                    <Link to="/worker" className={navLinkClass("/worker")}>
                      Browse Shifts
                    </Link>
                    <Link
                      to="/dashboard"
                      className={navLinkClass("/dashboard")}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/applications"
                      className={navLinkClass("/applications")}
                    >
                      Applications
                    </Link>
                    <Link to="/earnings" className={navLinkClass("/earnings")}>
                      Earnings
                    </Link>
                  </>
                )}

                                {user.role === "employer" && (
                  <>
                    <Link
                      to="/dashboard"
                      className={navLinkClass("/dashboard")}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/my-shifts"
                      className={navLinkClass("/my-shifts")}
                    >
                      My Shifts
                    </Link>
                    <Link to="/employer" className={navLinkClass("/employer")}>
                      Post a Shift
                    </Link>
                    <Link
                      to="/browse-workers"
                      className={navLinkClass("/browse-workers")}
                    >
                      Browse Workers
                    </Link>
                  </>
                )}

                {user.role === "admin" && (
                  <Link to="/admin" className={navLinkClass("/admin")}>
                    Admin Console
                  </Link>
                )}
              </nav>

              <div className="flex items-center gap-2 pl-2 ml-2 md:pl-0 md:ml-0">
                <ThemeToggle />
                <div className="h-5 w-px bg-base-300" />
                <UserMenu />
              </div>
            </>
          ) : (
            /* ================= LOGGED OUT STATE ================= */
            <>
              {/* Desktop Marketplace Links (lg and up) */}
              <nav className="hidden lg:flex items-center gap-1 mr-2">
                <Link to="/worker" className={navLinkClass("/worker")}>
                  Browse Shifts
                </Link>
                
                <Link to="/employer" className={navLinkClass("/employer")}>
                  Post a Shift
                </Link>
              </nav>

              {/* Desktop Auth & Theme Actions (lg and up) */}
              <div className="hidden lg:flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <div className="h-5 w-px bg-base-300 mx-1"></div>
                <button
                  onClick={handleLoginClick}
                  className="btn btn-ghost btn-sm rounded-full font-semibold hover:bg-base-200"
                >
                  Log in
                </button>
                <button
                  onClick={handleSignupClick}
                  className="btn btn-primary btn-sm rounded-full font-bold shadow-sm shadow-primary/20 px-4 hover:-translate-y-0.5 transition-transform"
                >
                  Sign up
                </button>
              </div>

              {/* Mobile Controls (< lg) */}
              <div className="flex lg:hidden items-center gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((o) => !o)}
                  className="btn btn-ghost btn-square btn-sm rounded-xl"
                  aria-label="Toggle menu"
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= MOBILE DROPDOWN (LOGGED OUT ONLY) ================= */}
      {!user && mobileMenuOpen && (
        <div className="lg:hidden border-t border-base-200 bg-base-100/95 backdrop-blur-lg px-4 sm:px-6 py-4 space-y-1">
          <Link
            to="/worker"
            onClick={closeMobileMenu}
            className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-base-200"
          >
            Browse Shifts
          </Link>
          
          <Link
            to="/employer"
            onClick={closeMobileMenu}
            className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-base-200"
          >
            Post a Shift
          </Link>

          <div className="pt-3 flex gap-2 border-t border-base-200 mt-3">
            <button
              type="button"
              onClick={handleLoginClick}
              className="btn btn-sm btn-outline flex-1 rounded-xl font-bold"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={handleSignupClick}
              className="btn btn-sm btn-primary flex-1 rounded-xl font-bold"
            >
              Sign up
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
