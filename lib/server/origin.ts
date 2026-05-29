import "server-only";

export function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  allowedOrigins.add(new URL(request.url).origin);

  return allowedOrigins.has(origin);
}
