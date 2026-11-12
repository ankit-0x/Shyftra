// client/src/components/FilterBar.jsx
import { RefreshCw } from "lucide-react";

// PostShiftForm.jsx wali list (Bilkul match karti hui)
const PREDEFINED_SKILLS = [
  "Electrician", "Plumber", "Carpenter", "Painter", 
  "Mason", "Welder", "Waiter", "Chef", "Security Guard", "Driver"
];

function FilterBar({ filters, onChange, mode, onRefresh }) {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-base-100 rounded-lg shadow-sm items-center">
      {mode === "shifts" && (
        <>
          {/* Native Datalist Input for Skills */}
          <div className="relative">
            <input
              type="text"
              list="skills-filter-list"
              placeholder="Filter by skill..."
              className="input input-bordered input-sm w-36 sm:w-40"
              value={filters.skill || ""}
              onChange={(e) => onChange("skill", e.target.value)}
            />
            <datalist id="skills-filter-list">
              {PREDEFINED_SKILLS.map((skill) => (
                <option key={skill} value={skill} />
              ))}
            </datalist>
          </div>

          <input
            type="number"
            placeholder="Min pay ₹/hr"
            className="input input-bordered input-sm w-32"
            value={filters.minPay}
            onChange={(e) => onChange("minPay", e.target.value)}
            title="Enter minimum hourly pay in rupees"
          />

          <input
            type="date"
            className="input input-bordered input-sm"
            value={filters.date}
            onChange={(e) => onChange("date", e.target.value)}
          />
        </>
      )}

      <select
        className="select select-bordered select-sm"
        value={filters.radius}
        onChange={(e) => onChange("radius", e.target.value)}
      >
        <option value="5">Within 5 km</option>
        <option value="10">Within 10 km</option>
        <option value="25">Within 25 km</option>
        <option value="50">Within 50 km</option>
      </select>

      {onRefresh && (
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-circle ml-auto"
          onClick={onRefresh}
          title="Refresh"
          aria-label="Refresh list"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default FilterBar;