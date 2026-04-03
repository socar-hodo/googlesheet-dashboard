import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  },
};

export default nextConfig;
