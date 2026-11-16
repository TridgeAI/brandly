import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages anyone can open. Everything else needs a session.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // Supabase not configured yet: run without auth.

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie. Keep this directly after createServerClient.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!signedIn && !isPublic) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  if (signedIn && (path === "/login" || path === "/signup")) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  // Skip static files and images. n8n webhooks call /api with their own secret, not a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
