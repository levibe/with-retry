const tsParser = require('@typescript-eslint/parser')
const tsEslint = require('@typescript-eslint/eslint-plugin')

module.exports = [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.test.json']
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint,
    },
    rules: {
      ...tsEslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      'prefer-const': 'error',
      'no-console': 'warn',
      'indent': ['error', 'tab'],
      'semi': ['error', 'never'],
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '**/*.d.ts'],
  },
]