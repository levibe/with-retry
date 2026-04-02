import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const sharedRules = {
	'no-unused-vars': 'off',
	'@typescript-eslint/no-unused-vars': [
		'error',
		{
			argsIgnorePattern: '^_',
			varsIgnorePattern: '^_',
			caughtErrorsIgnorePattern: '^_',
		},
	],
	'@typescript-eslint/no-explicit-any': 'warn',
	'@typescript-eslint/explicit-module-boundary-types': 'off',
	'@typescript-eslint/no-non-null-assertion': 'off',
	'no-console': 'warn',
	'prefer-const': 'error',
}

export default tseslint.config(
	{
		ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.js', '*.mjs', '*.cjs', '*.d.ts'],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		rules: sharedRules,
	},
	{
		files: ['tests/**/*.ts'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
		},
		rules: sharedRules,
	},
	// eslint-config-prettier must be LAST to disable formatting rules
	prettier
)
