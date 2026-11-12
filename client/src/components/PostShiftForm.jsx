// client/src/components/PostShiftForm.jsx
import { useEffect, useState, useMemo } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSelector, useDispatch } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import {
  Type,
  Users,
  IndianRupee,
  Calendar,
  Info,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Gift,
  ShieldAlert,
  Wrench,
  X,
  Loader2,
} from "lucide-react";
import {
  runProtectedAction,
  getPendingPostShift,
  clearPendingPostShift,
} from "../utils/runProtectedAction";
import { resetSuccessFlag, fetchMyShifts } from "../store/employerShiftsSlice";
import { incrementFreeShifts } from "../store/authSlice";
import {
  PLATFORM_FEE_FLAT,
  FREE_SHIFTS_LIMIT,
} from "../constants/businessRule";
import ConfirmShiftPostModal from "./ConfirmShiftPostModal";
import LocationPicker from "./map/LocationPicker";
import toast from "react-hot-toast";

const PREDEFINED_SKILLS = [
  "Electrician", "Plumber", "Carpenter", "Painter", 
  "Mason", "Welder", "Waiter", "Chef", "Security Guard", "Driver"
];

const shiftFormSchema = z
  .object({
    title: z.string().min(3, "Title is too short"),
    description: z.string().max(2000).optional(),
    skillRequired: z.array(z.string()).min(1, "Select at least one skill"), // Array of strings
    hourlyPay: z.coerce.number().positive("Enter a valid hourly rate"),
    workersNeeded: z.coerce.number().int().positive().default(1),
    startTime: z
      .string()
      .min(1, "Start time is required")
      .refine((val) => new Date(val) > new Date(), {
        message: "Start time must be in the future",
      }),
    endTime: z.string().min(1, "End time is required"),
    address: z.string().max(300).optional(),
    lat: z.number().min(-90, "Latitude is out of range").max(90, "Latitude is out of range").optional(),
    lng: z.number().min(-180, "Longitude is out of range").max(180, "Longitude is out of range").optional(),
  })
  .refine((data) => !!(data.address && data.address.trim().length >= 3), {
    message: "Choose the work site: pick a suggestion, use your location, or tap the map",
    path: ["address"],
  })
  .refine((data) => data.lat !== undefined && data.lng !== undefined, {
    message: "Choose the work site: pick a suggestion, use your location, or tap the map",
    path: ["lat"],
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "End time must be after start time",
    path: ["endTime"],
  });

function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function PostShiftForm({ location, permissionDenied }) {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const { shiftCreatedSuccess, myShifts } = useSelector(
    (state) => state.employerShifts,
  );

  const [pendingPayload, setPendingPayload] = useState(null);
  const [resetDone, setResetDone] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [draftRev, setDraftRev] = useState(0);
  const [customSkillInput, setCustomSkillInput] = useState("");

  const { savedPayload, isSavedPayloadValid } = useMemo(() => {
    if (resetDone) return { savedPayload: null, isSavedPayloadValid: false };
    const payload = getPendingPostShift();
    if (!payload) return { savedPayload: null, isSavedPayloadValid: false };
    const now = Date.now();
    const start = payload.startTime ? new Date(payload.startTime).getTime() : 0;
    const end = payload.endTime ? new Date(payload.endTime).getTime() : 0;
    const valid = start > now && end > now && end > start;
    return { savedPayload: payload, isSavedPayloadValid: valid };
  }, [resetDone, draftRev]);

  const defaultValues = useMemo(() => {
    if (!isSavedPayloadValid || !savedPayload) return undefined;
    return {
      ...savedPayload,
      // Backwards compatibility: if saved draft has a string skill, convert to array
      skillRequired: Array.isArray(savedPayload.skillRequired) 
        ? savedPayload.skillRequired 
        : (savedPayload.skillRequired ? [savedPayload.skillRequired] : []),
      startTime: isoToLocalInput(savedPayload.startTime),
      endTime: isoToLocalInput(savedPayload.endTime),
      hourlyPay: (savedPayload.hourlyPay ?? 0) / 100,
    };
  }, [isSavedPayloadValid, savedPayload]);

  const showExpiredNotice = !!savedPayload && !isSavedPayloadValid && !resetDone;

  const [showResumeNotice, setShowResumeNotice] = useState(false);
  useEffect(() => {
    setShowResumeNotice(false);
    if (!isSavedPayloadValid || resetDone) return undefined;
    setShowResumeNotice(true);
    const timer = setTimeout(() => setShowResumeNotice(false), 5000);
    return () => clearTimeout(timer);
  }, [isSavedPayloadValid, resetDone]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty, isSubmitted },
  } = useForm({ resolver: zodResolver(shiftFormSchema), defaultValues });

  useEffect(() => {
    if (resetDone) return undefined;
    function checkDraft() {
      if (document.hidden) return;
      const fresh = getPendingPostShift();
      const haveDraft = !!fresh;
      const hadDraft = !!savedPayload;
      if (haveDraft && !hadDraft) setDraftRev((v) => v + 1);
    }
    window.addEventListener("focus", checkDraft);
    document.addEventListener("visibilitychange", checkDraft);
    const timer = setTimeout(checkDraft, 1500);
    return () => {
      window.removeEventListener("focus", checkDraft);
      document.removeEventListener("visibilitychange", checkDraft);
      clearTimeout(timer);
    };
  }, [resetDone, savedPayload]);

  const [handledSuccess, setHandledSuccess] = useState(false);
  if (shiftCreatedSuccess !== handledSuccess) {
    setHandledSuccess(shiftCreatedSuccess);
  }

  useEffect(() => {
    if (shiftCreatedSuccess) {
      reset();
      dispatch(resetSuccessFlag());
      clearPendingPostShift();
      dispatch(incrementFreeShifts());
    }
  }, [shiftCreatedSuccess, reset, dispatch]);

  useEffect(() => {
    if (showExpiredNotice) {
      clearPendingPostShift();
      reset();
    }
  }, [showExpiredNotice, reset]);

  useEffect(() => {
    if (savedPayload && isSavedPayloadValid) {
      reset({
        ...savedPayload,
        skillRequired: Array.isArray(savedPayload.skillRequired) 
          ? savedPayload.skillRequired 
          : (savedPayload.skillRequired ? [savedPayload.skillRequired] : []),
        startTime: isoToLocalInput(savedPayload.startTime),
        endTime: isoToLocalInput(savedPayload.endTime),
        hourlyPay: (savedPayload.hourlyPay ?? 0) / 100,
      });
    }
  }, [savedPayload, isSavedPayloadValid, reset]);

  useEffect(() => {
    if (user && myShifts.length === 0) {
      dispatch(fetchMyShifts());
    }
  }, [dispatch, user, myShifts.length]);

  const [watchedHourlyPay, watchedStart, watchedEnd] = useWatch({
    control,
    name: ["hourlyPay", "startTime", "endTime"],
  });

  useEffect(() => {
    register("address");
    register("lat");
    register("lng");
  }, [register]);
  
  const [watchedAddress, watchedLat, watchedLng] = useWatch({
    control,
    name: ["address", "lat", "lng"],
  });

  const estimatedEscrowPerWorker = useMemo(() => {
    const pay = Number(watchedHourlyPay);
    if (!pay || !watchedStart || !watchedEnd) return null;
    const hours = (new Date(watchedEnd) - new Date(watchedStart)) / (1000 * 60 * 60);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return +(hours * pay).toFixed(2);
  }, [watchedHourlyPay, watchedStart, watchedEnd]);

  const walletSummary = useSelector((state) => state.wallet.summary);
  const walletBalance = walletSummary?.balance ?? user?.walletBalance ?? 0;
  const canAffordFee = walletBalance >= PLATFORM_FEE_FLAT || user?.freeShiftsUsed < FREE_SHIFTS_LIMIT;

  function onSubmit(data) {
    const payload = {
      ...data,
      hourlyPay: Math.round(Number(data.hourlyPay) * 100),
      startTime: new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString(),
    };
    setPendingPayload(payload);
  }

  function handleConfirmPost() {
    if (!pendingPayload) return;
    runProtectedAction("post_shift", pendingPayload);
    setPendingPayload(null);
  }

  function handleManualReset() {
    const hasContent = isDirty || !!savedPayload;
    if (hasContent) {
      setConfirmResetOpen(true);
      return;
    }
    performReset();
  }

  function performReset() {
    clearPendingPostShift();
    setResetDone(true);
    reset({
      title: "",
      description: "",
      skillRequired: [],
      hourlyPay: "",
      workersNeeded: 1,
      startTime: "",
      endTime: "",
      address: "",
      lat: undefined,
      lng: undefined,
    });
    setCustomSkillInput("");
    toast.success("Form cleared");
    setConfirmResetOpen(false);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-base-100 rounded-3xl border border-base-200 shadow-sm p-5 sm:p-8 space-y-5"
      >
        <div className="flex justify-between items-center pb-2 border-b border-base-200">
          <h2 className="text-xl sm:text-2xl font-extrabold text-base-content tracking-tight">
            Post a Shift
          </h2>
          <button
            type="button"
            onClick={handleManualReset}
            className="btn btn-sm btn-ghost text-error hover:bg-error/10 rounded-xl gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Reset</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {user && user.role === "employer" && (
            <>
              {(user.freeShiftsUsed ?? 0) < FREE_SHIFTS_LIMIT ? (
                <div className="rounded-xl border border-info/20 bg-info/10 px-4 py-3 text-sm flex gap-3 text-base-content">
                  <Gift className="w-5 h-5 shrink-0 text-info mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Free post {(user.freeShiftsUsed ?? 0) + 1}/{FREE_SHIFTS_LIMIT}</strong> — no platform fee. After {FREE_SHIFTS_LIMIT} free posts, posting a shift charges a flat ₹{PLATFORM_FEE_FLAT}.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm flex gap-3 text-base-content">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-warning mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Free posts used up.</strong>{" "}
                    <a href="/profile" className="link link-primary font-bold">Flat ₹{PLATFORM_FEE_FLAT} Charged</a> to post more shifts.
                  </p>
                </div>
              )}
            </>
          )}

          {showResumeNotice && !showExpiredNotice && (
            <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm flex gap-3 text-base-content">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-success mt-0.5" />
              <p className="leading-relaxed"><strong>Form restored.</strong> Your previous entry was auto-filled.</p>
            </div>
          )}

          {showExpiredNotice && (
            <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm flex gap-3 text-base-content">
              <AlertTriangle className="w-5 h-5 shrink-0 text-warning mt-0.5" />
              <p className="leading-relaxed">Previous form data was cleared because the shift time passed.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
          <div className="form-control sm:col-span-2">
            <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1">Title</label>
            <div className="relative flex items-center">
              <Type className="absolute left-3.5 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                {...register("title")}
                placeholder="E.g., Event Bartender needed for wedding"
                className={`input input-bordered w-full pl-10 rounded-xl focus:outline-primary/20 focus:border-primary text-sm ${errors.title ? "border-error" : ""}`}
              />
            </div>
            {errors.title && <p className="text-error text-xs mt-1.5 font-medium">{errors.title.message}</p>}
          </div>

          <div className="form-control sm:col-span-2">
            <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1">Description (Optional)</label>
            <textarea
              {...register("description")}
              placeholder="Provide details about the shift tasks, dress code, etc."
              className="textarea textarea-bordered w-full rounded-xl focus:outline-primary/20 focus:border-primary text-sm h-24 resize-none leading-relaxed"
            />
          </div>

          {/* ================= MULTIPLE SKILLS SELECT ================= */}
          <div className="form-control sm:col-span-2">
            <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1">
              Skills Required (Select Multiple)
            </label>
            
            <Controller
              control={control}
              name="skillRequired"
              render={({ field }) => (
                <div className={`space-y-3 p-4 rounded-xl border ${errors.skillRequired ? 'border-error bg-error/5' : 'border-base-300 bg-base-200/30'}`}>
                  {/* Predefined Skills */}
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_SKILLS.map((skill) => {
                      const isSelected = field.value?.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => {
                            const newValue = isSelected
                              ? field.value.filter((s) => s !== skill)
                              : [...(field.value || []), skill];
                            field.onChange(newValue);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
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

                  {/* Custom Skill Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type custom skill & press Enter"
                      className="input input-sm input-bordered w-full rounded-lg text-sm bg-base-100"
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = customSkillInput.trim();
                          if (val && !field.value?.includes(val)) {
                            field.onChange([...(field.value || []), val]);
                            setCustomSkillInput("");
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline rounded-lg shrink-0"
                      onClick={() => {
                        const val = customSkillInput.trim();
                        if (val && !field.value?.includes(val)) {
                          field.onChange([...(field.value || []), val]);
                          setCustomSkillInput("");
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>

                  {/* Selected Custom Skills */}
                  {field.value?.filter(s => !PREDEFINED_SKILLS.includes(s)).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-base-300">
                      {field.value.filter(s => !PREDEFINED_SKILLS.includes(s)).map((skill) => (
                        <span key={skill} className="badge badge-secondary gap-1.5 py-3 px-3">
                          {skill}
                          <button type="button" onClick={() => field.onChange(field.value.filter(s => s !== skill))} className="hover:text-error">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            />
            {errors.skillRequired && <p className="text-error text-xs mt-1.5 font-medium">{errors.skillRequired.message}</p>}
          </div>
          {/* ========================================================= */}

          <div className="form-control">
            <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1">Workers Needed</label>
            <div className="relative flex items-center">
              <Users className="absolute left-3.5 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                {...register("workersNeeded")}
                type="number"
                min="1"
                placeholder="Count"
                className={`input input-bordered w-full pl-10 rounded-xl focus:outline-primary/20 focus:border-primary text-sm ${errors.workersNeeded ? "border-error" : ""}`}
              />
            </div>
            {errors.workersNeeded && <p className="text-error text-xs mt-1.5 font-medium">{errors.workersNeeded.message}</p>}
          </div>

          <div className="form-control">
            <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1">Hourly Pay (₹)</label>
            <div className="relative flex items-center">
              <IndianRupee className="absolute left-3.5 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                {...register("hourlyPay")}
                type="number"
                step="any"
                placeholder="Rate per hour"
                className={`input input-bordered w-full pl-10 rounded-xl focus:outline-primary/20 focus:border-primary text-sm ${errors.hourlyPay ? "border-error" : ""}`}
              />
            </div>
            {errors.hourlyPay && <p className="text-error text-xs mt-1.5 font-medium">{errors.hourlyPay.message}</p>}
          </div>

          <div className="form-control">
            <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1">Start Time</label>
            <div className="relative flex items-center">
              <Calendar className="absolute left-3.5 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                {...register("startTime")}
                type="datetime-local"
                className={`input input-bordered w-full pl-10 rounded-xl focus:outline-primary/20 focus:border-primary text-sm ${errors.startTime ? "border-error" : ""}`}
              />
            </div>
            {errors.startTime && <p className="text-error text-xs mt-1.5 font-medium">{errors.startTime.message}</p>}
          </div>

          <div className="form-control">
            <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1">End Time</label>
            <div className="relative flex items-center">
              <Calendar className="absolute left-3.5 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                {...register("endTime")}
                type="datetime-local"
                className={`input input-bordered w-full pl-10 rounded-xl focus:outline-primary/20 focus:border-primary text-sm ${errors.endTime ? "border-error" : ""}`}
              />
            </div>
            {errors.endTime && <p className="text-error text-xs mt-1.5 font-medium">{errors.endTime.message}</p>}
          </div>

          <div className="form-control sm:col-span-2">
            <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1">Site Address</label>
            <LocationPicker
              address={watchedAddress ?? ""}
              lat={watchedLat}
              lng={watchedLng}
              centerHint={permissionDenied ? null : location}
              error={errors.address?.message || errors.lat?.message || errors.lng?.message}
              onChange={({ address, lat, lng }) => {
                setValue("address", address ?? "", { shouldDirty: true, shouldValidate: isSubmitted });
                setValue("lat", lat, { shouldDirty: true, shouldValidate: isSubmitted });
                setValue("lng", lng, { shouldDirty: true, shouldValidate: isSubmitted });
              }}
            />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm flex gap-3 text-base-content/80">
            <Info className="w-5 h-5 shrink-0 text-warning mt-0.5" />
            <p className="leading-relaxed">
              Posting this shift charges a flat <strong className="text-base-content">₹{PLATFORM_FEE_FLAT}</strong> platform fee immediately.
              {estimatedEscrowPerWorker != null && (
                <> Accepting each worker will lock <strong className="text-base-content">₹{estimatedEscrowPerWorker}</strong> from your wallet until settled.</>
              )}
            </p>
          </div>

          {user && !canAffordFee && (
            <div className="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm flex gap-3 text-error">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">
                Your wallet balance (₹{walletBalance}) is below the ₹{PLATFORM_FEE_FLAT} fee. Please top up your wallet before posting.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full rounded-xl shadow-md shadow-primary/20 font-bold text-base"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
            {!user
              ? "Post Shift (Sign up required)"
              : !canAffordFee
                ? "Top up wallet to post"
                : isSubmitting
                  ? "Preparing Post..."
                  : "Review & Post Shift"}
          </button>
        </div>

        <ConfirmShiftPostModal
          open={!!pendingPayload}
          data={pendingPayload}
          myShifts={myShifts}
          isLoading={isSubmitting}
          onConfirm={handleConfirmPost}
          onCancel={() => setPendingPayload(null)}
        />
        <ResetConfirmModal
          open={confirmResetOpen}
          onConfirm={performReset}
          onCancel={() => setConfirmResetOpen(false)}
        />
      </form>
    </div>
  );
}

function ResetConfirmModal({ open, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-110" role="dialog" aria-modal="true">
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }} onClick={onCancel}
          />
          <motion.div
            className="modal-box sm:max-w-sm bg-base-100 p-6 sm:p-7 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative"
            initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-base-content tracking-tight">Clear form?</h3>
                <p className="text-sm text-base-content/60 mt-1 leading-relaxed">This will clear all the fields you've filled in. This action cannot be undone.</p>
              </div>
            </div>
            <div className="modal-action pt-4 mt-5 border-t border-base-200 flex gap-2">
              <button type="button" className="btn btn-ghost flex-1 rounded-xl" onClick={onCancel}>Never mind</button>
              <button type="button" className="btn btn-error flex-1 rounded-xl shadow-sm shadow-error/20 font-bold" onClick={onConfirm}>Clear form</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default PostShiftForm;