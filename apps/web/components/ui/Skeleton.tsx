/** Loading placeholder. Pulse is disabled automatically under prefers-reduced-motion (see globals.css). */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-control bg-line/60 ${className}`} />;
}
