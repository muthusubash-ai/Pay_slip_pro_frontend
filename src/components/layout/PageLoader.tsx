// Lightweight, dependency-free fallback shown while a lazy route chunk loads.
// Uses a pure-CSS spinner (Tailwind `animate-spin`) on purpose: the Suspense
// fallback renders before any page chunk is fetched, so it must not pull in
// heavy deps like framer-motion.
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-12 w-12 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
    </div>
  );
}
