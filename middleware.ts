import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;
  const isProtectedRoute = pathname.startsWith("/admin") || pathname.startsWith("/user");

  function noStoreResponse(response: NextResponse) {
    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  }

  if (isProtectedRoute && !token) {
    return noStoreResponse(NextResponse.redirect(new URL("/login", request.url)));
  }

  try {
    if (!isProtectedRoute) {
      return noStoreResponse(NextResponse.next());
    }

    const payload = await verifyToken(token ?? "");
    if (pathname.startsWith("/admin") && payload.role !== "admin") {
      return noStoreResponse(NextResponse.redirect(new URL("/user", request.url)));
    }
    if (pathname.startsWith("/user") && payload.role !== "user" && payload.role !== "admin") {
      return noStoreResponse(NextResponse.redirect(new URL("/admin", request.url)));
    }
    return noStoreResponse(NextResponse.next());
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth_token");
    return noStoreResponse(response);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api|favicon.ico|robots.txt|sitemap.xml).*)"]
};
