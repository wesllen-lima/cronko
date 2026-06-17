import { drizzle } from "drizzle-orm/better-sqlite3"
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js"
import Database from "better-sqlite3"
import postgres from "postgres"
import * as schema from "./schema"

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error("DATABASE_URL environment variable is required")
}

// SQLite and Postgres drizzle instances have incompatible signatures.
// Using a union type here would break all query files — `any` is
// intentional until Drizzle adds a shared interface.
export const db: any = url.startsWith("file:")
  ? drizzle(new Database(url.replace("file:", "")), { schema })
  : drizzlePg(postgres(url), { schema })

export * from "./schema"