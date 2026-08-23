/**
 * Redacts secrets from a connection URL for display/logging.
 * - URL userinfo password → `*****`
 * - Known credential query parameters → `*****`
 * - Embedded `dadabase_ssh` JSON blob: password field → `*****` (keeps host/user for debug)
 */
export function redactConnectionUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.password) {
      urlObj.password = "*****";
    }

    for (const key of ["authToken", "token", "password", "secret"]) {
      if (urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, "*****");
      }
    }

    const sshParam = urlObj.searchParams.get("dadabase_ssh");
    if (sshParam) {
      try {
        const json =
          typeof Buffer !== "undefined"
            ? Buffer.from(sshParam, "base64url").toString("utf8")
            : atob(sshParam.replaceAll("-", "+").replaceAll("_", "/"));
        const parsed: unknown = JSON.parse(json);
        if (parsed && typeof parsed === "object" && "password" in parsed) {
          const next = { ...(parsed as Record<string, unknown>), password: "*****" };
          const encoded =
            typeof Buffer !== "undefined"
              ? Buffer.from(JSON.stringify(next), "utf8").toString("base64url")
              : btoa(JSON.stringify(next))
                  .replaceAll("+", "-")
                  .replaceAll("/", "_")
                  .replaceAll("=", "");
          urlObj.searchParams.set("dadabase_ssh", encoded);
        }
      } catch {
        // Malformed SSH blob — drop it rather than leak raw bytes in logs.
        urlObj.searchParams.set("dadabase_ssh", "*****");
      }
    }

    return urlObj.toString();
  } catch {
    return url;
  }
}
