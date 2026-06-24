// URL of the public client app (the Telegram Mini App) that renders a service's form.
// The admin panel is a SEPARATE deploy/origin (dist-admin in prod, :5174 in dev), so links
// to the client form must be ABSOLUTE — a relative `/?service=…` resolves to the admin origin
// and just re-opens the admin app. Override per environment with VITE_CLIENT_URL
// (e.g. http://localhost:5173 in dev); defaults to the production client so the link works
// out of the box without extra config.
const CLIENT_URL =
  (import.meta.env.VITE_CLIENT_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://legal-twa-xi.vercel.app'

/** Absolute URL that opens the client-facing form for a service slug. */
export function clientFormUrl(slug: string): string {
  return `${CLIENT_URL}/?service=${encodeURIComponent(slug)}`
}
