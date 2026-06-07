"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@repo/ui/primitives/sheet";

interface TafsirEdition {
  slug: string;
  name: string;
  dir: "rtl" | "ltr";
}
interface TafsirData {
  edition: TafsirEdition;
  html: string;
}

export interface TafsirSheetProps {
  ayah: { numberGlobal: number; ref: string } | null; // ref = "surah:ayah"
  locale: string;
  onClose: () => void;
}

export function TafsirSheet({ ayah, locale, onClose }: TafsirSheetProps) {
  const [data, setData] = useState<TafsirData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!ayah) return;
    let cancelled = false;
    setStatus("loading");
    setData(null);
    fetch(`/api/quran/tafsir?ayah=${ayah.numberGlobal}&locale=${locale}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<TafsirData>;
      })
      .then((j) => {
        if (!cancelled) {
          setData(j);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ayah, locale]);

  const open = ayah !== null;
  return (
    <Sheet
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="bottom" aria-label="Tafsir" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Tafsir{ayah ? ` · ${ayah.ref}` : ""}
            {data ? ` · ${data.edition.name}` : ""}
          </SheetTitle>
          <SheetDescription className="sr-only">Ayah commentary</SheetDescription>
        </SheetHeader>
        <div className="px-2 py-3">
          {status === "loading" ? (
            <p className="text-text-2 text-sm">Loading…</p>
          ) : status === "error" ? (
            <p data-testid="tafsir-error" className="text-text-2 text-sm">
              Tafsir unavailable for this ayah.
            </p>
          ) : data ? (
            <div
              dir={data.edition.dir}
              className="text-text leading-relaxed [&_*]:max-w-full"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
