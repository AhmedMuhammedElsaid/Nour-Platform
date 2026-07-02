import { getStationBySlug } from "@repo/api/services/radio";

import { corsPreflight } from "@/lib/cors";
import { jsonOk, jsonError } from "../../_lib/respond";
import { withIsoDates } from "../../_lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

// Single station lookup. getStationBySlug throws NotFound for missing or
// disabled (!isLive) stations, which jsonError maps to 404.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await params;
    const station = await getStationBySlug(slug);
    return jsonOk(withIsoDates(station));
  } catch (error) {
    return jsonError(error);
  }
}
