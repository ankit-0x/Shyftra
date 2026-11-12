// client/src/components/DisputeEvidenceModal.jsx
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, X, FileText, Loader2, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

// Mirrors server/src/routes/disputes.js (ALLOWED_EVIDENCE_TYPES, files: 5,
// fileSize: 50 MB). The server also sniffs real file contents, so renaming
// a file to dodge this check won't work.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];
const MAX_FILES = 5;
const MAX_BYTES = 50 * 1024 * 1024;

function DisputeEvidenceModal({ open, onSubmit, onCancel, isLoading, disputeDeadline }) {
  const [files, setFiles] = useState([]);

  function handleFileChange(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // lets the same file be picked again after removing it
    const valid = [];
    for (const f of picked) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: only JPEG, PNG, WebP, MP4, WebM or MOV files are accepted`);
      } else if (f.size > MAX_BYTES) {
        toast.error(`${f.name} is larger than 50 MB`);
      } else {
        valid.push(f);
      }
    }
    setFiles((prev) => {
      const merged = [...prev, ...valid];
      if (merged.length > MAX_FILES) toast.error(`You can attach up to ${MAX_FILES} files`);
      return merged.slice(0, MAX_FILES);
    });
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-110" role="dialog" aria-modal="true">
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !isLoading && onCancel()}
          />
          <motion.div
            className="modal-box sm:max-w-lg bg-base-100 p-6 sm:p-8 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative"
            initial={{ opacity: 0, scale: 0.95, y: 12 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div>
              <h3 className="font-extrabold text-xl text-base-content tracking-tight">Upload proof</h3>
              <p className="text-sm text-base-content/60 mt-1 leading-relaxed">
                CCTV stills, attendance logs, timestamped photos — anything supporting the exit time you recorded.
              </p>
              {disputeDeadline && (
                <div className="mt-3 flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/20 p-3 rounded-xl font-medium">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
                  <span>You have until <strong className="font-bold">{new Date(disputeDeadline).toLocaleString()}</strong> to upload evidence.</span>
                </div>
              )}
            </div>

            <label className="mt-5 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-base-300 rounded-2xl p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-base-200 group-hover:bg-primary/10 flex items-center justify-center text-base-content/60 group-hover:text-primary transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-base-content mt-1">Click to choose up to 5 files</span>
              <span className="text-xs text-base-content/50 text-center">Photos (JPEG, PNG, WebP) or video (MP4, WebM, MOV) · max 50 MB each</span>
              <input type="file" accept={ALLOWED_TYPES.join(",")} multiple className="hidden" onChange={handleFileChange} />
            </label>

            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-xs sm:text-sm bg-base-200/60 border border-base-200 rounded-xl px-3 py-2.5">
                    <span className="truncate flex items-center gap-2 font-medium text-base-content/80">
                      <FileText className="w-4 h-4 text-primary shrink-0" /> {f.name}
                    </span>
                    <button 
                      type="button"
                      onClick={() => removeFile(i)} 
                      className="btn btn-xs btn-ghost btn-circle text-base-content/50 hover:text-error"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-action pt-4 mt-6 border-t border-base-200 flex gap-3">
              <button 
                type="button" 
                className="btn btn-ghost flex-1 rounded-xl" 
                onClick={onCancel} 
                disabled={isLoading}
              >
                Never mind
              </button>
              <button 
                type="button" 
                className="btn btn-primary flex-1 rounded-xl shadow-md shadow-primary/20 font-bold gap-2" 
                onClick={() => onSubmit(files)} 
                disabled={isLoading || files.length === 0}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Proof
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default DisputeEvidenceModal;