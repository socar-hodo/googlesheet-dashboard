import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 서버리스 함수 리전: 도쿄 (서울 미지원 시 가장 가까운 리전)
  serverExternalPackages: ["@google-cloud/bigquery", "google-auth-library"],
  // Google 프로필 이미지 로딩 허용
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Vercel 서버리스: sql/ 디렉토리를 output file tracing에 포함
  outputFileTracingIncludes: {
    "/api/allocation/run": ["./sql/**/*.sql"],
    "/api/relocation/run": ["./sql/**/*.sql"],
    "/api/relocation/candidates": ["./sql/**/*.sql"],
    "/api/zone/zones": ["./sql/**/*.sql"],
    "/api/zone/simulate/open": ["./sql/**/*.sql"],
    "/api/zone/simulate/close": ["./sql/**/*.sql"],
    "/api/zone/compare": ["./sql/**/*.sql"],
    "/api/zone/optimize": ["./sql/**/*.sql"],
    "/api/funnel/regions": ["./sql/**/*.sql"],
    "/api/funnel/weekly": ["./sql/**/*.sql"],
    "/api/funnel/detail": ["./sql/**/*.sql"],
    "/dashboard": ["./sql/**/*.sql"],
    "/api/dashboard/region-detail": ["./sql/**/*.sql"],
    "/api/dashboard/forecast-detail": ["./sql/**/*.sql"],
  },
};

export default nextConfig;
