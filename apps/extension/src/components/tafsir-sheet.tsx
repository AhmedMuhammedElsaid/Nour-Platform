import { useEffect, useState } from "react";

import { fetchTafsir, type TafsirData } from "../lib/content";
import { useI18n } from "../lib/i18n";
import { Sheet } from "./ui/sheet";

type Props = {
  ayah: { numberGlobal: number; ref: string } | null;
  onClose: () => void;
};

export function TafsirSheet({ ayah, onClose }: Props) {
  const { t } = useI18n();
  const [data, setData] = useState<TafsirData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!ayah) return;
    let cancelled = false;
    setStatus("loading");
    setData(null);
    void fetchTafsir(ayah.numberGlobal)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ayah]);

  return (
    <Sheet
      open={ayah !== null}
      onClose={onClose}
      title={`${t("quran.tafsir")}${ayah ? ` · ${ayah.ref}` : ""}`}
    >
      {status === "loading" ? (
        <p className="text-sm text-text-2">{t("common.loading")}</p>
      ) : status === "error" ? (
        <p className="text-sm text-text-2">{t("quran.tafsirUnavailable")}</p>
      ) : data ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">{data.editionName}</p>
          <div
            dir={data.dir}
            className="text-sm leading-relaxed text-text [&_*]:max-w-full"
            // Tafsir HTML is server-trusted (seeded from quran.com) and the route
            // strips <script> before sending it.
            dangerouslySetInnerHTML={{ __html: data.html }}
          />
        </div>
      ) : null}
    </Sheet>
  );
}
