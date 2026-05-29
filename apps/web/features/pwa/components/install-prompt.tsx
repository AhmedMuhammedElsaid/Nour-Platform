"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@repo/ui/primitives/button";

const DISMISS_KEY = "nour.pwa.install-dismissed";

// Not in the TS DOM lib yet — describe the shape we use (adapter boundary).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Captures the browser's install event and offers a dismissible "Install"
// affordance. Sits above the player bar; remembers dismissal device-locally.
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage unavailable — still allow the prompt */
    }
    const onBeforeInstall = (event: Event): void => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!deferred) return null;

  const handleInstall = async (): Promise<void> => {
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
  };

  const handleDismiss = (): void => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* non-fatal */
    }
    setDeferred(null);
  };

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-24 z-30 mx-auto w-[min(92%,28rem)] rounded-lg border border-border bg-surface p-4 shadow-up-2"
    >
      <p className="text-sm font-medium text-foreground">{t("title")}</p>
      <p className="mt-1 text-xs text-text-2">{t("description")}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          {t("dismiss")}
        </Button>
        <Button variant="default" size="sm" onClick={handleInstall}>
          {t("install")}
        </Button>
      </div>
    </div>
  );
}
