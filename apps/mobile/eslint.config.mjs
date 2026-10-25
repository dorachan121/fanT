import { typescriptConfig } from '@fant/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['.expo/', 'android/', 'ios/'] },
  ...typescriptConfig({ tsconfigRootDir: import.meta.dirname }),
  reactHooks.configs.flat.recommended,
  {
    // The worklets Babel plugin turns worklet function declarations into variables that
    // are not hoisted, and a worklet captures its helpers when the module loads, so a
    // helper used before its declaration is `undefined` on the camera thread.
    files: ['**/*.worklet.ts'],
    rules: {
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: true, classes: true, variables: true },
      ],
    },
  },
];
