const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      'dist/*',
      '.metro-cache/*',
      'node_modules/*',
      'src/components/ui/*',
      'src/hooks/use-toast.js',
      'src/lib/utils.js',
      'src/App.js',
      'src/index.js',
      'scripts/*',
      'craco.config.js',
      'plugins/**',
      'public/sw.js',
    ],
  },
]);
