import bcrypt from "bcryptjs"
import { sign, verify } from "hono/jwt"
import { env } from "../env"

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function generateToken(
  userId: string,
  email: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 7 * 24 * 60 * 60

  return sign(
    {
      sub: userId,
      email,
      iat: now,
      exp,
    },
    env.JWT_SECRET,
    "HS256",
  )
}

export async function verifyToken(
  token: string,
): Promise<{ sub: string; email: string }> {
  const payload = await verify(token, env.JWT_SECRET, "HS256")
  return payload as { sub: string; email: string }
}
