// Settings surface. Location picker, calculation method/madhab, per-prayer azan
// toggles, volume, and azkar reminders are wired in the next step; this scaffold
// proves the React + Tailwind toolchain builds end-to-end.
export function OptionsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-xl font-bold">إعدادات نور</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Prayer location, calculation method, and azan settings will live here.
      </p>
    </main>
  );
}
