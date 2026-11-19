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
  ],
};
