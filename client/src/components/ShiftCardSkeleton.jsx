// client/src/components/ShiftCardSkeleton.jsx
// A fake, grey, pulsing version of ShiftCard — same size/shape, no real
// data — shown while the real data is still loading.

function ShiftCardSkeleton() {
  return (
    <div className="bg-base-100 rounded-2xl border border-base-200 shadow-sm p-4 sm:p-5 animate-pulse">
      {/* Header: Employer & Rating Placeholder */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="h-3.5 bg-base-300/80 rounded-md w-1/3 sm:w-1/4"></div>
        <div className="h-4 bg-base-300/80 rounded-md w-10"></div>
      </div>

      {/* Title Placeholder */}
      <div className="space-y-2.5 mb-4">
        <div className="h-5 sm:h-6 bg-base-300/80 rounded-lg w-3/4"></div>
        <div className="h-5 sm:h-6 bg-base-300/80 rounded-lg w-1/2"></div>
      </div>

      {/* Core Metrics Pills Placeholder */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="h-6 sm:h-7 bg-base-300/80 rounded-lg w-20"></div>
        <div className="h-6 sm:h-7 bg-base-300/80 rounded-lg w-28"></div>
        <div className="h-6 sm:h-7 bg-base-300/80 rounded-lg w-24 hidden sm:block"></div>
      </div>

      {/* Address Footer Placeholder */}
      <div className="pt-3.5 border-t border-base-200/60 flex items-start gap-2">
        <div className="w-3.5 h-3.5 shrink-0 bg-base-300/80 rounded-full mt-0.5"></div>
        <div className="h-3.5 bg-base-300/80 rounded-md w-full max-w-[80%] mt-0.5"></div>
      </div>
    </div>
  );
}

export default ShiftCardSkeleton;