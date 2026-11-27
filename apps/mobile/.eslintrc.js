module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // Text and TextInput come from AppText, which adds the brand font and the text-size cap.
      files: ['src/**/*.{ts,tsx}', 'App.tsx'],
      excludedFiles: ['src/components/AppText.tsx'],
      rules: {
        'no-restricted-imports': ['error', { paths: [{ name: 'react-native', importNames: ['Text', 'TextInput'], message: "Use AppText / AppTextInput from 'components/AppText' (brand font + text-size cap)." }] }],
      },
    },
    {
      // Style guard (warn): keep screens/components on theme tokens, i18n and Sheet/toast.
      files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
      excludedFiles: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
      rules: {
        'no-restricted-syntax': [
          'error',
          { selector: "Property[key.name='fontSize'][value.type='Literal']", message: 'Use AppText variant / typeScale from theme.ts instead of a literal fontSize.' },
          { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Use colors from useTheme() instead of hex literals.' },
          { selector: "CallExpression[callee.object.name='Alert'][callee.property.name='alert']", message: 'Use a Sheet confirm or toast() instead of Alert.alert.' },
          { selector: "ConditionalExpression[test.name='ar'][consequent.type='Literal'][alternate.type='Literal']", message: 'Move copy to i18n.ts and use t(lang, key).' },
        ],
      },
    },
  ],
};
