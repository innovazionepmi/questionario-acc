import type { Session } from "../types";

/** URL di prenotazione HubSpot Meetings con prefill dei dati già noti dal form iniziale. */
export function buildBookingUrl(session: Pick<Session, "first_name" | "last_name" | "email" | "company">): string {
  const base = process.env.HUBSPOT_MEETINGS_URL;
  if (!base) return "#";

  const params = new URLSearchParams();
  if (session.first_name) params.set("firstName", session.first_name);
  if (session.last_name) params.set("lastName", session.last_name);
  if (session.email) params.set("email", session.email);
  if (session.company) params.set("company", session.company);

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
