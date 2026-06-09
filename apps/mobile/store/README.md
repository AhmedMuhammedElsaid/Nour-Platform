# Google Play Store Submission

This folder contains the assets and metadata needed to submit Nour to Google Play.

## Files

- **listing.md** — App name, descriptions, category, privacy policy URL, contact email
- **screenshots/** — Phone screenshots (minimum 2, maximum 8) in 1280×720 portrait
- **feature-graphic.png** — 1024×500 banner for store listing
- **icon-512.png** — 512×512 app icon for store

## Before submitting

1. **Update `app.json`** with correct `android.versionCode` and app `version` (semver)
2. **Privacy policy** — Ensure the URL in `listing.md` is live and covers:
   - Location data (prayer times)
   - Notification permissions
   - On-device storage only (no cloud sync)
   - No data sharing/selling
3. **Create Google Play Developer account** ($25 USD, 1–2 days for identity verification)
4. **Generate signing key** — On first `eas build`, EAS will prompt you to create an upload keystore. **Never commit it to git.**

## Submission flow

1. Run from `apps/mobile`:
   ```bash
   eas build -p android --profile production
   ```
   This creates a signed AAB (Android App Bundle).

2. In **Google Play Console**:
   - Create a new app (com.nour.mobile)
   - Fill out store listing (use `listing.md` as reference)
   - Complete Data safety (location = precise, on-device, not sold)
   - Assign content rating (IARC, general audience)
   - Upload AAB to **Internal testing** release

3. Test on a physical Android device:
   - Share internal-testing opt-in link with testers
   - Verify app installs and runs (audio plays, prayer times load, offline mode works)

4. Promote to **Closed testing** (optional, for staged user acceptance)

5. Promote to **Production** — submit for Google review (1–3 days)

## Environment variables for EAS submit

If using `eas submit -p android --profile production`:

```bash
export GOOGLE_PLAY_KEYFILE_PATH=./google-play-key.json  # Service account JSON from Google Play Console
```

## Notes

- **Adaptive icon**: Already configured in `app.json` (foreground, background, monochrome)
- **Minimum SDK**: 24 (Android 7.0)
- **Target SDK**: Latest Play requires (configured in `app.json`)
- **Permissions**: Defined in `app.json` plugins (location, notifications); request at runtime in the app
