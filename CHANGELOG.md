# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2025-10-26

### Added
- GitHub Actions workflows for automated testing and publishing
  - Test workflow runs lint, typecheck, tests, and build on PRs and main branch pushes
  - Publish workflow automatically publishes to GitHub Packages on release creation with version validation
- Comprehensive installation documentation with one-time setup instructions for GitHub Packages authentication
- Publishing documentation covering both automated (via GitHub releases) and manual publishing workflows
- `validate` script that runs full test suite for local pre-push validation
- Pre-push git hook for catching issues before CI/CD

### Changed
- Configure package as private (restricted access) for GitHub Packages distribution
- Update `prepublishOnly` to run full validation instead of just build
- Fix ESLint configuration for ESM compatibility (rename to .cjs)

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

[0.2.2]: https://github.com/levibe/with-retry/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/levibe/with-retry/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/levibe/with-retry/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/levibe/with-retry/releases/tag/v0.1.0