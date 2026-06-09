import { useTranslation } from "react-i18next";
import { Stack } from "expo-router";

import { DownloadsList } from "@/features/downloads/components/downloads-list";
import { useDownloads } from "@/features/downloads/hooks/use-downloads";

export default function DownloadsScreen() {
  const { t } = useTranslation();
  const downloads = useDownloads();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("downloads.heading") }} />
      <DownloadsList downloads={downloads} />
    </>
  );
}
