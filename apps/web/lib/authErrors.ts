/**
 * Maps errors from the auth endpoints to translation keys.
 *
 * The backend returns English `detail` strings (apps/api/routers/auth.py); they are matched
 * exactly here so the message can be shown in the user's language. If the backend wording
 * changes, the match fails and the raw message is shown instead (still readable, just English).
 */
type T = (key: string) => string;

const KNOWN: Record<string, string> = {
  "Invalid email or password": "error.invalidCredentials",
  "Account is disabled": "error.accountDisabled",
  "Email already registered": "error.emailTaken",
  "Invalid or missing officer signup code.": "error.invalidCode",
};

export function authErrorMessage(err: unknown, t: T): string {
  if (err instanceof TypeError) return t("error.network"); // fetch() rejects with TypeError when offline / server down
  const msg = err instanceof Error ? err.message : "";
  if (KNOWN[msg]) return t(KNOWN[msg]);
  // api-client throws `body.detail`; a 422 validation error has an array detail -> "[object Object]"
  if (!msg || msg.includes("[object Object]") || msg.startsWith("Request failed with status")) return t("error.generic");
  return msg;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
