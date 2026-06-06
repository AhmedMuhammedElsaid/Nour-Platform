export type SerializedDhikrItem = {
  ar: string;
  en?: string;
  transliteration?: string;
  repeat: number;
  virtue?: { ar?: string; en?: string };
  source?: { ar?: string; en?: string };
  audioUrl?: string; // resolved server-side from audioMediaId
};

export type SerializedAzkar = {
  id: string;
  kind: "morning" | "evening" | "other";
  locale: "ar" | "en";
  title: string; // locale-resolved
  slug: string; // locale-resolved
  items: SerializedDhikrItem[];
};
