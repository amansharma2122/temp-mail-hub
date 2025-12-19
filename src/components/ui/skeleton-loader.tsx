import { cn } from "@/lib/utils";

interface SkeletonLoaderProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const SkeletonLoader = ({
  className,
  variant = "rectangular",
  width,
  height,
  lines = 1,
}: SkeletonLoaderProps) => {
  const baseClasses = "animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer";

  if (variant === "text" && lines > 1) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              "h-4 rounded",
              i === lines - 1 && "w-3/4"
            )}
            style={{ width: i === lines - 1 ? "75%" : width }}
          />
        ))}
      </div>
    );
  }

  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
    card: "rounded-xl",
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{
        width: width || (variant === "circular" ? 40 : "100%"),
        height: height || (variant === "circular" ? 40 : variant === "card" ? 200 : 20),
      }}
    />
  );
};

// Email list skeleton
export const EmailListSkeleton = () => (
  <div className="space-y-3 p-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-secondary/30 animate-pulse">
        <SkeletonLoader variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <SkeletonLoader variant="text" className="w-1/3" />
            <SkeletonLoader variant="text" className="w-16" />
          </div>
          <SkeletonLoader variant="text" className="w-2/3" />
          <SkeletonLoader variant="text" className="w-full" height={12} />
        </div>
      </div>
    ))}
  </div>
);

// Inbox skeleton
export const InboxSkeleton = () => (
  <div className="glass-card overflow-hidden">
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div className="flex items-center gap-3">
        <SkeletonLoader variant="circular" width={24} height={24} />
        <SkeletonLoader variant="text" className="w-20" />
        <SkeletonLoader variant="rectangular" className="w-12 h-5 rounded-full" />
      </div>
      <div className="flex gap-2">
        <SkeletonLoader variant="rectangular" className="w-24 h-8" />
        <SkeletonLoader variant="rectangular" className="w-24 h-8" />
      </div>
    </div>
    <EmailListSkeleton />
  </div>
);

export default SkeletonLoader;
