// client/src/components/admin/AdminSearchBar.jsx
// Reusable search + optional filter dropdowns for admin panels.
// Pure presentational — debouncing is done by the caller.

import { Search, X } from "lucide-react";

export default function AdminSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  filterGroups = [],   // [{ value, onChange, options: [{value, label}] }]
  rightSlot = null,    // e.g. count badge
}) {
  return (
    <div className="bg-base-100 rounded-xl border border-base-200 p-3 flex flex-col sm:flex-row gap-2 shadow-sm">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onChange("");
          }}
          placeholder={placeholder}
          className="input input-sm input-bordered w-full pl-9 pr-8 rounded-lg bg-base-100 text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-base-200 text-base-content/40"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {filterGroups.map((g, i) => (
        <select
          key={i}
          value={g.value ?? ""}
          onChange={(e) => g.onChange?.(e.target.value)}
          className="select select-sm select-bordered rounded-lg bg-base-100 text-sm sm:w-44"
        >
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {rightSlot}
    </div>
  );
}