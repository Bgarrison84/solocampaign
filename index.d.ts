/// <reference types="vite/client" />

// rpg-dice-roller ships types at ./types/index.d.ts but its package.json
// `exports["."]` block omits a `types` field, so under moduleResolution:bundler
// TypeScript cannot resolve them. Re-point the bare specifier at the shipped
// declarations until the upstream package adds the `types` export.
declare module 'rpg-dice-roller' {
  export * from 'rpg-dice-roller/types/index.d.ts'
}
