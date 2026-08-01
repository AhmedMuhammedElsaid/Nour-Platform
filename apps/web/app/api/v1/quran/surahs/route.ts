import { listSurahs } from "@repo/api/services/quran";

import { corsPreflight } from "@/lib/cors";
import { apiRoute, jsonOk, jsonError } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

export const GET = apiRoute("static", async (): Promise<Response> => {
  try {
    return jsonOk(await listSurahs());
  } catch (error) {
    return jsonError(error);
  }
});
