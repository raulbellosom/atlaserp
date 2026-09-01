// Minimal ESLint config: one guardrail rule, no style linting.
// `toISOString()` is always UTC; deriving a local date/month from it is a bug.
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-*/**",
      "apps/desktop/src-tauri/**",
      "prisma/migrations/**",
      "docs/**",
      "**/*.min.js",
      "**/.vite/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    linterOptions: { reportUnusedDisableDirectives: false },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // The codebase has many `// eslint-disable-next-line react-hooks/*` comments.
    // We don't lint hooks here, but ESLint 9 errors on disable-comments that
    // name an unknown rule, so register them as no-ops.
    plugins: {
      "react-hooks": {
        rules: {
          "exhaustive-deps": { create: () => ({}) },
          "rules-of-hooks": { create: () => ({}) },
        },
      },
    },
    rules: {
      // 'warn' for now: ~80 pre-existing call sites need a per-file audit
      // (many are deliberately UTC — recurrence math, instant serialization,
      // DB day-bucketing). Flip to 'error' once the backlog is cleared.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
          message:
            "toISOString() is UTC. Use toLocalIso()/toLocalMonth() from @atlas/core to derive a local date/month.",
        },
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString']",
          message:
            "toISOString() is UTC. Use toLocalIso() from @atlas/core to derive a local date.",
        },
      ],
    },
  },
];
