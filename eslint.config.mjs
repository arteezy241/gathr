import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import prettierConfig from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  ...tsPlugin.configs['flat/strict-type-checked'],
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  prettierConfig,
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
      'import/ignore': ['react-native'],
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-media-library',
              message: 'Import from lib/mediaLibrary.ts instead.',
            },
            {
              name: 'expo-media-library/next',
              message: 'Import from lib/mediaLibrary.ts instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/mediaLibrary.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]
