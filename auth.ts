import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

function isPasswordConfigured(): boolean {
  return !!process.env.DASHBOARD_PASSWORD;
}

function getAllowedEmails(): string[] {
  const emails = process.env.ALLOWED_EMAILS ?? "";
  return emails
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function getProviders(): Provider[] {
  const providers: Provider[] = [];

  if (isGoogleOAuthConfigured()) {
    providers.push(
      Google({
        authorization: {
          params: {
            scope: [
              "openid",
              "email",
              "profile",
              "https://www.googleapis.com/auth/drive.metadata.readonly",
              "https://www.googleapis.com/auth/spreadsheets.readonly",
            ].join(" "),
            include_granted_scopes: "true",
            access_type: "offline",
            prompt: "consent",
            response_type: "code",
          },
        },
      })
    );
  }

  if (isPasswordConfigured()) {
    providers.push(
      Credentials({
        id: "credentials",
        name: "이메일 비밀번호",
        credentials: {
          email: { label: "이메일", type: "email" },
          password: { label: "비밀번호", type: "password" },
        },
        async authorize(credentials) {
          const email = credentials?.email as string;
          const password = credentials?.password as string;

          if (!email || !password) return null;
          if (password !== process.env.DASHBOARD_PASSWORD) return null;

          return {
            id: email,
            name: email.split("@")[0],
            email,
            image: null,
          };
        },
      })
    );
  }

  if (providers.length === 0 || process.env.NODE_ENV !== "production") {
    providers.push(
      Credentials({
        id: "credentials",
        name: "개발 모드 로그인",
        credentials: {
          email: {
            label: "이메일",
            type: "email",
            placeholder: "dev@example.com",
          },
        },
        async authorize(credentials) {
          const email = credentials?.email as string;
          if (!email) return null;

          return {
            id: "dev-user-1",
            name: email.split("@")[0],
            email,
            image: null,
          };
        },
      })
    );
  }

  return providers;
}

async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID ?? "",
        client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !refreshedTokens.access_token || !refreshedTokens.expires_in) {
      throw new Error(
        refreshedTokens.error_description ??
          refreshedTokens.error ??
          "Failed to refresh Google access token",
      );
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: getProviders(),
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    signIn({ user }) {
      const allowed = getAllowedEmails();
      if (allowed.length === 0) return true;
      return allowed.includes(user.email ?? "");
    },
    async jwt({ token, account }) {
      if (account?.access_token) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 60 * 60 * 1000,
          refreshToken: account.refresh_token ?? token.refreshToken,
          error: undefined,
        };
      }

      if (token.accessToken && token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60_000) {
        return token;
      }

      if (token.refreshToken) {
        return refreshGoogleAccessToken(token);
      }

      return token;
    },
    session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }

      if (typeof token.accessToken === "string") {
        session.accessToken = token.accessToken;
      }

      if (typeof token.error === "string") {
        session.error = token.error;
      }

      return session;
    },
  },
});
