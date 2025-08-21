module.exports = {
  presets: [
    'module:metro-react-native-babel-preset',
    '@babel/preset-typescript',
  ],
  plugins: [
    // React Native Reanimated plugin (must be listed last)
    'react-native-reanimated/plugin',
    
    // Module resolver for absolute imports
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@services': './src/services',
          '@utils': './src/utils',
          '@store': './src/store',
          '@types': './src/types',
          '@assets': './src/assets',
        },
      },
    ],
    
    // Optional chaining and nullish coalescing
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',
    
    // Class properties
    '@babel/plugin-proposal-class-properties',
    
    // Decorators (if needed for future marine sensor integrations)
    ['@babel/plugin-proposal-decorators', {legacy: true}],
    
    // React Native specific
    'react-native-paper/babel',
  ],
  env: {
    production: {
      plugins: [
        'react-native-paper/babel',
        'transform-remove-console', // Remove console logs in production
      ],
    },
    test: {
      plugins: [
        '@babel/plugin-transform-modules-commonjs',
      ],
    },
  },
};