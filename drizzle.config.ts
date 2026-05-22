import type { Config } from 'drizzle-kit'

export default {
  schema: './src/main/db/schema.ts',
  out: './resources/migrations',
  dialect: 'sqlite',
} satisfies Config
