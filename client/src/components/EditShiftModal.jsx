// client/src/components/EditShiftModal.jsx
import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { updateShift } from "../store/employerShiftsSlice";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert, Loader2, Edit3, X } from "lucide-react";
import LocationPicker from "./map/LocationPicker";

const PREDEFINED_SKILLS = [
  "Electrician", "Plumber", "Carpenter", "Painter",
  "Mason", "Welder", "Waiter", "Chef", "Security Guard", "Driver",
];

const toLocalInput = (iso) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

function EditShiftModal({ shift, hasApplicants, onClose }) {
  const dispatch = useDispatch();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const initialSkills = Array.isArray(shift.skillRequired)
    ? shift.skillRequired
    : shift.skillRequired
      ? [shift.skillRequired]
      : [];

  const [customSkillInput, setCustomSkillInput] = useState("");

  const [form, setForm] = useState({
    title: shift.title || "",
    description: shift.description || "",
    skillRequired: initialSkills,
    hourlyPay: shift.hourlyPay != null ? shift.hourlyPay / 100 : "",
    workersNeeded: shift.workersNeeded ?? 1,
    startTime: toLocalInput(shift.startTime),
    endTime: toLocalInput(shift.endTime),
    address: shift.address || "",
    lat: shift.location?.coordinates?.[1] ?? null,
    lng: shift.location?.coordinates?.[0] ?? null,
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((p) => { const n = { ...p }; delete n[k]; return n; });
  };

  const locked = hasApplicants;

  const handleSkillToggle = (skill) => {
    setForm((f) => {
      const isSelected = f.skillRequired.includes(skill);
      const newSkills = isSelected
        ? f.skillRequired.filter((s) => s !== skill)
        : [...f.skillRequired, skill];
      return { ...f, skillRequired: newSkills };
    });
    if (errors.skillRequired)
      setErrors((p) => { const n = { ...p }; delete n.skillRequired; return n; });
  };

  const addCustomSkill = () => {
    const val = customSkillInput.trim();
    if (val && !form.skillRequired.includes(val)) {
      setForm((f) => ({ ...f, skillRequired: [...f.skillRequired, val] }));
      setCustomSkillInput("");
      if (errors.skillRequired)
        setErrors((p) => { const n = { ...p }; delete n.skillRequired; return n; });
    }
  };

  // Mirrors server/src/routes/shifts.js shiftWriteBaseSchema
  function validate() {
    const e = {};
    const title = form.title.trim();
    if (title.length < 3 || title.length > 120)
      e.title = "Title must be 3-120 characters";
    if ((form.description ?? "").length > 2000)
      e.description = "Max 2000 characters";

    if (locked) return e; // rest is frozen once workers applied

    if (!form.skillRequired?.length)
      e.skillRequired = "Select at least one skill";

    const pay = Number(form.hourlyPay);
    if (!Number.isFinite(pay) || pay < 1 || pay > 100000)
      e.hourlyPay = "Pay must be ₹1–₹1,00,000/hr";

    const workers = Number(form.workersNeeded);
    if (!Number.isInteger(workers) || workers < 1 || workers > 50)
      e.workersNeeded = "Must be 1-50 workers";

    const origStart = new Date(shift.startTime).getTime();
    const newStart = new Date(form.startTime).getTime();
    const newEnd = new Date(form.endTime).getTime();

    if (!Number.isFinite(newStart)) e.startTime = "Start time required";
    else if (newStart !== origStart && newStart <= Date.now())
      e.startTime = "Must be in the future";

    if (!Number.isFinite(newEnd)) e.endTime = "End time required";
    else if (newEnd <= newStart) e.endTime = "Must be after start";
    else if ((newEnd - newStart) / 3600000 > 16) e.endTime = "Max 16 hours";

    const addr = (form.address || "").trim();
    if (addr.length < 3 || addr.length > 300)
      e.address = "Address 3-300 characters";
    else if (form.lat == null || form.lng == null || (form.lat === 0 && form.lng === 0))
      e.address = "Choose a real work site on the map";

    return e;
  }

  async function save(e) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const changes = {};
    if (form.title.trim() !== shift.title) changes.title = form.title.trim();
    if (form.description !== (shift.description || ""))
      changes.description = form.description;

    if (!locked) {
      const currentSkills = [...(form.skillRequired || [])].sort();
      const originalSkills = [...(initialSkills || [])].sort();
      if (JSON.stringify(currentSkills) !== JSON.stringify(originalSkills))
        changes.skillRequired = form.skillRequired;

      const newHourlyPay = Math.round(Number(form.hourlyPay) * 100);
      if (newHourlyPay !== shift.hourlyPay) changes.hourlyPay = newHourlyPay;
      if (Number(form.workersNeeded) !== shift.workersNeeded)
        changes.workersNeeded = Number(form.workersNeeded);

      const oldLat = shift.location?.coordinates?.[1] ?? null;
      const oldLng = shift.location?.coordinates?.[0] ?? null;
      const addressChanged = form.address.trim() !== shift.address;
      const pinMoved = form.lat !== oldLat || form.lng !== oldLng;

      if (addressChanged || pinMoved) {
        if (form.lat == null || form.lng == null)
          return toast.error("Choose the work site on the map");
        changes.address = form.address.trim();
        changes.lat = form.lat;
        changes.lng = form.lng;
      }

      if (new Date(form.startTime).toISOString() !== new Date(shift.startTime).toISOString())
        changes.startTime = new Date(form.startTime).toISOString();
      if (new Date(form.endTime).toISOString() !== new Date(shift.endTime).toISOString())
        changes.endTime = new Date(form.endTime).toISOString();
    }

    if (Object.keys(changes).length === 0) {
      toast.success("No changes to update");
      return onClose();
    }

    setSaving(true);
    const result = await dispatch(updateShift({ shiftId: shift._id, changes }));
    setSaving(false);
    if (updateShift.fulfilled.match(result)) {
      toast.success("Shift updated");
      onClose();
    } else {
      toast.error(result.payload || "Failed to update shift");
    }
  }

  return (
    <AnimatePresence>
      {shift && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-110" role="dialog" aria-modal="true" aria-label="Edit shift">
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !saving && onClose()}
          />
          <motion.div
            className="modal-box sm:max-w-xl bg-base-100 p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative max-h-[95vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-lg text-base-content tracking-tight">Edit shift</h3>
              </div>
              <button type="button" onClick={() => !saving && onClose()} className="btn btn-sm btn-circle btn-ghost">
                <X className="w-4 h-4" />
              </button>
            </div>

            {locked && (
              <div className="mb-4 flex items-start gap-2 text-[11px] text-info bg-info/10 border border-info/20 p-3 rounded-xl font-medium leading-relaxed">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-info" />
                <span>Core details are locked because workers have already applied. You can still modify the title and description.</span>
              </div>
            )}

            <form onSubmit={save} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
              <div className="form-control sm:col-span-2">
                <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0.5 mb-0.5">Title</label>
                <input
                  className={`input input-sm input-bordered w-full focus:outline-primary/50 focus:border-primary bg-base-100 text-sm rounded-lg ${errors.title ? "input-error" : ""}`}
                  value={form.title}
                  onChange={set("title")}
                  minLength={3}
                  maxLength={120}
                  required
                />
                {errors.title && <p className="text-error text-xs mt-1 font-medium">{errors.title}</p>}
              </div>

              <div className="form-control sm:col-span-2">
                <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0.5 mb-0.5">Description</label>
                <textarea
                  className={`textarea textarea-sm textarea-bordered w-full focus:outline-primary/50 focus:border-primary bg-base-100 text-sm h-16 resize-none rounded-lg leading-snug ${errors.description ? "input-error" : ""}`}
                  maxLength={2000}
                  value={form.description}
                  onChange={set("description")}
                />
                {errors.description && <p className="text-error text-xs mt-1 font-medium">{errors.description}</p>}
              </div>

              <div className="form-control sm:col-span-2">
                <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0.5 mb-0.5">Skills Required</label>
                <div className={`space-y-3 p-3 rounded-xl border ${errors.skillRequired ? "border-error bg-error/5" : locked ? "opacity-60 bg-base-200 border-base-300" : "border-base-300 bg-base-200/30"}`}>
                  <div className="flex flex-wrap gap-1.5">
                    {PREDEFINED_SKILLS.map((skill) => {
                      const isSelected = form.skillRequired.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          disabled={locked}
                          onClick={() => handleSkillToggle(skill)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                            isSelected
                              ? "bg-primary text-primary-content border-primary shadow-sm"
                              : "bg-base-100 text-base-content/70 border-base-300 hover:bg-base-300"
                          }`}
                        >
                          {isSelected ? "✓ " : "+ "}{skill}
                        </button>
                      );
                    })}
                  </div>

                  {!locked && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type custom skill..."
                        className="input input-sm input-bordered w-full rounded-lg text-xs bg-base-100"
                        value={customSkillInput}
                        onChange={(e) => setCustomSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); }
                        }}
                      />
                      <button type="button" className="btn btn-sm btn-outline rounded-lg shrink-0" onClick={addCustomSkill}>
                        Add
                      </button>
                    </div>
                  )}

                  {form.skillRequired.filter((s) => !PREDEFINED_SKILLS.includes(s)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-base-300">
                      {form.skillRequired.filter((s) => !PREDEFINED_SKILLS.includes(s)).map((skill) => (
                        <span key={skill} className="badge badge-secondary badge-sm gap-1 py-2 px-2.5">
                          {skill}
                          {!locked && (
                            <button type="button" onClick={() => handleSkillToggle(skill)} className="hover:text-error">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {errors.skillRequired && <p className="text-error text-xs mt-1 font-medium">{errors.skillRequired}</p>}
              </div>

              <div className="form-control">
                <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0.5 mb-0.5">Pay (₹/hr)</label>
                <input
                  className={`input input-sm input-bordered w-full focus:outline-primary/50 focus:border-primary bg-base-100 text-sm rounded-lg ${errors.hourlyPay ? "input-error" : ""}`}
                  type="number" min="1" max="100000" step="any"
                  value={form.hourlyPay}
                  onChange={set("hourlyPay")}
                  disabled={locked}
                  required
                />
                {errors.hourlyPay && <p className="text-error text-xs mt-1 font-medium">{errors.hourlyPay}</p>}
              </div>

              <div className="form-control">
                <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0.5 mb-0.5">Workers</label>
                <input
                  className={`input input-sm input-bordered w-full focus:outline-primary/50 focus:border-primary bg-base-100 text-sm rounded-lg ${errors.workersNeeded ? "input-error" : ""}`}
                  type="number" min="1" max="50"
                  value={form.workersNeeded}
                  onChange={set("workersNeeded")}
                  disabled={locked}
                  required
                />
                {errors.workersNeeded && <p className="text-error text-xs mt-1 font-medium">{errors.workersNeeded}</p>}
              </div>

              <div className="form-control">
                <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0.5 mb-0.5">Start Time</label>
                <input
                  className={`input input-sm input-bordered w-full focus:outline-primary/50 focus:border-primary bg-base-100 text-sm rounded-lg ${errors.startTime ? "input-error" : ""}`}
                  type="datetime-local"
                  value={form.startTime}
                  onChange={set("startTime")}
                  disabled={locked}
                  required
                />
                {errors.startTime && <p className="text-error text-xs mt-1 font-medium">{errors.startTime}</p>}
              </div>

              <div className="form-control">
                <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0.5 mb-0.5">End Time</label>
                <input
                  className={`input input-sm input-bordered w-full focus:outline-primary/50 focus:border-primary bg-base-100 text-sm rounded-lg ${errors.endTime ? "input-error" : ""}`}
                  type="datetime-local"
                  value={form.endTime}
                  onChange={set("endTime")}
                  disabled={locked}
                  required
                />
                {errors.endTime && <p className="text-error text-xs mt-1 font-medium">{errors.endTime}</p>}
              </div>

              <div className="form-control sm:col-span-2">
                <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0.5 mb-0.5">Work site</label>
                <LocationPicker
                  address={form.address}
                  lat={form.lat}
                  lng={form.lng}
                  disabled={locked}
                  error={errors.address}
                  onChange={({ address, lat, lng }) => {
                    setForm((f) => ({ ...f, address: address ?? "", lat: lat ?? null, lng: lng ?? null }));
                    if (errors.address)
                      setErrors((p) => { const n = { ...p }; delete n.address; return n; });
                  }}
                />
              </div>

              <div className="modal-action sm:col-span-2 pt-3 mt-2 border-t border-base-200 flex gap-2">
                <button type="button" className="btn btn-sm btn-ghost flex-1 rounded-xl" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-primary flex-1 rounded-xl shadow-sm shadow-primary/20 font-bold gap-1.5" disabled={saving}>
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default EditShiftModal;