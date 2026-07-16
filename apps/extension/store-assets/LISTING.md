# Chrome Web Store submission collateral — Nour v1.0.0

> Copy-paste source for the devconsole fields (runbook: `apps/mobile/publish_play_store.md` Parts E–F).
> Assets in this folder: `icon-128.png` (store icon, generated from `public/icons/icon-512.png`); `screenshot-1.png`–`screenshot-4.png` (1280×800, captured via `make-screenshot.ps1`).
> Still optional: a promo tile (440×280).

---

## E3 — Single purpose (one sentence)

> Desktop azan reminders, prayer times, and Islamic audio (Quran, adhkar, lectures) from the Nour platform.

## E3 — Permission justifications

| Permission | Justification (paste as-is) |
|---|---|
| `alarms` | Schedules the trigger for the next prayer's azan notification and audio, so reminders fire on time without any page being open. |
| `notifications` | Shows the azan/prayer-time notification when a prayer time arrives, and the adhkar reminder notification. |
| `offscreen` | MV3 service workers cannot hold an `<audio>` element; the offscreen document is the only way to play the azan and Quran/lecture audio in the background. |
| `storage` | Persists the user's settings on-device: location, calculation method, per-prayer toggles, volume, and audio player state. No data leaves the device. |
| `geolocation` | Detects the user's position once on first open (and when the user presses "use my location") so prayer times are correct immediately; the coordinates are mapped to the nearest city, stored locally in `browser.storage`, and never transmitted. |
| Host permission `https://nour-platform-web.vercel.app/*` | Fetches the extension's own content from the Nour platform API: playlists/lectures, Quran surah and reciter lists, adhkar collections, and search. It is the publisher's own first-party backend; no other hosts are accessed. |

## E3 — Data usage disclosure

- Collects **no** personal or sensitive user data. No accounts, no analytics, no cookies.
- Location: the user picks a city (or uses one-time geolocation) solely to compute prayer times; it is stored **locally** in `browser.storage` and never transmitted.
- Certify: does **not** sell data, does **not** transfer data to third parties, does **not** use data for creditworthiness/lending.
- Privacy policy URL: `https://nour-platform-web.vercel.app/privacy`

---

## E4 — Store listing

- **Name** (from manifest): `Nour — نور`
- **Category**: Lifestyle
- **Primary language**: Arabic (add English as additional description)

### Summary — EN (≤132 chars)

> Azan reminders, prayer times, Quran, adhkar & Islamic audio — a serene new tab and reliable desktop azan, all data on-device.

### Summary — AR (≤132 chars)

> مواقيت الصلاة وتنبيه الأذان والقرآن والأذكار والدروس الصوتية — صفحة تبويب جديدة هادئة وأذان موثوق على سطح المكتب.

### Detailed description — EN

Nour brings the essentials of your day as a Muslim to the browser you already have open.

**Reliable desktop azan** — the extension computes prayer times on your device and fires an azan notification with full adhan audio at each prayer, even when no website is open. Per-prayer toggles, volume control, and a choice of calculation methods (Egyptian, Umm al-Qura, MWL, and more) with Hanafi/standard asr.

**A serene new tab** — every new tab shows a live countdown to the coming prayer over a sun-arc that follows the real position of the day, today's timetable, a daily dhikr, and your audio library with a "continue listening" shelf.

**Listen while you browse** — Quran recitations, adhkar, and lectures keep playing as you move between tabs, with media-key and lock-screen controls, position memory, and a queue.

**Quran & adhkar** — browse surahs and reciters, read morning/evening adhkar with a tap counter, and search the whole library in Arabic or English.

**Private by design** — no account, no analytics, nothing leaves your device. Your location (a city you pick) is stored locally and used only to compute prayer times. Fully bilingual Arabic/English with proper RTL.

### Detailed description — AR

نور يجمع لك أساسيات يومك كمسلم داخل المتصفح الذي تستخدمه بالفعل.

**أذان موثوق على سطح المكتب** — يحسب الامتداد مواقيت الصلاة على جهازك ويطلق إشعار الأذان مع الصوت الكامل عند كل صلاة، حتى بدون فتح أي موقع. مفاتيح تشغيل لكل صلاة على حدة، وتحكم في مستوى الصوت، واختيار طريقة الحساب (الهيئة المصرية، أم القرى، رابطة العالم الإسلامي وغيرها) مع مذهب حنفي أو الجمهور للعصر.

**صفحة تبويب هادئة** — كل تبويب جديد يعرض عدًّا تنازليًا حيًّا للصلاة القادمة فوق قوس الشمس الذي يتبع موضع النهار الحقيقي، وجدول مواقيت اليوم، وذِكر اليوم، ومكتبتك الصوتية مع رف «متابعة الاستماع».

**استمع أثناء التصفح** — تلاوات القرآن والأذكار والدروس تستمر أثناء تنقلك بين التبويبات، مع أزرار الوسائط وحفظ موضع التشغيل وقائمة تشغيل.

**القرآن والأذكار** — تصفح السور والقرّاء، واقرأ أذكار الصباح والمساء مع عدّاد باللمس، وابحث في المكتبة كاملة بالعربية أو الإنجليزية.

**خصوصية بالتصميم** — بدون حساب، بدون تتبع أو تحليلات، لا شيء يغادر جهازك. موقعك (مدينة تختارها) يُخزَّن محليًا ويُستخدم فقط لحساب المواقيت. ثنائي اللغة بالكامل عربي/إنجليزي مع دعم كامل للكتابة من اليمين لليسار.

---

## E5 — Distribution

- Visibility: **Public** (or Unlisted for a soft launch first).
- Regions: all.
- Expect a few days' review; the host-permission justification above is the usual hold-up — it names the first-party API and the exact resources fetched, which is what reviewers look for.

## Part F — Firefox AMO (optional, free)

- Upload `nour-extension-firefox-v1.0.0.zip` at addons.mozilla.org/developers.
- Reuse the same summary/description copy above. AMO signs the package and assigns an `id` if `browser_specific_settings.gecko.id` isn't set.
