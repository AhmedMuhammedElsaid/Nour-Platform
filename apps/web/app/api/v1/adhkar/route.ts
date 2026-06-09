import { getPublishedAzkar } from "@repo/api/services/azkar";

import { corsPreflight } from "@/lib/cors";
import { jsonOk, jsonError } from "../_lib/respond";
import { withIsoDates } from "../_lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

export async function GET(): Promise<Response> {
  try {
    const azkar = await getPublishedAzkar();
    return jsonOk(azkar.map(withIsoDates));
  } catch (error) {
    return jsonError(error);
  }
}
