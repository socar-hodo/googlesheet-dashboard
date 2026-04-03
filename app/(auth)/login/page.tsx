import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const isGoogleConfigured = !!(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

const isPasswordConfigured = !!process.env.DASHBOARD_PASSWORD;

const errorMessages: Record<string, string> = {
  AccessDenied: "접근이 거부되었습니다. 허용된 이메일인지 확인해 주세요.",
  Configuration: "로그인 설정에 문제가 있습니다. 관리자에게 문의해 주세요.",
  Verification: "인증 링크가 만료되었습니다. 다시 시도해 주세요.",
  Default: "로그인 중 오류가 발생했습니다. 다시 시도해 주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? errorMessages.Default : null;
  const redirectTo = callbackUrl || "/work-history";

  return (
    <Card className="mx-4 w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">로그인</CardTitle>
        <CardDescription>
          {isGoogleConfigured
            ? "Google 계정으로 워크스페이스 포털에 로그인하세요."
            : "개발 모드: 이메일만 입력하면 바로 로그인됩니다."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20"
          >
            <p className="font-medium">로그인 실패</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {isGoogleConfigured ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <Button className="w-full" size="lg" aria-label="Google 계정으로 로그인">
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" role="img">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  className="fill-[#4285F4] dark:fill-[#8AB4F8]"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  className="fill-[#34A853] dark:fill-[#81C995]"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  className="fill-[#FBBC05] dark:fill-[#FDD663]"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  className="fill-[#EA4335] dark:fill-[#F28B82]"
                />
              </svg>
              Google로 로그인
            </Button>
          </form>
        ) : !isPasswordConfigured ? (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email"),
                redirectTo,
              });
            }}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="dev-email" className="text-sm font-medium text-foreground">이메일</label>
                <input
                  id="dev-email"
                  name="email"
                  type="email"
                  placeholder="이메일을 입력하세요"
                  defaultValue=""
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button className="w-full" size="lg" type="submit">
                로그인 (개발 모드)
              </Button>
            </div>
          </form>
        ) : null}

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
                  redirectTo,
                });
              }}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="cred-email" className="text-sm font-medium text-foreground">이메일</label>
                  <input
                    id="cred-email"
                    name="email"
                    type="email"
                    placeholder="이메일"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cred-password" className="text-sm font-medium text-foreground">비밀번호</label>
                  <input
                    id="cred-password"
                    name="password"
                    type="password"
                    placeholder="비밀번호"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
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
