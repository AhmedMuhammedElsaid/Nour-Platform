import { NextResponse } from "next/server";

export const runtime = "nodejs";

const version =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

export function GET() {
  return NextResponse.json({
    ok: true,
    version,
    time: new Date().toISOString(),
  });
}
