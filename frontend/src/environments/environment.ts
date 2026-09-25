/**
 * Default build: the demo API runs entirely in the browser (static hosting, e.g. GitHub Pages).
 * Use the `server` configuration to talk to the ASP.NET Core API instead.
 */
export const environment = {
  api: 'browser' as 'browser' | 'server',
  /** Simulated controller/feed latency for in-browser mutations. */
  simulatedLatencyMs: 900,
};
