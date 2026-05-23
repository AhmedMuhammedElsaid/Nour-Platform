import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Direct process.env access (rather than @repo/config/env) is intentional and
// mirrors apps/web/next.config.ts: importing the validated env barrel pulls in
// parseEnv() at module load, which requires MONGODB_URI/AUTH_SECRET to be set
// at `next build` time. The build runs without those in local/preview
// environments, so this route — evaluated during page-data collection —
// would crash. The git SHA is build metadata, not a runtime secret; reading
// it raw here is the documented exception to CLAUDE.md §5.
const version =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

export function GET() {
  return NextResponse.json({
    ok: true,
    version,
    time: new Date().toISOString(),
  });
}
