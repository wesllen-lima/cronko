import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { env } from "../env";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const csrf: MiddlewareHandler = async (c, next) => {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    const existing = getCookie(c, CSRF_COOKIE);
    if (!existing) {
      const token = generateToken();
      setCookie(c, CSRF_COOKIE, token, {
        httpOnly: false,
        secure: env.NODE_ENV === "production",
        sameSite: "Strict",
        path: "/api",
        maxAge: 60 * 60,
      });
    }
    return next();
  }

  const cookieToken = getCookie(c, CSRF_COOKIE);
  const headerToken = c.req.header(CSRF_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return c.json(
      { error: "Invalid CSRF token", code: "CSRF_INVALID" },
      403,
    );
  }

  return next();
};