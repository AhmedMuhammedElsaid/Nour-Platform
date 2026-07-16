import { NextResponse } from "next/server";

import { BUILD_VERSION } from "@/lib/build-version";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    version: BUILD_VERSION,
    time: new Date().toISOString(),
  });
}
