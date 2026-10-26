import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['scripts/audit-dyes*.ts', 'scripts/stain-audit/**/*.ts'],
  extends: [eslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
  languageOptions: {
    parserOptions: { project: './tsconfig.audit-dyes.json', tsconfigRootDir: import.meta.dirname },
  },
  rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error' },
});
