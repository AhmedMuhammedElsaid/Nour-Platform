import { listStations } from "@repo/api/services/radio";

import { corsPreflight } from "@/lib/cors";
import { jsonOk, jsonError } from "../_lib/respond";
import { withIsoDates } from "../_lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

// Public radio station catalog for mobile + extension clients. Web RSCs call the
// service directly; this HTTP layer mirrors /api/v1/playlists. Stations are
// already ordered by the repo (isLive, isFeatured, order).
export async function GET(): Promise<Response> {
  try {
    const stations = await listStations();
    return jsonOk(stations.map(withIsoDates));
  } catch (error) {
    return jsonError(error);
  }
}
