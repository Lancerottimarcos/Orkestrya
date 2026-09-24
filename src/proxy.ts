import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = [
  "/login",
  "/aprovacao",
  "/portal/login",
  "/esqueci-senha",
  "/portal/esqueci-senha",
  "/p/",
  "/proposta/",
  "/contrato/",
  "/formulario/",
  "/l/",
  "/politica-de-privacidade",
  "/termos-de-uso",
  "/exclusao-de-usuario",
  "/solicitacoes-exclusao-dados/",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isPortalPath = pathname.startsWith("/portal");
  const isLoggedIn = !!req.auth;
  const userType = req.auth?.user?.userType;

  if (!isLoggedIn && !isPublicPath) {
    const loginPath = isPortalPath ? "/portal/login" : "/login";
    const loginUrl = new URL(loginPath, req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (isLoggedIn && pathname.startsWith("/portal/login") && userType === "client") {
    return NextResponse.redirect(new URL("/portal", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|uploads/).*)"],
};
