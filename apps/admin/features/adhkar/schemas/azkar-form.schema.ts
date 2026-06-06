import { z } from "zod";

const localePair = z.object({ ar: z.string().max(2000), en: z.string().max(2000) });

export const dhikrItemFormSchema = z.object({
  id: z.string().min(1),
  ar: z.string().min(1, "Arabic text is required").max(4000),
  en: z.string().max(4000),
  transliteration: z.string().max(4000),
  repeat: z.coerce.number().int().min(1).max(1000),
  virtue: localePair,
  source: localePair,
  audioMediaId: z.string().regex(/^[0-9a-f]{24}$/).optional().or(z.literal("")),
});
export type DhikrItemFormValues = z.infer<typeof dhikrItemFormSchema>;

export const azkarFormSchema = z.object({
  kind: z.enum(["morning", "evening", "other"]),
  status: z.enum(["draft", "published"]),
  ar: z.object({ title: z.string().min(1).max(200) }),
  en: z.object({ title: z.string().min(1).max(200) }),
  items: z.array(dhikrItemFormSchema).min(1, "At least one dhikr is required"),
});
export type AzkarFormValues = z.infer<typeof azkarFormSchema>;

export function createEmptyDhikrItem(): DhikrItemFormValues {
  return {
    id: crypto.randomUUID(),
    ar: "",
    en: "",
    transliteration: "",
    repeat: 1,
    virtue: { ar: "", en: "" },
    source: { ar: "", en: "" },
    audioMediaId: "",
  };
}
