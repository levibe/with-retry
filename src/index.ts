/**
 * Configuration options for the retry mechanism
 */
export interface RetryOptions {
	/** Maximum number of retry attempts (default: 10) */
	maxAttempts?: number
	/** Initial delay in milliseconds before first retry (default: 1000) */
	initialDelay?: number
	/** Maximum delay cap in milliseconds (default: 30000) */
	maxDelay?: number
	/** Exponential backoff multiplier (default: 2) */
	backoffFactor?: number
	/** Add randomness to delays to prevent thundering herd (default: true) */
	jitter?: boolean
	/** Custom function to determine if an error should trigger a retry (default: always retry) */
	shouldRetry?: (error: Error) => boolean
	/** Callback executed before each retry attempt */
	onRetry?: (error: Error, attempt: number) => void | Promise<void>
	/** Stops retrying when aborted; a wait between attempts rejects at once with `signal.reason` */
	signal?: AbortSignal
}

/** Resolve after `ms`, or reject with the signal's reason as soon as it aborts */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		// An abort before the wait already fired its event, so no listener would hear it
		if (signal?.aborted) {
			reject(signal.reason)
			return
		}
		const onAbort = () => {
			clearTimeout(timer)
			reject(signal!.reason)
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

/**
 * Executes an async operation with retry logic using exponential backoff and jitter
 *
 * @template T The return type of the operation
 * @param operation The async function to retry
 * @param options Configuration options for retry behavior
 * @returns Promise that resolves to the operation result or rejects with the last error
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const result = await withRetry(async () => {
 *   const response = await fetch('https://api.example.com/data')
 *   if (!response.ok) throw new Error('Request failed')
 *   return response.json()
 * })
 *
 * // With custom options
 * const result = await withRetry(async () => {
 *   return await someAsyncOperation()
 * }, {
 *   maxAttempts: 5,
 *   initialDelay: 500,
 *   shouldRetry: (error) => error.message !== 'FATAL'
 * })
 *
 * // Stop retrying when the caller gives up
 * const controller = new AbortController()
 * const result = await withRetry(() => apiCall(controller.signal), {
 *   signal: controller.signal
 * })
 *
 * // With onRetry callback for logging
 * const result = await withRetry(async () => {
 *   return await apiCall()
 * }, {
 *   maxAttempts: 3,
 *   onRetry: (error, attempt) => {
 *     console.warn(`Retry attempt ${attempt} due to: ${error.message}`)
 *   }
 * })
 * ```
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	options: RetryOptions = {}
): Promise<T> {
	// Validate operation parameter
	if (typeof operation !== 'function') {
		throw new TypeError('operation must be a function')
	}

	const {
		maxAttempts = 10,
		initialDelay = 1000,
		maxDelay = 30000,
		backoffFactor = 2,
		jitter = true,
		shouldRetry = () => true,
		onRetry,
		signal,
	} = options

	// Validate numeric options
	if (maxAttempts < 1) {
		throw new RangeError('maxAttempts must be at least 1')
	}
	if (initialDelay < 0) {
		throw new RangeError('initialDelay must be non-negative')
	}
	if (maxDelay < initialDelay) {
		throw new RangeError('maxDelay must be greater than or equal to initialDelay')
	}
	if (backoffFactor <= 0) {
		throw new RangeError('backoffFactor must be positive')
	}
	if (typeof shouldRetry !== 'function') {
		throw new TypeError('shouldRetry must be a function')
	}

	let lastError: Error | undefined
	let delay = initialDelay

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		signal?.throwIfAborted()

		try {
			const result = await operation()
			return result
		} catch (error) {
			// Ensure we always have an Error instance
			lastError = error instanceof Error ? error : new Error(String(error))

			if (attempt === maxAttempts) {
				break
			}

			// An attempt that failed after an abort keeps its own error, which usually says so
			if (signal?.aborted || !shouldRetry(lastError)) {
				break
			}

			// Call onRetry callback before retrying
			if (onRetry) {
				await onRetry(lastError, attempt)
			}

			// Add jitter to prevent thundering herd problem
			const actualDelay = jitter
				? delay * (0.5 + Math.random() * 0.5) // Random between 50-100% of delay
				: delay

			await wait(actualDelay, signal)

			// Calculate next delay after the current retry
			delay = Math.min(delay * backoffFactor, maxDelay)
		}
	}

	throw lastError
}
