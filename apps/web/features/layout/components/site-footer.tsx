import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="border-t border-border py-6 text-sm text-text-2">
      <p className="text-center">{t("copyright")}</p>
    </footer>
  );
}
