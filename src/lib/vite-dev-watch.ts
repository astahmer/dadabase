/**
 * Paths Vite should not watch in dev.
 * `.references` clones (~hundreds of MB) must stay out of the watch graph —
 * otherwise HMR hard-reloads on unrelated files and Tailwind/CSS rebuilds stall.
 */
export const VITE_SERVER_WATCH_IGNORED = [
  "**/.references/**",
  "**/.git/**",
  "**/.cursor/**",
  "**/agent-transcripts/**",
  "**/e2e/.tmp/**",
  "**/e2e/test-results/**",
  "**/e2e/playwright-report/**",
  "**/e2e/.features-gen/**",
  "**/*.md",
  "**/*.local",
  "**/.DS_Store",
] as const;
