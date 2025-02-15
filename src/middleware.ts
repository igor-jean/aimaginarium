import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Rafraîchir la session si elle existe
  await supabase.auth.getSession();

  // Vérifier l'authentification
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si l'utilisateur n'est pas authentifié et essaie d'accéder à une route protégée
  if (
    !user &&
    (req.nextUrl.pathname.startsWith("/games") ||
      req.nextUrl.pathname.startsWith("/profile"))
  ) {
    const redirectUrl = new URL("/auth", req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Si l'utilisateur est authentifié et essaie d'accéder à la page d'auth
  if (user && req.nextUrl.pathname === "/auth") {
    const redirectUrl = new URL("/games", req.url);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/games/:path*", "/auth", "/profile"],
};
