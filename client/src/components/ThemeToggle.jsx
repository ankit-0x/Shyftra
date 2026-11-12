// client/src/components/ThemeToggle.jsx
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";

function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-base-100 border border-base-200 shadow-sm hover:border-base-300 hover:bg-base-200/50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 relative overflow-hidden ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "dark" : "light"}
          initial={{ opacity: 0, rotate: -45, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.5 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isDark ? (
            <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-warning drop-shadow-sm" />
          ) : (
            <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-base-content/70 transition-colors hover:text-base-content" />
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

export default ThemeToggle;