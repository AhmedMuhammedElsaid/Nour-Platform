// Lean Mongo docs sometimes serialize Dates to strings before reaching here
// (depending on the read path); guard so both shapes pass through as ISO.
function toIso(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

export function withIsoDates<T extends { createdAt: Date | string; updatedAt: Date | string }>(
  doc: T,
): Omit<T, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string } {
  return { ...doc, createdAt: toIso(doc.createdAt), updatedAt: toIso(doc.updatedAt) };
}
