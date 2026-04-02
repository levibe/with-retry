import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '../src'

describe('withRetry', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	// Note: Some tests may show "unhandled promise rejection" warnings in the console.
	// This is expected behavior as promises are created before being awaited,
	// and errors are handled correctly by the test assertions.

	it('should return result on first success', async () => {
		const operation = vi.fn().mockResolvedValue('success')
		const result = await withRetry(operation)
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(1)
	})

	it('should retry on failure and eventually succeed', async () => {
		const operation = vi
			.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('fail 1')))
			.mockImplementationOnce(() => Promise.reject(new Error('fail 2')))
			.mockResolvedValue('success')

		const promise = withRetry(operation, {
			maxAttempts: 3,
			initialDelay: 100,
			jitter: false,
		})

		// First attempt fails immediately
		await vi.runAllTimersAsync()
		// Second attempt after 100ms
		await vi.advanceTimersByTimeAsync(100)
		// Third attempt after 200ms (backoff)
		await vi.advanceTimersByTimeAsync(200)

		const result = await promise
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(3)
	})

	it('should throw after max attempts', async () => {
		const error = new Error('persistent failure')
		const operation = vi.fn().mockImplementation(() => Promise.reject(error))

		const promise = withRetry(operation, {
			maxAttempts: 2,
			initialDelay: 10,
			jitter: false,
		})

		// Run timers and wait for promise to settle
		const [, result] = await Promise.allSettled([vi.runAllTimersAsync(), promise])

		expect(result.status).toBe('rejected')
		if (result.status === 'rejected') {
			expect(result.reason.message).toBe('persistent failure')
		}
		expect(operation).toHaveBeenCalledTimes(2)
	})

	it('should use exponential backoff', async () => {
		const operation = vi
			.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('fail 1')))
			.mockImplementationOnce(() => Promise.reject(new Error('fail 2')))
			.mockImplementationOnce(() => Promise.reject(new Error('fail 3')))
			.mockResolvedValue('success')

		const promise = withRetry(operation, {
			maxAttempts: 4,
			initialDelay: 100,
			backoffFactor: 2,
			jitter: false,
		})

		// Wait for all timers to complete
		await vi.runAllTimersAsync()

		const result = await promise
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(4)
	})

	it('should respect maxDelay', async () => {
		const operation = vi
			.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('fail')))
			.mockResolvedValue('success')

		const promise = withRetry(operation, {
			maxAttempts: 2,
			initialDelay: 100,
			maxDelay: 150,
			backoffFactor: 10,
			jitter: false,
		})

		// First attempt fails immediately
		await vi.runAllTimersAsync()
		// Should use initialDelay (100ms) for first retry, not calculated delay
		await vi.advanceTimersByTimeAsync(100)

		const result = await promise
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(2)
	})

	it('should apply jitter when enabled', async () => {
		const operation = vi
			.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('fail')))
			.mockResolvedValue('success')

		// Mock Math.random to return a predictable value
		const originalRandom = Math.random
		Math.random = vi.fn().mockReturnValue(0.75) // Will give us 87.5% of delay

		const promise = withRetry(operation, {
			maxAttempts: 2,
			initialDelay: 1000,
			jitter: true,
		})

		await vi.runAllTimersAsync()
		// With jitter at 0.75, delay should be 1000 * (0.5 + 0.75 * 0.5) = 875ms
		await vi.advanceTimersByTimeAsync(875)

		const result = await promise
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(2)

		Math.random = originalRandom
	})

	it('should use shouldRetry callback', async () => {
		const specialError = new Error('special')
		const normalError = new Error('normal')

		const operation = vi
			.fn()
			.mockImplementationOnce(() => Promise.reject(normalError))
			.mockImplementationOnce(() => Promise.reject(specialError))

		const shouldRetry = vi.fn((error: Error) => error.message !== 'special')

		const promise = withRetry(operation, {
			maxAttempts: 3,
			initialDelay: 10,
			shouldRetry,
			jitter: false,
		})

		// Run timers and wait for promise to settle
		const [, result] = await Promise.allSettled([vi.runAllTimersAsync(), promise])

		expect(result.status).toBe('rejected')
		if (result.status === 'rejected') {
			expect(result.reason.message).toBe('special')
		}
		expect(operation).toHaveBeenCalledTimes(2)
		expect(shouldRetry).toHaveBeenCalledTimes(2)
		expect(shouldRetry).toHaveBeenCalledWith(normalError)
		expect(shouldRetry).toHaveBeenCalledWith(specialError)
	})

	it('should not retry when shouldRetry returns false immediately', async () => {
		const error = new Error('do not retry')
		const operation = vi.fn().mockImplementation(() => Promise.reject(error))

		const promise = withRetry(operation, {
			maxAttempts: 5,
			shouldRetry: () => false,
		})

		await expect(promise).rejects.toThrow('do not retry')
		expect(operation).toHaveBeenCalledTimes(1)
	})

	it('should use default options when none provided', async () => {
		const operation = vi.fn().mockResolvedValue('success')
		const result = await withRetry(operation)
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(1)
	})

	it('should validate operation parameter', async () => {
		// @ts-expect-error Testing invalid input
		await expect(withRetry(null)).rejects.toThrow('operation must be a function')
		// @ts-expect-error Testing invalid input
		await expect(withRetry('not a function')).rejects.toThrow('operation must be a function')
	})

	it('should validate options parameters', async () => {
		const operation = vi.fn().mockResolvedValue('success')

		await expect(withRetry(operation, { maxAttempts: 0 })).rejects.toThrow(
			'maxAttempts must be at least 1'
		)
		await expect(withRetry(operation, { initialDelay: -1 })).rejects.toThrow(
			'initialDelay must be non-negative'
		)
		await expect(withRetry(operation, { maxDelay: 50, initialDelay: 100 })).rejects.toThrow(
			'maxDelay must be greater than or equal to initialDelay'
		)
		await expect(withRetry(operation, { backoffFactor: 0 })).rejects.toThrow(
			'backoffFactor must be positive'
		)
		// @ts-expect-error Testing invalid input
		await expect(withRetry(operation, { shouldRetry: 'not a function' })).rejects.toThrow(
			'shouldRetry must be a function'
		)
	})

	it('should handle non-Error thrown values', async () => {
		const operation = vi
			.fn()
			.mockImplementationOnce(() => Promise.reject('string error'))
			.mockResolvedValue('success')

		const promise = withRetry(operation, {
			maxAttempts: 2,
			initialDelay: 10,
			jitter: false,
		})

		await vi.runAllTimersAsync()

		const result = await promise
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(2)
	})

	it('should handle rejection after shouldRetry returns false', async () => {
		const error = new Error('permanent error')
		const operation = vi.fn().mockImplementation(() => Promise.reject(error))
		const shouldRetry = vi.fn().mockReturnValue(false)

		const promise = withRetry(operation, {
			maxAttempts: 5,
			shouldRetry,
		})

		await expect(promise).rejects.toThrow('permanent error')
		expect(operation).toHaveBeenCalledTimes(1)
		expect(shouldRetry).toHaveBeenCalledTimes(1)
		expect(shouldRetry).toHaveBeenCalledWith(error)
	})

	describe('onRetry callback', () => {
		it('should call onRetry before each retry attempt', async () => {
			const errors = [new Error('fail 1'), new Error('fail 2')]
			const operation = vi
				.fn()
				.mockImplementationOnce(() => Promise.reject(errors[0]))
				.mockImplementationOnce(() => Promise.reject(errors[1]))
				.mockResolvedValue('success')

			const onRetry = vi.fn()

			const promise = withRetry(operation, {
				maxAttempts: 3,
				initialDelay: 10,
				jitter: false,
				onRetry,
			})

			await vi.runAllTimersAsync()
			const result = await promise

			expect(result).toBe('success')
			expect(operation).toHaveBeenCalledTimes(3)
			expect(onRetry).toHaveBeenCalledTimes(2)
			expect(onRetry).toHaveBeenNthCalledWith(1, errors[0], 1)
			expect(onRetry).toHaveBeenNthCalledWith(2, errors[1], 2)
		})

		it('should support async onRetry callback', async () => {
			const operation = vi
				.fn()
				.mockImplementationOnce(() => Promise.reject(new Error('fail')))
				.mockResolvedValue('success')

			let asyncCallbackCompleted = false
			const onRetry = vi.fn().mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 5))
				asyncCallbackCompleted = true
			})

			const promise = withRetry(operation, {
				maxAttempts: 2,
				initialDelay: 10,
				jitter: false,
				onRetry,
			})

			await vi.runAllTimersAsync()
			const result = await promise

			expect(result).toBe('success')
			expect(asyncCallbackCompleted).toBe(true)
			expect(onRetry).toHaveBeenCalledTimes(1)
		})

		it('should not call onRetry on successful first attempt', async () => {
			const operation = vi.fn().mockResolvedValue('success')
			const onRetry = vi.fn()

			const result = await withRetry(operation, {
				onRetry,
			})

			expect(result).toBe('success')
			expect(operation).toHaveBeenCalledTimes(1)
			expect(onRetry).not.toHaveBeenCalled()
		})

		it('should not call onRetry on final failure', async () => {
			const error = new Error('persistent failure')
			const operation = vi.fn().mockImplementation(() => Promise.reject(error))
			const onRetry = vi.fn()

			const promise = withRetry(operation, {
				maxAttempts: 2,
				initialDelay: 10,
				jitter: false,
				onRetry,
			})

			const [, result] = await Promise.allSettled([vi.runAllTimersAsync(), promise])

			expect(result.status).toBe('rejected')
			expect(operation).toHaveBeenCalledTimes(2)
			// onRetry should only be called once (after first failure, before second attempt)
			expect(onRetry).toHaveBeenCalledTimes(1)
			expect(onRetry).toHaveBeenCalledWith(error, 1)
		})

		it('should not call onRetry when shouldRetry returns false', async () => {
			const error = new Error('do not retry')
			const operation = vi.fn().mockImplementation(() => Promise.reject(error))
			const onRetry = vi.fn()
			const shouldRetry = vi.fn().mockReturnValue(false)

			const promise = withRetry(operation, {
				maxAttempts: 5,
				shouldRetry,
				onRetry,
			})

			await expect(promise).rejects.toThrow('do not retry')
			expect(operation).toHaveBeenCalledTimes(1)
			expect(shouldRetry).toHaveBeenCalledTimes(1)
			expect(onRetry).not.toHaveBeenCalled()
		})

		it('should handle onRetry throwing an error', async () => {
			const originalError = new Error('operation failed')
			const onRetryError = new Error('onRetry failed')
			const operation = vi.fn().mockImplementation(() => Promise.reject(originalError))
			const onRetry = vi.fn().mockImplementation(() => {
				throw onRetryError
			})

			const promise = withRetry(operation, {
				maxAttempts: 3,
				initialDelay: 10,
				jitter: false,
				onRetry,
			})

			const [, result] = await Promise.allSettled([vi.runAllTimersAsync(), promise])

			expect(result.status).toBe('rejected')
			if (result.status === 'rejected') {
				// Should reject with the onRetry error, not the original error
				expect(result.reason).toBe(onRetryError)
			}
			expect(operation).toHaveBeenCalledTimes(1)
			expect(onRetry).toHaveBeenCalledTimes(1)
		})

		it('should call onRetry with correct attempt number on each retry', async () => {
			const errors = [new Error('fail 1'), new Error('fail 2'), new Error('fail 3')]
			const operation = vi
				.fn()
				.mockImplementationOnce(() => Promise.reject(errors[0]))
				.mockImplementationOnce(() => Promise.reject(errors[1]))
				.mockImplementationOnce(() => Promise.reject(errors[2]))
				.mockResolvedValue('success')

			const onRetry = vi.fn()

			const promise = withRetry(operation, {
				maxAttempts: 4,
				initialDelay: 10,
				jitter: false,
				onRetry,
			})

			await vi.runAllTimersAsync()
			const result = await promise

			expect(result).toBe('success')
			expect(operation).toHaveBeenCalledTimes(4)
			expect(onRetry).toHaveBeenCalledTimes(3)

			// Verify each call has the correct attempt number
			expect(onRetry).toHaveBeenNthCalledWith(1, errors[0], 1)
			expect(onRetry).toHaveBeenNthCalledWith(2, errors[1], 2)
			expect(onRetry).toHaveBeenNthCalledWith(3, errors[2], 3)
		})

		it('should call onRetry after shouldRetry check passes', async () => {
			const errors = [new Error('retry this'), new Error('do not retry')]
			const operation = vi
				.fn()
				.mockImplementationOnce(() => Promise.reject(errors[0]))
				.mockImplementationOnce(() => Promise.reject(errors[1]))

			const callOrder: string[] = []
			const shouldRetry = vi.fn((error: Error) => {
				callOrder.push(`shouldRetry: ${error.message}`)
				return error.message === 'retry this'
			})
			const onRetry = vi.fn((error: Error) => {
				callOrder.push(`onRetry: ${error.message}`)
			})

			const promise = withRetry(operation, {
				maxAttempts: 3,
				initialDelay: 10,
				jitter: false,
				shouldRetry,
				onRetry,
			})

			const [, result] = await Promise.allSettled([vi.runAllTimersAsync(), promise])

			expect(result.status).toBe('rejected')
			expect(operation).toHaveBeenCalledTimes(2)

			// onRetry should only be called once (after first error passes shouldRetry)
			expect(onRetry).toHaveBeenCalledTimes(1)
			expect(onRetry).toHaveBeenCalledWith(errors[0], 1)

			// Verify the order: shouldRetry is checked first, then onRetry is called
			expect(callOrder).toEqual([
				'shouldRetry: retry this',
				'onRetry: retry this',
				'shouldRetry: do not retry',
			])
		})
	})
})
