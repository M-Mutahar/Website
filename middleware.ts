import { NextRequest, NextResponse } from "next/server";

// IMPORTANT: do not restore `export { default } from "next-auth/middleware"`
// here. This app uses `session: { strategy: "database" }` (see lib/auth.ts).
// next-auth/middleware's default export authenticates via getToken(), which
// decodes the session cookie AS A JWT — but under the database strategy the
// cookie is an opaque token, not a JWT, so getToken() always returns null
// and every signed-in user gets redirected away. That's not a bypass, it's
// a full lockout of the dashboard for everyone, including legitimate users.
//
// This middleware only checks whether a session cookie is PRESENT — it is
// a fast redirect for the common "definitely signed out" case, nothing
// more. It is intentionally not the source of truth: the real, independent
// checks are getServerSession() in app/dashboard/page.tsx and inside
// app/api/extract/route.ts, both of which validate the session against the
// database. Do not remove those checks on the assumption this file covers it.
export function middleware(req: NextRequest) {
  const hasSessionCookie =
    req.cookies.has("next-auth.session-token") ||
    req.cookies.has("__Secure-next-auth.session-token"); // used over HTTPS in production

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
