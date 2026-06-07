import { drizzle } from "drizzle-orm/better-sqlite3"
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js"
import Database from "better-sqlite3"
import postgres from "postgres"
import * as schema from "./schema"

const url = process.env.DATABASE_URL!

// eslint-disable-next-line
export const db: any = url.startsWith("file:")
  ? drizzle(new Database(url.replace("file:", "")), { schema })
  : drizzlePg(postgres(url), { schema })

export * from "./schema"