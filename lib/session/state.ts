export const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 ore dal primo accesso

export function computeExpiresAt(startedAt: string): Date {
  return new Date(new Date(startedAt).getTime() + SESSION_TTL_MS);
}

export function isExpired(startedAt: string, now: Date = new Date()): boolean {
  return now.getTime() > computeExpiresAt(startedAt).getTime();
}
