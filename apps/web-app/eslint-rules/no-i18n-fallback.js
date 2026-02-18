/**
 * ESLint Rule: no-i18n-fallback
 *
 * Warns against using fallback patterns with LanguageService.t() calls.
 *
 * Bad:
 *   LanguageService.t('key') || 'Fallback text'
 *   LanguageService.tInterpolate('key', params) || 'Fallback'
 *
 * Good:
 *   LanguageService.t('key')
 *   LanguageService.tInterpolate('key', params)
 *
 * If the key is missing, add it to en.json instead of using a fallback.
 * Run `npm run validate:i18n` to find missing keys.
 */

/** @type {import('eslint').Rule.RuleModule} */
export const noI18nFallback = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow fallback patterns with LanguageService.t() calls',
      recommended: true,
    },
    messages: {
      noFallback:
        'Avoid fallback patterns with {{ method }}(). If the key "{{ key }}" is missing, add it to en.json. Run `npm run validate:i18n` to check.',
      noFallbackUnknownKey:
        'Avoid fallback patterns with {{ method }}(). Add the translation key to en.json instead. Run `npm run validate:i18n` to check.',
    },
    schema: [], // no options
  },

  create(context) {
    return {
      // Match: LanguageService.t('key') || 'fallback'
      // Match: LanguageService.tInterpolate('key', params) || 'fallback'
      LogicalExpression(node) {
        // Only check || operators
        if (node.operator !== '||') {
          return;
        }

        const left = node.left;

        // Check if left side is a call to LanguageService.t or LanguageService.tInterpolate
        if (left.type !== 'CallExpression') {
          return;
        }

        const callee = left.callee;

        // Check for MemberExpression: LanguageService.t or LanguageService.tInterpolate
        if (callee.type !== 'MemberExpression') {
          return;
        }

        const object = callee.object;
        const property = callee.property;

        // Check object is "LanguageService"
        if (object.type !== 'Identifier' || object.name !== 'LanguageService') {
          return;
        }

        // Check property is "t" or "tInterpolate"
        if (property.type !== 'Identifier') {
          return;
        }

        const methodName = property.name;
        if (methodName !== 't' && methodName !== 'tInterpolate') {
          return;
        }

        // Check right side is a string literal (the fallback)
        const right = node.right;
        if (right.type !== 'Literal' || typeof right.value !== 'string') {
          return;
        }

        // Extract the translation key if it's a string literal
        const args = left.arguments;
        let keyValue = null;

        if (args.length > 0 && args[0].type === 'Literal') {
          keyValue = args[0].value;
        }

        // Report the issue
        if (keyValue) {
          context.report({
            node,
            messageId: 'noFallback',
            data: {
              method: `LanguageService.${methodName}`,
              key: keyValue,
            },
          });
        } else {
          context.report({
            node,
            messageId: 'noFallbackUnknownKey',
            data: {
              method: `LanguageService.${methodName}`,
            },
          });
        }
      },
    };
  },
};

/**
 * ESLint Plugin: xivdyetools-i18n
 *
 * Local plugin for XIV Dye Tools i18n linting rules.
 */
export const plugin = {
  meta: {
    name: 'eslint-plugin-xivdyetools-i18n',
    version: '1.0.0',
  },
  rules: {
    'no-i18n-fallback': noI18nFallback,
  },
};

export default plugin;
