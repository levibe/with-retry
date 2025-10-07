# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-10-06

### Changed
- Convert package to pure ESM format for compatibility with modern tooling and ESM-native bundlers like Vite

## [0.2.0] - 2025-01-22

### Added
- `onRetry` callback option that executes before each retry attempt
  - Receives the error that triggered the retry and the current attempt number
  - Supports both synchronous and asynchronous callbacks
  - Useful for logging, metrics collection, and cleanup between retries
  - If the callback throws an error, retrying stops immediately


## [0.1.0] - 2025-01-22

### Added
- Initial release of @levibe/with-retry
- Core retry functionality with exponential backoff
- Configurable retry options:
  - `maxAttempts`: Maximum number of retry attempts (default: 10)
  - `initialDelay`: Initial delay in milliseconds (default: 1000)
  - `maxDelay`: Maximum delay cap in milliseconds (default: 30000)
  - `backoffFactor`: Exponential backoff multiplier (default: 2)
  - `jitter`: Add randomness to delays to prevent thundering herd (default: true)
  - `shouldRetry`: Custom function to determine if an error should trigger a retry
- Full TypeScript support with type definitions
- Comprehensive test suite with 100% code coverage
- ESLint and TypeScript configuration for code quality
- Exponential backoff with configurable multiplier
- Jitter support to prevent thundering herd problems
- Custom retry logic via `shouldRetry` callback
- Proper error handling and validation
- Support for both Error objects and non-Error thrown values

[0.2.1]: https://github.com/levibe/with-retry/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/levibe/with-retry/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/levibe/with-retry/releases/tag/v0.1.0