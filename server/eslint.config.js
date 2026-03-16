export default [
  {
    files: ["../scripts/**/*.js", "./*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        history: "readonly",
        location: "readonly",
        performance: "readonly",
        Intl: "readonly",
        Blob: "readonly",
        FormData: "readonly",
        URLSearchParams: "readonly",
        requestAnimationFrame: "readonly",
        IntersectionObserver: "readonly",
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "warn",
    },
  },
];

