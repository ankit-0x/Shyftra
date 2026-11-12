// client/src/components/WorkerCardSkeleton.jsx
function WorkerCardSkeleton() {
  return (
    <div className="bg-base-100 rounded-2xl border border-base-200 shadow-sm p-4 sm:p-5 animate-pulse flex flex-col justify-between h-full">
      {/* Top Section: Avatar & Name Placeholder */}
      <div className="flex items-start gap-3.5 mb-4">
        <div className="w-11 h-11 rounded-xl bg-base-300/80 shrink-0"></div>
        <div className="flex-1 space-y-2 py-0.5">
          <div className="h-4 bg-base-300/80 rounded-md w-3/4"></div>
          <div className="h-3.5 bg-base-300/80 rounded-md w-1/2"></div>
        </div>
      </div>

      {/* Metrics & Badges Footer Placeholder */}
      <div className="pt-3 border-t border-base-200/60 flex items-center gap-2">
        <div className="h-6 bg-base-300/80 rounded-lg w-20"></div>
        <div className="h-6 bg-base-300/80 rounded-lg w-24"></div>
      </div>
    </div>
  );
}

export default WorkerCardSkeleton;