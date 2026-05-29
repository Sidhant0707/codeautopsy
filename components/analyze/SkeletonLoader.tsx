import { memo } from "react";

/**
 * Generic pulsing skeleton shown while a lazy-loaded tab component is
 * being fetched or while the page is in its initial loading state.
 */
const SkeletonLoader = memo(() => (
  <div className="w-full h-full space-y-4 p-6 animate-pulse">
    <div className="h-8 bg-white/5 rounded-lg w-1/3" />
    <div className="h-64 bg-white/5 rounded-xl" />
    <div className="grid grid-cols-2 gap-4">
      <div className="h-32 bg-white/5 rounded-lg" />
      <div className="h-32 bg-white/5 rounded-lg" />
    </div>
  </div>
));

SkeletonLoader.displayName = "SkeletonLoader";

export default SkeletonLoader;
