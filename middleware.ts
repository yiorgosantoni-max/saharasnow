import { NextRequest, NextResponse } from "next/server";

// Keep the existing /api/admin PATCH actions untouched, but route dashboard GETs
// through the ledger-backed reader so historical released orders are reflected.
export function middleware(req: NextRequest) {
  if (req.method === "GET" && req.nextUrl.pathname === "/api/admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/admin-dashboard";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/admin"] };
