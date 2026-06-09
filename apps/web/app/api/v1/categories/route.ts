import { listCategories } from "@repo/api/services/category";

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
    const categories = await listCategories();
    return jsonOk(categories.map(withIsoDates));
  } catch (error) {
    return jsonError(error);
  }
}
