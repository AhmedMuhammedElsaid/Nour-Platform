"use server";

import { AppError } from "@repo/api/errors";
import { updateAzkar } from "@repo/api/services/azkar";

import {
  azkarFormSchema,
  type AzkarFormValues,
} from "../schemas/azkar-form.schema";

type Result = { error: string } | undefined;

function mapItems(values: AzkarFormValues) {
  return values.items.map((it) => ({
    ar: it.ar,
    repeat: it.repeat,
    ...(it.en ? { en: it.en } : {}),
    ...(it.transliteration ? { transliteration: it.transliteration } : {}),
    ...(it.virtue.ar || it.virtue.en
      ? {
          virtue: {
            ...(it.virtue.ar ? { ar: it.virtue.ar } : {}),
            ...(it.virtue.en ? { en: it.virtue.en } : {}),
          },
        }
      : {}),
    ...(it.source.ar || it.source.en
      ? {
          source: {
            ...(it.source.ar ? { ar: it.source.ar } : {}),
            ...(it.source.en ? { en: it.source.en } : {}),
          },
        }
      : {}),
    ...(it.audioMediaId ? { audioMediaId: it.audioMediaId } : {}),
  }));
}

export async function updateAzkarAction(
  id: string,
  input: AzkarFormValues,
): Promise<Result> {
  const parsed = azkarFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    await updateAzkar(id, {
      kind: parsed.data.kind,
      status: parsed.data.status,
      ar: { title: parsed.data.ar.title },
      en: { title: parsed.data.en.title },
      items: mapItems(parsed.data),
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}
