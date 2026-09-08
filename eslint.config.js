const expoConfig = require('./frontend/node_modules/eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      'frontend/dist/**',
      'frontend/.metro-cache/**',
      'frontend/src/components/ui/**',
      'frontend/src/hooks/use-toast.js',
      'frontend/src/lib/utils.js',
      'frontend/src/App.js',
      'frontend/src/index.js',
      'frontend/scripts/**',
      'frontend/craco.config.js',
      'frontend/plugins/**',
      'frontend/public/sw.js',
      'backend/**',
      'temp_repo/**',
      'tests/**',
      'memory/**',
      'test_reports/**',
    ],
  },
];
