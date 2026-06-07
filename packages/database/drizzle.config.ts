import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: process.env.DATABASE_URL?.startsWith("file:") ? "sqlite" : "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})