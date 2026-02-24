import { signIn } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Google OAuth가 설정되었는지 서버에서 확인
const isGoogleConfigured = !!(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

// 공유 비밀번호 로그인이 설정되었는지 확인
const isPasswordConfigured = !!process.env.DASHBOARD_PASSWORD;

// NextAuth 에러 코드 → 한국어 메시지 매핑
const errorMessages: Record<string, string> = {
  AccessDenied: "접근이 거부되었습니다. 허용된 이메일이 아닙니다.",
  Configuration: "서버 설정에 문제가 있습니다. 관리자에게 문의하세요.",
  Verification: "인증 링크가 만료되었습니다. 다시 시도해주세요.",
  Default: "로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
};

// 로그인 페이지 (Server Component)
// 에러 발생 시 한국어 메시지 표시 + 다시 로그인 가능
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? errorMessages[error] ?? errorMessages.Default
    : null;

  return (
    <Card className="w-full max-w-md mx-4">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">로그인</CardTitle>
        <CardDescription>
          {isGoogleConfigured
            ? "Google 계정으로 로그인하세요"
            : "개발 모드: 이메일을 입력하면 바로 로그인됩니다"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* 에러 메시지 배너 */}
        {errorMessage && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
            <p className="font-medium">로그인 실패</p>
            <p className="mt-1">{errorMessage}</p>
            {error === "AccessDenied" && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                다른 Google 계정으로 다시 시도해주세요.
              </p>
            )}
          </div>
        )}

        {isGoogleConfigured ? (
          /* === Google OAuth 로그인 === */
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button className="w-full" size="lg">
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {error ? "다른 계정으로 다시 로그인" : "Google로 로그인"}
            </Button>
          </form>
        ) : !isPasswordConfigured ? (
          /* === 개발 모드: 이메일 입력 로그인 === */
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email"),
                redirectTo: "/dashboard",
              });
            }}
          >
            <div className="space-y-4">
              <input
                name="email"
                type="email"
                placeholder="dev@example.com"
                defaultValue="dev@example.com"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button className="w-full" size="lg" type="submit">
                로그인 (개발 모드)
              </Button>
            </div>

            {/* 개발 모드 안내 배너 */}
            <div className="mt-4 rounded-md bg-yellow-50 dark:bg-yellow-950 p-3 text-xs text-yellow-800 dark:text-yellow-200">
              <p className="font-medium">개발 모드</p>
              <p className="mt-1">
                Google OAuth 키가 설정되지 않아 개발용 로그인을 사용합니다.
                프로덕션에서는 .env.local에 AUTH_GOOGLE_ID와
                AUTH_GOOGLE_SECRET을 설정하세요.
              </p>
            </div>
          </form>
        ) : null}

        {/* === 이메일 + 비밀번호 로그인 === */}
        {isPasswordConfigured && (
          <>
            {isGoogleConfigured && (
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">또는</span>
                </div>
              </div>
            )}
            <form
              action={async (formData: FormData) => {
                "use server";
                await signIn("credentials", {
                  email: formData.get("email"),
                  password: formData.get("password"),
                  redirectTo: "/dashboard",
                });
              }}
            >
              <div className="space-y-3">
                <input
                  name="email"
                  type="email"
                  placeholder="이메일"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  name="password"
                  type="password"
                  placeholder="비밀번호"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button className="w-full" size="lg" type="submit" variant="outline">
                  이메일로 로그인
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
