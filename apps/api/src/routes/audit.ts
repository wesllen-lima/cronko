import { Hono } from "hono";
import { db } from "@cronko/database";
import { auditLogs } from "@cronko/database/schema";
import { desc, lt } from "drizzle-orm";

export const auditRoute = new Hono();

auditRoute.get("/", async (c) => {
  const limit = Math.min(
    Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50),
    200,
  );
  const before = c.req.query("before");

  const query = db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  if (before) {
    query.where(lt(auditLogs.createdAt, before));
  }

  const rows = await query;

  return c.json({
    data: rows.map((row: typeof auditLogs.$inferSelect) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    })),
  });
});