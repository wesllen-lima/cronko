import { drizzle } from "drizzle-orm/better-sqlite3"
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js"
import Database from "better-sqlite3"
import postgres from "postgres"
import * as schema from "./schema"

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error("DATABASE_URL environment variable is required")
}

// TODO(Sprint 5): Replace `any` with proper union type when Drizzle ORM supports
// conditional typing for SQLite | Postgres without signature incompatibility.
// See https://github.com/drizzle-team/drizzle-orm/issues/xxxx
export const db: any = url.startsWith("file:")
  ? drizzle(new Database(url.replace("file:", "")), { schema })
  : drizzlePg(postgres(url), { schema })

export * from "./schema"