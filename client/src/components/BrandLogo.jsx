
// client/src/components/BrandLogo.jsx
import { Link } from "react-router";

function BrandLogo({ to = "/", size = "md" }) {
  const isSmall = size === "sm";

  return (
    <Link
      to={to}
      aria-label="Shyftra home"
      className="group inline-flex items-center gap-0.5
        overflow-visible transition-opacity duration-300
        hover:opacity-90"
    >
      {/* Logo */}
      <div
        className={`relative flex shrink-0 items-center justify-center
          overflow-visible rounded-xl p-1
          ${isSmall ? "h-8 w-8" : "h-10 w-10"}`}
      >
        <img
          src="/logo.png"
          alt="Shyftra Logo"
          className="h-15 w-auto max-w-none object-contain
            origin-center transform-gpu
            transition-transform duration-500 ease-out
            group-hover:scale-110"
        />
      </div>

      {/* Brand name */}
      <span
        className={`relative z-10 ${size!=="sm" ? "-ml-1":""} whitespace-nowrap font-black uppercase
          leading-none tracking-[-0.045em]
          text-base-content
          ${isSmall ? "text-xl" : "text-2xl"}`}
      >
        hy<span className="text-sky-500">f</span>tra
      </span>
    </Link>
  );
}

export default BrandLogo;