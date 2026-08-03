import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { canInstruct } from "@/lib/roles";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  const { pathname } = req.nextUrl;
  // /admin/create-training is instructor-or-admin; the rest of /admin
  // (role management) stays admin-only.
  const allowed = pathname.startsWith("/admin/create-training")
    ? canInstruct(req.auth.user?.role)
    : !pathname.startsWith("/admin") || req.auth.user?.role === "ADMIN";
  if (!allowed) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/account/:path*"],
};
