import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const token = request.cookies.get("cronko_token")?.value

  let authenticated = false
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number }
      authenticated = !payload.exp || Date.now() < payload.exp * 1000
    } catch {}
  }

  if (authenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (!authenticated && pathname !== "/login") {
    const loginUrl = new URL("/login", request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete("cronko_token")
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico).*)",
  ],
}
