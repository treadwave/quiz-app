import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@quiz/shared";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let authenticated = false;

  if (token) {
    try {
      verifyAuthToken(token);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/quizzes/:path*",
    "/host/:path*",
    "/play",
    "/play/:path*",
  ],
};
