# @levibe/with-retry

[![license](https://img.shields.io/github/license/levibe/with-retry)](https://github.com/levibe/with-retry/blob/main/LICENSE)

A TypeScript retry utility with exponential backoff and jitter, designed for robust error handling in asynchronous operations.

## Why Another Retry Library?

When I went to replace this retry utility with [p-retry](https://github.com/sindresorhus/p-retry), I realized I preferred this implementation's API design. The naming reads more naturally to me: `withRetry` instead of `pRetry`, `maxAttempts` instead of `retries`, `shouldRetry` instead of buried retry logic.

I'm making this available for anyone who might share that preference.

_p-retry is more battle-tested and likely the better choice for most use cases._

## Installation

This package is hosted on [GitHub Packages](https://github.com/levibe/with-retry/packages). Add the following to your project's `.npmrc`:

```
@levibe:registry=https://npm.pkg.github.com
```

Then install:

```bash
pnpm add @levibe/with-retry
```

## Usage

### Basic Usage

```typescript
import { withRetry } from '@levibe/with-retry'

// Simple retry with defaults
const result = await withRetry(async () => {
	const response = await fetch('https://api.example.com/data')
	if (!response.ok) throw new Error('Request failed')
	return response.json()
})
```

### Advanced Configuration

```typescript
import { withRetry, RetryOptions } from '@levibe/with-retry'

const options: RetryOptions = {
	maxAttempts: 5, // Maximum number of attempts (default: 10)
	initialDelay: 1000, // Initial delay in ms (default: 1000)
	maxDelay: 30000, // Maximum delay in ms (default: 30000)
	backoffFactor: 2, // Exponential backoff multiplier (default: 2)
	jitter: true, // Add randomness to prevent thundering herd (default: true)
	shouldRetry: (error) => error.message !== 'FATAL', // Custom retry logic
}

const result = await withRetry(async () => {
	// Your async operation here
	return await someAsyncOperation()
}, options)
```

### Custom Retry Logic

```typescript
// Only retry on specific errors
await withRetry(
	async () => {
		return await apiCall()
	},
	{
		shouldRetry: (error) => {
			// Don't retry authentication errors
			return !error.message.includes('401') && !error.message.includes('403')
		},
	}
)
```

### Monitoring Retries

```typescript
// Log retry attempts for debugging
await withRetry(
	async () => {
		return await apiCall()
	},
	{
		maxAttempts: 3,
		onRetry: (error, attempt) => {
			console.warn(`Retry attempt ${attempt} due to: ${error.message}`)
		},
	}
)

// Async cleanup between retries
await withRetry(
	async () => {
		return await apiCall()
	},
	{
		onRetry: async (error, attempt) => {
			await cleanupResources()
			await metrics.recordRetry(error, attempt)
		},
	}
)
```

### Database Operations

```typescript
// Retry database connections with exponential backoff
const data = await withRetry(
	async () => {
		const connection = await db.connect()
		return connection.query('SELECT * FROM users')
	},
	{
		maxAttempts: 3,
		initialDelay: 500,
		shouldRetry: (error) => error.code === 'CONNECTION_LOST',
	}
)
```

## API Reference

### `withRetry<T>(operation, options?): Promise<T>`

Executes an async operation with retry logic.

**Parameters:**

- `operation: () => Promise<T>` - The async function to retry
- `options?: RetryOptions` - Configuration options

**Returns:** `Promise<T>` - The result of the operation

### `RetryOptions`

Configuration interface for retry behavior:

```typescript
interface RetryOptions {
	maxAttempts?: number // Maximum retry attempts (default: 10)
	initialDelay?: number // Initial delay in milliseconds (default: 1000)
	maxDelay?: number // Maximum delay cap in milliseconds (default: 30000)
	backoffFactor?: number // Exponential backoff multiplier (default: 2)
	jitter?: boolean // Add randomness to delays (default: true)
	shouldRetry?: (error: Error) => boolean // Custom retry logic (default: always retry)
	onRetry?: (error: Error, attempt: number) => void | Promise<void> // Callback before each retry
}
```

## How It Works

1. **Exponential Backoff**: Delays increase exponentially between retries (initialDelay × backoffFactor^attempt)
2. **Jitter**: Random variation (50-100% of calculated delay) prevents thundering herd problems
3. **Max Delay Cap**: Delays are capped at `maxDelay` to prevent excessively long waits
4. **Custom Retry Logic**: The `shouldRetry` function allows fine-grained control over when to retry

## Error Handling

- If all retry attempts fail, the last error is thrown
- If `shouldRetry` returns `false`, retrying stops immediately
- If `onRetry` throws an error, retrying stops and that error is thrown
- Errors are passed to `shouldRetry` for custom handling logic

## TypeScript Support

This package is written in TypeScript and includes full type definitions. Both the main function and options interface are exported for type safety.

## Publishing (Maintainers Only)

Publishing is automated via GitHub Actions. Create a [GitHub release](https://github.com/levibe/with-retry/releases/new) to trigger the publish workflow.

## Version History

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes in each version.

### Recent Changes

- **v0.2.0** - Added `onRetry` callback for monitoring retry attempts
- **v0.1.0** - Initial release with core retry functionality

## License

MIT © Levi Bucsis
