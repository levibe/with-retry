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
		shouldRetry = () => true
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
		try {
			const result = await operation()
			return result
		} catch (error) {
			// Ensure we always have an Error instance
			lastError = error instanceof Error ? error : new Error(String(error))
			
			if (attempt === maxAttempts) {
				break
			}

			// Check if we should retry this error
			if (!shouldRetry(lastError)) {
				break
			}

			// Add jitter to prevent thundering herd problem
			const actualDelay = jitter 
				? delay * (0.5 + Math.random() * 0.5) // Random between 50-100% of delay
				: delay
			
			await new Promise(resolve => setTimeout(resolve, actualDelay))
			
			// Calculate next delay after the current retry
			delay = Math.min(delay * backoffFactor, maxDelay)
		}
	}

	throw lastError
}
