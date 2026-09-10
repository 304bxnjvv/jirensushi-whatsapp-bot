export type Provider = "meta" | "openai";

/** Safe operational metadata only: never attach tokens, request bodies or raw upstream errors. */
export class ProviderError extends Error {
  readonly provider: Provider;
  readonly code: string;
  readonly retryable: boolean;
  readonly uncertain: boolean;

  constructor(
    provider: Provider,
    code: string,
    retryable = false,
    uncertain = false,
  ) {
    super(`${provider}: ${code}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
    this.uncertain = uncertain;
  }
}
