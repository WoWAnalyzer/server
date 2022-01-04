module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: ['google', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 13,
    sourceType: 'module',
  },
  rules: {
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
    'new-cap': 'off',
  },
};
