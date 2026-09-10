import { ProviderError } from "./errors.ts";
import type { Provider } from "./errors.ts";

/** A single attempt. Durable retry policy belongs to the outbox, not an HTTP adapter. */
export async function providerJson(
  provider: Provider,
  url: string,
  token: string,
  body: unknown,
  fetcher: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) {
      // Do not include provider error messages: they may echo PII or credentials.
      let details: Record<string, any> | null = null;
      if (provider === "meta") {
        try {
          details = record(record(await response.json())?.error);
        } catch {
          /* A gateway may return HTML. */
        }
      }
      const uncertain =
        provider === "meta" &&
        (response.status === 408 ||
          (response.status >= 500 && typeof details?.code !== "number"));
      const retryable =
        !uncertain &&
        (response.status === 429 ||
          response.status >= 500 ||
          (provider === "meta" && details?.is_transient === true));
      throw new ProviderError(
        provider,
        `http_${response.status}`,
        retryable,
        uncertain,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new ProviderError(
        provider,
        "invalid_response",
        false,
        provider === "meta",
      );
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    // A failed transport does not prove the remote server did not accept a send.
    throw new ProviderError(
      provider,
      controller.signal.aborted ? "timeout" : "transport",
      provider !== "meta",
      provider === "meta",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function record(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
