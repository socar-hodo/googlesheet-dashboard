// 라우트 보호 프록시 (Next.js 16에서 middleware → proxy로 변경)
// 미인증 사용자를 로그인 페이지로 리다이렉트합니다
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // 보호된 경로: /dashboard, /allocation 등 대시보드 하위 경로
  const isProtectedRoute =
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/allocation");
  // 인증 경로: /login 페이지
  const isAuthRoute = nextUrl.pathname.startsWith("/login");

  // 미인증 사용자 → 로그인 페이지로 리다이렉트
  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // 이미 로그인된 사용자 → 대시보드로 리다이렉트
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

// 정적 파일과 API를 제외한 모든 경로에 프록시 적용
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
