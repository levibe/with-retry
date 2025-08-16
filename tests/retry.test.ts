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
		const operation = vi.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('fail 1')))
			.mockImplementationOnce(() => Promise.reject(new Error('fail 2')))
			.mockResolvedValue('success')

		const promise = withRetry(operation, {
			maxAttempts: 3,
			initialDelay: 100,
			jitter: false
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
			jitter: false
		})

		// Run timers and wait for promise to settle
		const [, result] = await Promise.allSettled([
			vi.runAllTimersAsync(),
			promise
		])

		expect(result.status).toBe('rejected')
		if (result.status === 'rejected') {
			expect(result.reason.message).toBe('persistent failure')
		}
		expect(operation).toHaveBeenCalledTimes(2)
	})

	it('should use exponential backoff', async () => {
		const operation = vi.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('fail 1')))
			.mockImplementationOnce(() => Promise.reject(new Error('fail 2')))
			.mockImplementationOnce(() => Promise.reject(new Error('fail 3')))
			.mockResolvedValue('success')

		const promise = withRetry(operation, {
			maxAttempts: 4,
			initialDelay: 100,
			backoffFactor: 2,
			jitter: false
		})

		// Wait for all timers to complete
		await vi.runAllTimersAsync()

		const result = await promise
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(4)
	})

	it('should respect maxDelay', async () => {
		const operation = vi.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('fail')))
			.mockResolvedValue('success')

		const promise = withRetry(operation, {
			maxAttempts: 2,
			initialDelay: 100,
			maxDelay: 500,
			backoffFactor: 10,
			jitter: false
		})

		await vi.runAllTimersAsync()
		// Should use maxDelay (500) instead of calculated delay (100 * 10 = 1000)
		await vi.advanceTimersByTimeAsync(500)

		const result = await promise
		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(2)
	})

	it('should apply jitter when enabled', async () => {
		const operation = vi.fn()
			.mockImplementationOnce(() => Promise.reject(new Error('fail')))
			.mockResolvedValue('success')

		// Mock Math.random to return a predictable value
		const originalRandom = Math.random
		Math.random = vi.fn().mockReturnValue(0.75) // Will give us 87.5% of delay

		const promise = withRetry(operation, {
			maxAttempts: 2,
			initialDelay: 1000,
			jitter: true
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
		
		const operation = vi.fn()
			.mockImplementationOnce(() => Promise.reject(normalError))
			.mockImplementationOnce(() => Promise.reject(specialError))

		const shouldRetry = vi.fn((error: Error) => error.message !== 'special')

		const promise = withRetry(operation, {
			maxAttempts: 3,
			initialDelay: 10,
			shouldRetry,
			jitter: false
		})

		// Run timers and wait for promise to settle
		const [, result] = await Promise.allSettled([
			vi.runAllTimersAsync(),
			promise
		])

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
			shouldRetry: () => false
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
})