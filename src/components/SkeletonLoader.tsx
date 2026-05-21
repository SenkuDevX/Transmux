interface SkeletonLoaderProps {
  type: "metadata" | "history" | "gallery" | "progress" | "fullPage";
}

function PulseBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse ${className || ""}`} />;
}

export default function SkeletonLoader({ type }: SkeletonLoaderProps) {
  if (type === "fullPage") {
    return (
      <div className="space-y-8">
        {/* Hero skeleton */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <PulseBlock className="h-8 w-3/4 mx-auto rounded-lg" />
          <PulseBlock className="h-4 w-2/3 mx-auto" />
        </div>

        {/* Workspace grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selector panel skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <PulseBlock className="h-3 w-28" />
                  <PulseBlock className="h-2 w-36" />
                </div>
                <div className="flex gap-1">
                  <PulseBlock className="h-8 w-24 rounded-lg" />
                  <PulseBlock className="h-8 w-24 rounded-lg" />
                </div>
              </div>
              <PulseBlock className="h-48 w-full rounded-xl" />
            </div>

            {/* Metadata skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <PulseBlock className="w-12 h-12 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <PulseBlock className="h-4 w-2/3" />
                  <PulseBlock className="h-3 w-1/3" />
                </div>
              </div>
              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                <PulseBlock className="h-3 w-full" />
                <PulseBlock className="h-3 w-5/6" />
              </div>
            </div>

            {/* Transcode settings skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <PulseBlock className="h-4 w-24" />
              <div className="grid grid-cols-2 gap-3">
                <PulseBlock className="h-10 rounded-xl" />
                <PulseBlock className="h-10 rounded-xl" />
              </div>
              <PulseBlock className="h-10 w-full rounded-xl" />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Connection status skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <PulseBlock className="h-3 w-20" />
              <PulseBlock className="h-8 w-full rounded-xl" />
              <PulseBlock className="h-8 w-full rounded-xl" />
              <PulseBlock className="h-8 w-3/4 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Gallery skeleton */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <PulseBlock className="h-4 w-32" />
            <PulseBlock className="h-3 w-20" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            <PulseBlock className="h-32 w-48 shrink-0 rounded-xl" />
            <PulseBlock className="h-32 w-48 shrink-0 rounded-xl" />
            <PulseBlock className="h-32 w-48 shrink-0 rounded-xl" />
          </div>
        </div>

        {/* Footer skeleton */}
        <div className="border-t border-slate-200 dark:border-slate-800 py-6 text-center space-y-2">
          <PulseBlock className="h-3 w-96 mx-auto" />
          <PulseBlock className="h-2 w-80 mx-auto" />
        </div>
      </div>
    );
  }

  if (type === "metadata") {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <PulseBlock className="w-12 h-12 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <PulseBlock className="h-4 w-2/3" />
            <PulseBlock className="h-3 w-1/3" />
          </div>
        </div>
        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          <PulseBlock className="h-3 w-full" />
          <PulseBlock className="h-3 w-5/6" />
        </div>
      </div>
    );
  }

  if (type === "progress") {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 animate-pulse">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <PulseBlock className="w-6 h-6 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <PulseBlock className="h-3.5 w-32" />
              <PulseBlock className="h-2 w-18" />
            </div>
          </div>
          <PulseBlock className="h-6 w-16 rounded-lg" />
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <PulseBlock className="h-3 w-1/2" />
            <PulseBlock className="h-3 w-12" />
          </div>
          <PulseBlock className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-4 text-center pt-2">
            <div className="space-y-1">
              <PulseBlock className="h-2 w-2/3 mx-auto" />
              <PulseBlock className="h-3.5 w-1/2 mx-auto" />
            </div>
            <div className="space-y-1">
              <PulseBlock className="h-2 w-2/3 mx-auto" />
              <PulseBlock className="h-3.5 w-1/2 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 animate-pulse">
      <PulseBlock className="h-4 w-1/3 mb-2" />
      <div className="space-y-2">
        <PulseBlock className="h-10 rounded-xl" />
        <PulseBlock className="h-10 rounded-xl" />
        <PulseBlock className="h-10 rounded-xl" />
      </div>
    </div>
  );
}
