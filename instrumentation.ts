export async function register() {
  const { checkRequiredEnv } = await import("@/lib/env-check");
  checkRequiredEnv();
}
