"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

type SortValue = "newest" | "az" | "tracks";

interface PlaylistSortSelectProps {
  currentSort?: string;
}

export function PlaylistSortSelect({ currentSort }: PlaylistSortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("home");

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value as SortValue;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  const value = currentSort === "az" || currentSort === "tracks" ? currentSort : "newest";

  return (
    <select
      value={value}
      onChange={handleChange}
      aria-label={t("library")}
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="newest">{t("sortNewest")}</option>
      <option value="az">{t("sortAZ")}</option>
      <option value="tracks">{t("sortTracks")}</option>
    </select>
  );
}
