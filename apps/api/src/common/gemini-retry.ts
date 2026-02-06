/**
 * Gemini API utility with retry logic and error handling.
 * Implements exponential backoff for transient failures.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Retryable error types from Gemini API
 */
const RETRYABLE_ERROR_PATTERNS = [
  /rate limit/i,
  /quota exceeded/i,
  /503/i,
  /429/i,
  /temporarily unavailable/i,
  /overloaded/i,
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /socket hang up/i,
  /network error/i,
];

/**
 * Non-retryable error types (permanent failures)
 */
const NON_RETRYABLE_ERROR_PATTERNS = [
  /invalid api key/i,
  /authentication/i,
  /unauthorized/i,
  /forbidden/i,
  /not found/i,
  /invalid request/i,
  /400/i,
  /401/i,
  /403/i,
  /404/i,
];

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  const message = error.message || '';

  // Check for non-retryable patterns first
  if (NON_RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return false;
  }

  // Check for retryable patterns
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with jitter for exponential backoff
 */
function calculateDelay(
  attempt: number,
  options: Required<RetryOptions>,
): number {
  const exponentialDelay =
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);

  // Add jitter (±20%)
  const jitter = 0.8 + Math.random() * 0.4;
  const delayWithJitter = exponentialDelay * jitter;

  return Math.min(delayWithJitter, options.maxDelayMs);
}

/**
 * Execute a Gemini API call with retry logic and exponential backoff.
 *
 * @param operation - Async function that performs the Gemini API call
 * @param operationName - Human-readable name for logging
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {},
): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      const isRetryable = isRetryableError(lastError);
      const hasAttemptsLeft = attempt < opts.maxRetries;

      if (!isRetryable) {
        console.error(
          `[Gemini] ${operationName} failed with non-retryable error:`,
          lastError.message,
        );
        throw lastError;
      }

      if (!hasAttemptsLeft) {
        console.error(
          `[Gemini] ${operationName} failed after ${opts.maxRetries + 1} attempts:`,
          lastError.message,
        );
        throw lastError;
      }

      const delay = calculateDelay(attempt, opts);
      console.warn(
        `[Gemini] ${operationName} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms:`,
        lastError.message,
      );

      await sleep(delay);
    }
  }

  // This shouldn't be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error during Gemini operation');
}

/**
 * Parse Gemini response safely with retry-compatible error handling
 */
export function parseGeminiResponse<T>(
  responseText: string,
  parser: (text: string) => T,
  operationName: string,
): T {
  try {
    // Clean up markdown code blocks if present
    let cleanedText = responseText
      .replace(/```json\s*\n?/gi, '')
      .replace(/```\s*$/g, '')
      .trim();

    return parser(cleanedText);
  } catch (error) {
    // Parsing errors are not retryable - they indicate bad AI output
    console.error(`[Gemini] Failed to parse ${operationName} response:`, error);
    throw new Error(
      `Failed to parse ${operationName} response: ${(error as Error).message}`,
    );
  }
}
