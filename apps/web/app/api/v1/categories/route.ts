import { getCachedCategories } from "@/lib/cached-content";

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
    const categories = await getCachedCategories();
    return jsonOk(categories.map(withIsoDates));
  } catch (error) {
    return jsonError(error);
  }
}
