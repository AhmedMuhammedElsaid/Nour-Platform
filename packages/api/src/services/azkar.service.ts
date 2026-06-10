import { requireSession } from "../auth/require-session";
import { ADHKAR, azkarTag } from "../cache/tags";
import { invalidate } from "../cache/invalidate";
import {
  createAzkar as repoCreate,
  deleteAzkarById as repoDelete,
  findAllAzkar,
  findAzkarById as repoFindById,
  findAzkarBySlug,
  findPublishedAzkar,
  updateAzkarById as repoUpdate,
  updateAzkarOrder,
  type AzkarLean,
} from "../repositories/azkar.repo";
import { AzkarModel } from "../db/models/azkar.model";
import { AppError } from "../errors";
import type { Locale } from "../schemas/locale";
import { z } from "zod";
import {
  azkarCreateInputSchema,
  azkarUpdateInputSchema,
  type Azkar,
  type AzkarUpdateInput,
  type DhikrItem,
} from "../schemas/azkar";
import { slugify } from "../utils/slug";
import type { Session } from "next-auth";

/*
 * Azkar service — single chokepoint for Azkar CRUD.
 * - Public reads (no session): getPublishedAzkar, getAzkarBySlug.
 * - Admin reads accept a pre-resolved session and check role directly
 *   (mirrors playlist.service pattern: avoids a second round-trip when
 *   the RSC already holds the session object).
 * - Admin mutations call requireSession(['admin']) FIRST (before any I/O),
 *   then Zod-parse input, then repo, then revalidateTag.
 * Services return plain DTOs; Mongoose documents never escape this layer.
 */

// ---------------------------------------------------------------------------
// DTO mapper helpers
// ---------------------------------------------------------------------------

// Converts a lean Mongo dhikr subdocument to the public-facing DhikrItem DTO.
// The `as unknown as { ... }` casts are adapter-boundary casts: InferSchemaType
// makes nested subdocument fields opaque Mongoose types; we know the runtime
// shape matches the Zod schema, so the casts are safe here.
function itemToDto(item: AzkarLean["items"][number]): DhikrItem {
  const i = item as unknown as {
    ar: string;
    en?: string | null;
    transliteration?: string | null;
    repeat: number;
    virtue?: { ar?: string | null; en?: string | null } | null;
    source?: { ar?: string | null; en?: string | null } | null;
    audioMediaId?: { toString(): string } | null;
  };
  return {
    ar: i.ar,
    repeat: i.repeat,
    ...(i.en != null ? { en: i.en } : {}),
    ...(i.transliteration != null ? { transliteration: i.transliteration } : {}),
    ...(i.virtue != null && (i.virtue.ar != null || i.virtue.en != null)
      ? {
          virtue: {
            ...(i.virtue.ar != null ? { ar: i.virtue.ar } : {}),
            ...(i.virtue.en != null ? { en: i.virtue.en } : {}),
          },
        }
      : {}),
    ...(i.source != null && (i.source.ar != null || i.source.en != null)
      ? {
          source: {
            ...(i.source.ar != null ? { ar: i.source.ar } : {}),
            ...(i.source.en != null ? { en: i.source.en } : {}),
          },
        }
      : {}),
    ...(i.audioMediaId != null ? { audioMediaId: i.audioMediaId.toString() } : {}),
  };
}

// Converts a lean Mongo Azkar doc to the public-facing Azkar DTO.
function toDto(doc: AzkarLean): Azkar {
  // Adapter-boundary casts: InferSchemaType opacifies nested subdocument fields;
  // the runtime shape is guaranteed by the Mongoose schema definition.
  const ar = doc.ar as unknown as { title: string; slug: string };
  const en = doc.en as unknown as { title: string; slug: string };
  return {
    id: doc._id.toString(),
    kind: doc.kind as Azkar["kind"],
    status: doc.status as Azkar["status"],
    order: doc.order,
    ar: { title: ar.title, slug: ar.slug },
    en: { title: en.title, slug: en.slug },
    items: (doc.items ?? []).map(itemToDto),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  };
}

// ---------------------------------------------------------------------------
// Public reads (no session required)
// ---------------------------------------------------------------------------

export async function getPublishedAzkar(): Promise<Azkar[]> {
  const docs = await findPublishedAzkar();
  return docs.map(toDto);
}

export async function getAzkarBySlug(locale: Locale, slug: string): Promise<Azkar> {
  const doc = await findAzkarBySlug(locale, slug);
  if (!doc) throw AppError.NotFound("Azkar");
  return toDto(doc);
}

// ---------------------------------------------------------------------------
// Admin reads (pre-resolved session, no extra round-trip)
// ---------------------------------------------------------------------------

export async function getAllAzkar(
  session: Session & { user: NonNullable<Session["user"]> },
): Promise<Azkar[]> {
  // Validate admin role using the already-fetched session to avoid a second
  // round-trip, mirroring getAllPlaylists in playlist.service.ts.
  if (session.user.role !== "admin") throw AppError.Forbidden(["admin"]);
  const docs = await findAllAzkar();
  return docs.map(toDto);
}

export async function getAzkarById(
  id: string,
  session: Session & { user: NonNullable<Session["user"]> },
): Promise<Azkar | null> {
  if (session.user.role !== "admin") throw AppError.Forbidden(["admin"]);
  const doc = await repoFindById(id);
  return doc ? toDto(doc) : null;
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

// Use z.input<> (the "before-defaults" type) so callers need not supply `status`
// when the schema provides `.default("draft")` — mirrors how Zod processes inputs.
export async function createAzkar(input: z.input<typeof azkarCreateInputSchema>): Promise<Azkar> {
  // Auth check first — no I/O before verifying identity.
  await requireSession(["admin"]);

  // Zod parse throws ZodError on bad input (CLAUDE.md §4).
  const parsed = azkarCreateInputSchema.parse(input);

  // Auto-generate slugs from titles when the caller omits them.
  const arBase = parsed.ar.slug ?? slugify(parsed.ar.title);
  const enBase = parsed.en.slug ?? slugify(parsed.en.title);

  // Append-to-end default: count existing docs for a simple ordering baseline.
  const order = parsed.order ?? (await AzkarModel.countDocuments());

  /*
   * Slug collision handling: try base slugs first, then append a numeric
   * suffix (-2, -3, …) on Mongo unique-constraint violations (code 11000).
   * Bounded at 10 attempts — same pattern as createCategory.
   */
  let lean: AzkarLean | undefined;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const arSlug = attempt === 0 ? arBase : `${arBase}-${attempt + 1}`;
    const enSlug = attempt === 0 ? enBase : `${enBase}-${attempt + 1}`;
    try {
      lean = await repoCreate({
        kind: parsed.kind,
        status: parsed.status,
        order,
        ar: { title: parsed.ar.title, slug: arSlug },
        en: { title: parsed.en.title, slug: enSlug },
        items: parsed.items,
      });
      break;
    } catch (err: unknown) {
      // MongoDB duplicate-key error code.
      const isDuplicate =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: unknown }).code === 11000;

      if (!isDuplicate) throw AppError.Internal("Failed to create azkar.", err);
      attempt++;
    }
  }

  if (!lean) {
    throw AppError.Conflict(
      `Could not create azkar: slug "${arBase}" is taken up to suffix -${maxAttempts + 1}.`,
    );
  }

  // No revalidateTag here: new azkar default to status="draft" and are invisible
  // on the public landing/reading pages, so no cached entry needs invalidating.
  // The first publish (publishAzkar) emits the ADHKAR tag.
  return toDto(lean);
}

export async function updateAzkar(
  id: string,
  input: AzkarUpdateInput,
): Promise<Azkar> {
  await requireSession(["admin"]);
  const parsed = azkarUpdateInputSchema.parse(input);
  const lean = await repoUpdate(id, parsed);
  if (!lean) throw AppError.NotFound("Azkar");
  await invalidate([ADHKAR, azkarTag(lean._id.toString())]);
  return toDto(lean);
}

export async function deleteAzkar(id: string): Promise<void> {
  await requireSession(["admin"]);
  // Fetch before delete so we have the id for cache invalidation.
  const existing = await repoFindById(id);
  if (!existing) throw AppError.NotFound("Azkar");
  await repoDelete(id);
  await invalidate([ADHKAR, azkarTag(id)]);
}

export async function publishAzkar(id: string): Promise<Azkar> {
  await requireSession(["admin"]);
  const lean = await repoUpdate(id, { status: "published" });
  if (!lean) throw AppError.NotFound("Azkar");
  await invalidate([ADHKAR, azkarTag(lean._id.toString())]);
  return toDto(lean);
}

export async function unpublishAzkar(id: string): Promise<Azkar> {
  await requireSession(["admin"]);
  const lean = await repoUpdate(id, { status: "draft" });
  if (!lean) throw AppError.NotFound("Azkar");
  await invalidate([ADHKAR, azkarTag(lean._id.toString())]);
  return toDto(lean);
}

export async function reorderAzkar(orderedIds: string[]): Promise<void> {
  await requireSession(["admin"]);
  await updateAzkarOrder(orderedIds);
  await invalidate([ADHKAR]);
}
