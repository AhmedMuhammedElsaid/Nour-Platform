import { ADHAN_PRAYER_KEYS, CALCULATION_METHOD_IDS } from "@repo/shared-core/schemas/prayer-times";
import type { AdhanPrayerKey, CalculationMethodId, MadhabId } from "@repo/shared-core/schemas/prayer-times";

import { BrandedFooter } from "../components/branded-footer";
import { LocationPicker } from "./location-picker";
import {
  useAdhanSettings,
  useAzkarSettings,
  useKahfSettings,
  useLocation,
  usePrefs,
} from "./use-settings";

const PRAYER_LABELS: Record<AdhanPrayerKey, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

const METHOD_LABELS: Record<CalculationMethodId, string> = {
  MuslimWorldLeague: "Muslim World League",
  Egyptian: "Egyptian General Authority",
  Karachi: "University of Islamic Sciences, Karachi",
  UmmAlQura: "Umm al-Qura, Makkah",
  Dubai: "Dubai",
  MoonsightingCommittee: "Moonsighting Committee",
  NorthAmerica: "Islamic Society of North America",
  Kuwait: "Kuwait",
  Qatar: "Qatar",
  Singapore: "Singapore",
  Turkey: "Turkey",
  Tehran: "Tehran",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function OptionsPage() {
  const { location, setLocation } = useLocation();
  const { prefs, setPrefs } = usePrefs();
  const { adhan, setAdhan } = useAdhanSettings();
  const { azkar, setAzkar } = useAzkarSettings();
  const { kahf, setKahf } = useKahfSettings();

  // Loading state: all keys must be hydrated before rendering controls.
  if (!location || !prefs || !adhan || !azkar || !kahf) {
    return (
      <main className="min-h-screen bg-bg p-6 text-text">
        <p className="text-sm text-text-2">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg p-6 text-text">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-primary">نور</h1>
        <p className="mt-0.5 text-sm text-text-2">Extension settings</p>
      </header>

      <div className="mx-auto max-w-md space-y-8">

        {/* ── Location ────────────────────────────────────────────────── */}
        <Section title="Prayer location">
          <LocationPicker
            current={location}
            onSelect={(loc) => void setLocation(loc)}
          />
        </Section>

        {/* ── Calculation method ───────────────────────────────────────── */}
        <Section title="Calculation method">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
              Method
            </span>
            <select
              value={prefs.method}
              onChange={(e) =>
                void setPrefs({ ...prefs, method: e.target.value as CalculationMethodId })
              }
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CALCULATION_METHOD_IDS.map((id) => (
                <option key={id} value={id}>
                  {METHOD_LABELS[id]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.06em] text-text-2">
              Asr madhab
            </span>
            <select
              value={prefs.madhab}
              onChange={(e) =>
                void setPrefs({ ...prefs, madhab: e.target.value as MadhabId })
              }
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="standard">Standard (Shafi, Maliki, Hanbali)</option>
              <option value="hanafi">Hanafi</option>
            </select>
          </label>
        </Section>

        {/* ── Adhan ────────────────────────────────────────────────────── */}
        <Section title="Azan (adhan)">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-text">Enable azan notifications</span>
            <input
              type="checkbox"
              checked={adhan.enabled}
              onChange={(e) => void setAdhan({ ...adhan, enabled: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
          </label>

          {adhan.enabled && (
            <>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs uppercase tracking-[0.06em] text-text-2">
                  Per prayer
                </legend>
                {ADHAN_PRAYER_KEYS.map((key) => (
                  <label key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-text">{PRAYER_LABELS[key]}</span>
                    <input
                      type="checkbox"
                      checked={adhan.perPrayer[key]}
                      onChange={(e) =>
                        void setAdhan({
                          ...adhan,
                          perPrayer: { ...adhan.perPrayer, [key]: e.target.checked },
                        })
                      }
                      className="size-4 accent-[var(--color-primary)]"
                    />
                  </label>
                ))}
              </fieldset>

              <label className="block">
                <span className="mb-1.5 flex justify-between text-xs uppercase tracking-[0.06em] text-text-2">
                  <span>Volume</span>
                  <span>{Math.round(adhan.volume * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={adhan.volume}
                  onChange={(e) =>
                    void setAdhan({ ...adhan, volume: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--color-primary)]"
                />
              </label>
            </>
          )}
        </Section>

        {/* ── Azkar reminders ──────────────────────────────────────────── */}
        <Section title="Adhkar reminders">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-text">
              Morning &amp; evening adhkar reminders
            </span>
            <input
              type="checkbox"
              checked={azkar.enabled}
              onChange={(e) => void setAzkar({ ...azkar, enabled: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
          </label>

          {azkar.enabled && (
            <>
              <p className="text-xs text-text-2">
                Sabah reminder after Fajr · Masaa reminder after Asr.
              </p>
              <label className="block">
                <span className="mb-1.5 flex justify-between text-xs uppercase tracking-[0.06em] text-text-2">
                  <span>Delay after base prayer</span>
                  <span>{azkar.offsetMinutes} min</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={5}
                  value={azkar.offsetMinutes}
                  onChange={(e) =>
                    void setAzkar({ ...azkar, offsetMinutes: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--color-primary)]"
                />
              </label>
            </>
          )}
        </Section>

        {/* ── Friday Surah Al-Kahf ─────────────────────────────────────── */}
        <Section title="Friday Surah Al-Kahf">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-text">
              Reminder every Friday at 12:00 PM
            </span>
            <input
              type="checkbox"
              checked={kahf.enabled}
              onChange={(e) => void setKahf({ enabled: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
          </label>
          {kahf.enabled && (
            <p className="text-xs text-text-2">
              A notification and a home-page card open the Quran reader at Surah
              Al-Kahf.
            </p>
          )}
        </Section>

      </div>

      <BrandedFooter />
    </main>
  );
}
