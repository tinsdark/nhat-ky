import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // docs/report holds one-off tooling scripts (Node, not app code); .claude holds vendored skill scripts. Neither is part of the lint gate.
  { ignores: ['dist', 'dev-dist', 'docs/report', '.claude'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  { languageOptions: { globals: globals.browser } },
  // e2e/ holds Playwright scripts run with Node (CommonJS), outside the app bundle.
  {
    files: ['e2e/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
)
