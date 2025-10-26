# @levibe/with-retry

A TypeScript retry utility with exponential backoff and jitter, designed for robust error handling in asynchronous operations.

## Why Another Retry Library?

When I went to replace this retry utility with [p-retry](https://github.com/sindresorhus/p-retry), I realized I preferred this implementation's API design. The naming reads more naturally to me: `withRetry` instead of `pRetry`, `maxAttempts` instead of `retries`, `shouldRetry` instead of buried retry logic.

I'm making this available for anyone who might share that preference.

*p-retry is more battle-tested and likely the better choice for most use cases.*

## Installation

This package is published to GitHub Packages. Follow these steps to install it.

### One-Time Setup

This setup is done **once** and works for all `@levibe` packages.

#### 1. Create GitHub Personal Access Token

Create a token at https://github.com/settings/tokens/new:

- Name: `npm-read-packages`
- Expiration: 90 days (or No expiration)
- Scopes: ✅ `read:packages`

**Important:** Copy the token immediately—you won't see it again!

#### 2. Store Token in macOS Keychain

```bash
# Store token securely
security add-generic-password \
  -a "$USER" \
  -s "github-npm-read-token" \
  -w "ghp_your_token_here"

# Verify it's stored
security find-generic-password -a "$USER" -s "github-npm-read-token" -w
```

#### 3. Add to Shell Configuration (~/.zshrc)

```bash
# GitHub Packages - Read token for installing packages
export GITHUB_NPM_TOKEN=$(security find-generic-password -a "$USER" -s "github-npm-read-token" -w 2>/dev/null)
```

Then reload your shell:

```bash
source ~/.zshrc
```

**Verify setup:**

```bash
echo $GITHUB_NPM_TOKEN  # Should show your token
```

### Installing the Package

#### 1. Create `.npmrc` in your project root:

```
@levibe:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_NPM_TOKEN}
```

This scoped configuration **only affects `@levibe` packages**. Other packages still come from npmjs.org.

#### 2. Install:

```bash
npm install @levibe/with-retry
# or
pnpm install @levibe/with-retry
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
  maxAttempts: 5,        // Maximum number of attempts (default: 10)
  initialDelay: 1000,    // Initial delay in ms (default: 1000)
  maxDelay: 30000,       // Maximum delay in ms (default: 30000)
  backoffFactor: 2,      // Exponential backoff multiplier (default: 2)
  jitter: true,          // Add randomness to prevent thundering herd (default: true)
  shouldRetry: (error) => error.message !== 'FATAL' // Custom retry logic
}

const result = await withRetry(async () => {
  // Your async operation here
  return await someAsyncOperation()
}, options)
```

### Custom Retry Logic

```typescript
// Only retry on specific errors
await withRetry(async () => {
  return await apiCall()
}, {
  shouldRetry: (error) => {
    // Don't retry authentication errors
    return !error.message.includes('401') && !error.message.includes('403')
  }
})
```

### Monitoring Retries

```typescript
// Log retry attempts for debugging
await withRetry(async () => {
  return await apiCall()
}, {
  maxAttempts: 3,
  onRetry: (error, attempt) => {
    console.warn(`Retry attempt ${attempt} due to: ${error.message}`)
  }
})

// Async cleanup between retries
await withRetry(async () => {
  return await apiCall()
}, {
  onRetry: async (error, attempt) => {
    await cleanupResources()
    await metrics.recordRetry(error, attempt)
  }
})
```

### Database Operations

```typescript
// Retry database connections with exponential backoff
const data = await withRetry(async () => {
  const connection = await db.connect()
  return connection.query('SELECT * FROM users')
}, {
  maxAttempts: 3,
  initialDelay: 500,
  shouldRetry: (error) => error.code === 'CONNECTION_LOST'
})
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
  maxAttempts?: number      // Maximum retry attempts (default: 10)
  initialDelay?: number     // Initial delay in milliseconds (default: 1000)
  maxDelay?: number         // Maximum delay cap in milliseconds (default: 30000)
  backoffFactor?: number    // Exponential backoff multiplier (default: 2)
  jitter?: boolean          // Add randomness to delays (default: true)
  shouldRetry?: (error: Error) => boolean  // Custom retry logic (default: always retry)
  onRetry?: (error: Error, attempt: number) => void | Promise<void>  // Callback before each retry
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

### Automated Publishing (Recommended)

The repository includes GitHub Actions workflows that automatically publish to GitHub Packages when you create a release:

1. **Update version and changelog**
   ```bash
   # Update package.json version (follow semver)
   # Update CHANGELOG.md with changes
   git add .
   git commit -m "Bump version to X.Y.Z"
   git push
   ```

2. **Create a GitHub Release**
   - Go to https://github.com/levibe/with-retry/releases/new
   - Tag version: `vX.Y.Z` (must match package.json version)
   - Release title: `vX.Y.Z`
   - Describe the changes
   - Click "Publish release"

3. **Automatic publish**
   - GitHub Actions will automatically publish to GitHub Packages
   - The workflow validates that the tag version matches package.json
   - View progress in the Actions tab

### Manual Publishing

For local publishing, set up a write token:

**Setup (one-time):**

Create a token at https://github.com/settings/tokens/new:
- Name: `npm-write-packages`
- Scopes: ✅ `write:packages`

Store in keychain:

```bash
security add-generic-password \
  -a "$USER" \
  -s "github-npm-write-token" \
  -w "ghp_your_write_token_here"
```

Add publish function to `~/.zshrc`:

```bash
github-npm-publish() {
  GITHUB_NPM_TOKEN=$(security find-generic-password -a "$USER" -s "github-npm-write-token" -w) npm publish "$@"
}
```

**Publishing:**

```bash
github-npm-publish
```

### GitHub Actions Workflows

The repository includes two workflows:

- **test.yml** - Runs on PRs and pushes to main: lint, typecheck, test, build
- **publish.yml** - Runs on GitHub releases: validates version and publishes to GitHub Packages

## Version History

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes in each version.

### Recent Changes

- **v0.2.0** - Added `onRetry` callback for monitoring retry attempts
- **v0.1.0** - Initial release with core retry functionality

## License

MIT © Levi Bucsis