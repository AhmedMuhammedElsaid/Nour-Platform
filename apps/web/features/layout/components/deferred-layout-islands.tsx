"use client";

// Phase 2.2 (defer the client islands): these five components are all either
// headless (write to localStorage / schedule timers / register the SW) or
// invisible until a browser event fires (InstallPrompt returns null until
// `beforeinstallprompt`; NavigationProgress returns null until a nav starts).
// None of them affect the first paint, so their code has no business sitting
// in the initial route JS graph that also has to parse+hydrate before
// PrayerTimesWidget (the real above-the-fold content) is interactive.
//
// `next/dynamic(..., { ssr: false })` code-splits each into its own chunk and
// defers fetching/hydrating it until after the initial render — but that
// option is illegal inside a Server Component (app/[locale]/layout.tsx), so
// the dynamic() calls live here, in a small "use client" wrapper the layout
// only ever references as ordinary client components. ssr:false is safe for
// all five: every one of them already renders null (or nothing meaningful)
// during SSR anyway, so disabling their server render loses no markup.
import dynamic from "next/dynamic";

export const NavigationProgress = dynamic(
  () =>
    import("./navigation-progress").then((m) => m.NavigationProgress),
  { ssr: false },
);

export const PlaybackPersistence = dynamic(
  () =>
    import("@/features/player/components/playback-persistence").then(
      (m) => m.PlaybackPersistence,
    ),
  { ssr: false },
);

// InstallPrompt is deliberately NOT deferred. Every other island here is
// self-triggered on mount, so arriving late costs nothing. InstallPrompt
// instead waits for `beforeinstallprompt`, an event the browser fires once and
// never replays — if it fires during the extra chunk fetch a lazy import adds,
// the listener is not attached yet, the event is lost, and the install
// affordance is silently dead for that visit with no error and no test signal.
// Chrome can fire it early on a repeat visit with the SW already controlling,
// so this is a real race, not a theoretical one.

export const ServiceWorkerRegister = dynamic(
  () =>
    import("@/features/pwa/components/service-worker-register").then(
      (m) => m.ServiceWorkerRegister,
    ),
  { ssr: false },
);

export const AzkarReminderController = dynamic(
  () =>
    import("@/features/prayer-times/components/azkar-reminder-controller").then(
      (m) => m.AzkarReminderController,
    ),
  { ssr: false },
);
