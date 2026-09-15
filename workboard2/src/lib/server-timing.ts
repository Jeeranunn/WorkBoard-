import "server-only";

// Lightweight phase timing for diagnosing perceived latency in production,
// where "why is this slow" needs to be split into auth/session vs. query
// time vs. render time — none of which local EXPLAIN ANALYZE can show,
// since local Postgres has no Supabase Auth network hop and no Vercel<->
// Supabase region latency to measure. Logs to stdout, which Vercel
// captures as function logs — no APM/tracing dependency needed to read it.
//
// Deliberately not a Server-Timing response header: a page.tsx Server
// Component has no supported way to set response headers on the RSC
// stream, so this is stdout-based instead.
// PromiseLike, not Promise: Supabase's query builders are thenables, not
// real Promise instances, so a `() => Promise<T>` parameter type fails to
// unify T against them and infers `unknown` instead.
export async function timed<T>(label: string, fn: () => PromiseLike<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = performance.now() - start;
    console.log(`[timing] ${label}: ${ms.toFixed(1)}ms`);
  }
}
