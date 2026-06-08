import { listEditions } from "@repo/api/services/quran";

import { corsPreflight } from "@/lib/cors";
import { jsonOk, jsonError } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

export async function GET(): Promise<Response> {
  try {
    return jsonOk(await listEditions());
  } catch (error) {
    return jsonError(error);
  }
}
