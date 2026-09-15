// Automatic Suspense fallback for every route under (app) — Next.js shows
// this the instant a navigation starts, before the destination page's data
// finishes fetching, so navigation always gives immediate feedback instead
// of an unresponsive-looking blank screen while the server renders.
export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-100" />
      </div>
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-5/6 rounded bg-slate-100" />
        <div className="h-4 w-2/3 rounded bg-slate-100" />
      </div>
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  );
}
