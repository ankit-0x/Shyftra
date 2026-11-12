// client/src/components/admin/DisputesPanel.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { fetchAdminDisputes, ruleOnDispute } from "../../store/adminSlice";
import api from "../../api/axios";
import { useLiveTick } from "../../hooks/useLiveTick";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import AdminSearchBar from "./AdminSearchBar";
import {
  Scale,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ShieldAlert,
  User,
  Building2,
  Check,
  AlertCircle,
} from "lucide-react";

const FILTERS = [
  { value: "under_review", label: "Needs ruling" },
  { value: "awaiting_proof", label: "Awaiting proof" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

const STATUS_BADGE = {
  awaiting_proof: "badge-warning",
  under_review: "badge-info",
  resolved: "badge-success",
};

function RuleForm({ dispute, onDone }) {
  const dispatch = useDispatch();
  const { isActionLoading } = useSelector((state) => state.admin);
  const [ruledFor, setRuledFor] = useState(null);
  const [resolution, setResolution] = useState("");
  const tooShort = resolution.trim().length < 5;

  async function submit() {
    if (tooShort || !ruledFor) return;
    const result = await dispatch(
      ruleOnDispute({
        disputeId: dispute._id,
        ruledFor,
        resolution: resolution.trim(),
      }),
    );
    if (ruleOnDispute.fulfilled.match(result)) onDone();
  }

  return (
    <div className="mt-4 space-y-4 border-t border-base-200 pt-4 animate-fade-in">
      <div>
        <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-2 block">
          Select Ruling Party
        </label>
        <div className="flex gap-3">
          {["worker", "employer"].map((side) => (
            <button
              key={side}
              type="button"
              className={`btn btn-sm capitalize flex-1 gap-2 ${ruledFor === side ? "btn-primary shadow-sm" : "btn-outline border-base-300"}`}
              onClick={() => setRuledFor(side)}
            >
              {ruledFor === side && <Check className="w-4 h-4" />} Rule for {side}
            </button>
          ))}
        </div>
      </div>

      <div className="form-control">
        <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1 block">
          Resolution Note <span className="text-error">*</span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full text-sm h-24 focus:outline-primary/50 focus:border-primary resize-none bg-base-100"
          maxLength={1000}
          placeholder="Provide a clear resolution note (required, shown in the audit trail)..."
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
        />
        {tooShort && resolution.length > 0 && (
          <p className="text-error text-xs mt-1 font-medium">
            Please enter at least 5 characters.
          </p>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={onDone}
          disabled={isActionLoading}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary px-5 shadow-sm shadow-primary/20"
          onClick={submit}
          disabled={!ruledFor || tooShort || isActionLoading}
        >
          {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Confirm ruling
        </button>
      </div>
    </div>
  );
}

async function openEvidence(disputeId, publicId) {
  try {
    const { data } = await api.get(`/api/disputes/${disputeId}/evidence/url`, {
      params: { publicId },
    });
    window.open(data.url, "_blank", "noopener,noreferrer");
  } catch (err) {
    toast.error(err.response?.data?.error || "Failed to open file");
  }
}

function DisputeCard({ dispute }) {
  const [ruling, setRuling] = useState(false);
  const canRule = ["awaiting_proof", "under_review"].includes(dispute.status);

  return (
    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-5 hover:border-primary/30 transition-colors">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-base-content truncate">
            {dispute.shift?.title || "Deleted shift"}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/60 mt-1">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Worker:{" "}
              <strong className="text-base-content">
                {dispute.worker?.name || "—"}
              </strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Employer:{" "}
              <strong className="text-base-content">
                {dispute.employer?.name || "—"}
              </strong>
            </span>
          </div>
          <p className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Raised{" "}
            {new Date(dispute.createdAt).toLocaleString()}
          </p>
        </div>

        <span
          className={`badge font-medium capitalize px-3 py-3 ${STATUS_BADGE[dispute.status] || "badge-ghost"}`}
        >
          {dispute.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 bg-base-200/50 p-3.5 rounded-xl border border-base-200">
        <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1">
          Worker's Reason
        </p>
        <p className="text-sm text-base-content/80 leading-relaxed">
          {dispute.reason}
        </p>
      </div>

      {dispute.status === "awaiting_proof" && dispute.proofDeadline && (
        <div className="mt-3 flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/20 p-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Employer has until{" "}
            <strong className="font-semibold">
              {new Date(dispute.proofDeadline).toLocaleString()}
            </strong>{" "}
            to upload proof, otherwise the worker is paid automatically.
          </p>
        </div>
      )}

      {dispute.evidencePublicIds?.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
            Employer Evidence
          </p>
          <div className="flex flex-wrap gap-2">
            {dispute.evidencePublicIds.map((publicId, i) => (
              <button
                key={publicId}
                type="button"
                onClick={() => openEvidence(dispute._id, publicId)}
                className="btn btn-xs btn-outline border-base-300 gap-1.5 hover:bg-base-200 hover:text-base-content"
              >
                <FileText className="w-3.5 h-3.5 text-primary" /> File {i + 1}{" "}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      ) : dispute.evidenceUrls?.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
            Employer Evidence (legacy)
          </p>
          <div className="flex flex-wrap gap-2">
            {dispute.evidenceUrls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-xs btn-outline border-base-300 gap-1.5 hover:bg-base-200 hover:text-base-content"
              >
                <FileText className="w-3.5 h-3.5 text-primary" /> File {i + 1}{" "}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {dispute.status === "resolved" && (
        <div className="mt-4 flex items-start gap-2 text-sm bg-success/10 border border-success/20 text-success p-3 rounded-xl">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Ruled for {dispute.ruledFor}{" "}
              {dispute.autoResolved ? " (Automatic)" : ""}
            </p>
            {dispute.resolution && (
              <p className="text-xs opacity-90 mt-1 leading-relaxed">
                Note: {dispute.resolution}
              </p>
            )}
          </div>
        </div>
      )}

      {canRule &&
        (ruling ? (
          <RuleForm dispute={dispute} onDone={() => setRuling(false)} />
        ) : (
          <div className="mt-4 pt-4 border-t border-base-200">
            <button
              type="button"
              className="btn btn-sm btn-primary gap-2 shadow-sm shadow-primary/20"
              onClick={() => setRuling(true)}
            >
              <Scale className="w-4 h-4" /> Rule on this dispute
            </button>
          </div>
        ))}
    </div>
  );
}

export default function DisputesPanel() {
  const dispatch = useDispatch();
  const {
    disputes,
    isLoadingDisputes,
    disputesPage,
    disputesHasMore,
    disputesTotal,
    error,
  } = useSelector((state) => state.admin);

  const [filter, setFilter] = useState("under_review");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  const tick = useLiveTick("admin:queue_changed");

  useEffect(() => {
    dispatch(
      fetchAdminDisputes({
        status: filter,
        page: 1,
        q: debouncedSearch || undefined,
      }),
    );
  }, [dispatch, filter, debouncedSearch, tick]);

  return (
    <div className="space-y-4 animate-fade-in">
      <AdminSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search reason text…"
        filterGroups={[
          {
            value: filter,
            onChange: setFilter,
            options: FILTERS,
          },
        ]}
        rightSlot={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-base-200/60 rounded-lg text-xs font-semibold text-base-content/70 whitespace-nowrap">
            <Scale className="w-3.5 h-3.5" />
            {disputesTotal} dispute{disputesTotal === 1 ? "" : "s"}
          </div>
        }
      />

              {/* 🆕 Error banner */}
      {error && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {isLoadingDisputes && disputes.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-base-100 rounded-2xl border border-base-200 p-12 text-center flex flex-col items-center justify-center">
          <ShieldAlert className="w-12 h-12 text-base-content/20 mb-3" />
          <h3 className="text-lg font-bold">No disputes found</h3>
          <p className="text-base-content/60 mt-1">
            {searchQuery
              ? "Try a different search term."
              : "There are no disputes matching this view."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <DisputeCard key={d._id} dispute={d} />
          ))}
        </div>
      )}

            {disputesHasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="btn btn-outline btn-sm rounded-xl gap-2 min-w-40"
            disabled={isLoadingDisputes}
            onClick={() =>
              dispatch(
                fetchAdminDisputes({
                  status: filter,
                  page: disputesPage + 1,
                  q: debouncedSearch || undefined,
                }),
              )
            }
          >
            {isLoadingDisputes && <Loader2 className="w-4 h-4 animate-spin" />}
            Load more disputes
          </button>
        </div>
      ) : (
        disputes.length > 0 && (
          <p className="text-xs text-base-content/50 text-center py-2">
            All {disputesTotal} dispute{disputesTotal === 1 ? "" : "s"} shown
          </p>
        )
      )}
    </div>
  );
}