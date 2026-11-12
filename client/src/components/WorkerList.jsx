// client/src/components/WorkerList.jsx
import { motion } from "framer-motion";
import { useApiQuery } from "../hooks/useApiQuery";
import { useLiveTick } from "../hooks/useLiveTick";
import WorkerCard from "./WorkerCard";
import WorkerCardSkeleton from "./WorkerCardSkeleton";
import { Users, AlertCircle } from "lucide-react";

const gridVariants = { 
  hidden: {}, 
  show: { transition: { staggerChildren: 0.05 } } 
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
function WorkerList({ location, filters, refreshKey = 0 }) {
  // ✅ NEW: Use shifts:changed as a general trigger, or create a new socket event if needed
  const workerTick = useLiveTick("workers:changed"); 

  const { data: workers, loading, error } = useApiQuery(
    "/api/workers/browse",
    {
      lat: location?.lat,
      lng: location?.lng,
      radius: filters?.radius,
      skill: filters?.skill || undefined,
      minPay: filters?.minPay || undefined,
      _r: refreshKey,
    },
    !!location,
    { refreshToken: workerTick } // ✅ Add refreshToken
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <WorkerCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 border border-error/20 p-8 rounded-3xl text-center max-w-xl mx-auto mt-8 flex flex-col items-center shadow-sm">
        <AlertCircle className="w-10 h-10 text-error mb-3" />
        <h3 className="text-lg font-extrabold text-error tracking-tight">Failed to load workers</h3>
        <p className="text-sm font-medium text-error/80 mt-1.5">{error}</p>
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="bg-base-100 rounded-3xl border border-base-200 p-10 sm:p-14 text-center flex flex-col items-center justify-center max-w-2xl mx-auto mt-6 sm:mt-10 shadow-sm">
        <div className="w-16 h-16 bg-base-200/50 rounded-2xl flex items-center justify-center mb-4 border border-base-200">
          <Users className="w-8 h-8 text-base-content/30" />
        </div>
        <h3 className="text-xl font-extrabold text-base-content tracking-tight">No workers found</h3>
        <p className="text-sm font-medium text-base-content/60 mt-2 max-w-sm leading-relaxed">
          No workers match your current filters nearby. Try widening your search radius or clearing some criteria.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 py-2"
      variants={gridVariants}
      initial="hidden"
      animate="show"
    >
      {workers.map((worker) => (
        <motion.div key={worker._id} variants={cardVariants} className="h-full">
          <WorkerCard worker={worker} />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default WorkerList;