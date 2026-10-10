/** Preserve server error details that auth-js otherwise drops for HTTP 5xx.
 * Keep the original response/status so the SDK's retry behavior stays intact.
 * Never log request bodies, credentials, or full responses.
 */
export function createAuthFetch(
  baseUrl: string,
  fetcher: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  const authPath = new URL(baseUrl).pathname.replace(/\/$/, "") + "/auth/v1/";
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const response = await fetcher(input, init);
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (
      url.origin === origin &&
      url.pathname.startsWith(authPath) &&
      response.status >= 500
    ) {
      let message = `The authentication server returned HTTP ${response.status}. Please try again later and check Supabase Auth logs.`;
      try {
        const body: unknown = await response.clone().json();
        if (body && typeof body === "object") {
          const data = body as Record<string, unknown>;
          const detail = [
            data.message,
            data.msg,
            data.error_description,
            data.error,
          ].find((value) => typeof value === "string" && value.trim());
          if (typeof detail === "string") message = detail;
        }
      } catch {
        /* A proxy can return an empty or non-JSON error body. */
      }
      Object.defineProperty(response, "message", { value: message });
    }
    return response;
  };
}
