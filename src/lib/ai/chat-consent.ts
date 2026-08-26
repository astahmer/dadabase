/**
 * Per-connection schema-sharing consent (chat UX audit S2).
 *
 * Consent is a durable trust decision, not session state: persisting it stops
 * the daily re-gate (which trains users to stop reading the banner), and a
 * matching revoke action keeps the decision revocable.
 */
const consentKey = (connectionName: string): string =>
  `dadabase.chat.consent.${connectionName}`;

export const hasSchemaSharingConsent = (connectionName: string): boolean =>
  typeof window !== "undefined" &&
  window.localStorage.getItem(consentKey(connectionName)) === "granted";

export const grantSchemaSharingConsent = (connectionName: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(consentKey(connectionName), "granted");
};

export const revokeSchemaSharingConsent = (connectionName: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(consentKey(connectionName));
};
