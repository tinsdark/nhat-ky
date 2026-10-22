import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // docs/report holds one-off tooling scripts (Node, not app code); they are not part of the lint gate.
  { ignores: ['dist', 'dev-dist', 'docs/report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  { languageOptions: { globals: globals.browser } },
)
