# Campus finden – Android

Version 0.1.8 starts the public ArcGIS campus scene automatically. No Esri login, OAuth Client ID or embedded access token is required. Internet is required for the map and updates; the bundled room directory is local.

Install the APK from https://github.com/EndopterygotaO/th-bingen-campus-downloads/releases/latest . Install over the previous version without uninstalling to preserve preferences. Package: de.thbingen.campus, versionCode 9. The same development signing key is used as in earlier test APKs.

In the top-right settings menu select System, Light or Dark appearance. The choice is saved locally.

## Updates

Select Settings → Update suchen. If a newer stable release exists, select Download and install. Keep the app open while downloading. At first use Android may ask you to allow installations from Campus finden; return to the app and select Installation fortsetzen. Android always requires the final installation confirmation.

The native updater only uses the fixed public APK repository. It accepts HTTPS from GitHub's API/download hosts, checks the release asset name and size (maximum 100 MiB), SHA-256 digest, package name, version code and the installed app's signing certificate. No GitHub access token is embedded. An already verified download is reused when returning from Android's permission settings. Browser builds open the public releases page instead.

This directly distributed development APK requests INTERNET and REQUEST_INSTALL_PACKAGES. A future Play Store build should use the Play update mechanism instead of this installer.

## Build

Requires Node 22+, Java 21, Android Platform 36 and SDK Build Tools. The script prefers the installed portable Java 21 toolchain over newer Android Studio runtimes.

```powershell
node --test tests/*.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1
```

Output: releases/Campus-finden-0.1.8-debug.apk. Preserve the signing key outside version control for compatible updates.

## Validation

16 tests pass, including building-5 floor-plan transcription and named/numbered aliases. Anonymous scene rendering, Mensa selection, dark appearance and settings were checked in the web preview. APK content, version and signature are checked locally. The native installation/permission flow still needs a physical Android device test.

## Languages

Settings → Language offers DE (German), ENG (English) and FR (French). Selection is stored in localStorage and applied without restarting the map. UI, search feedback, facility descriptions and ArcGIS controls use the selected language. German labels and room IDs remain searchable; English/French facility aliases and room/building prefixes are accepted. Building IDs are never translated. Low-level Android/SDK diagnostic details can retain their original language.

## Imagery toggle (0.1.5)

A button at the map bottom-right switches between the exact basemap saved in the public web scene and anonymous Esri World Imagery. On start, the saved scene basemap is used (Topografisch, verified on 27 October 2026). The imagery choice is not persisted. Switching does not save anything to ArcGIS Online or change building IDs, geometry, highlights, terrain or the camera. The button is disabled while loading; errors keep/restore the prior basemap and allow retry. Labels are available in DE/ENG/FR.

## Header and campus overview (0.1.6)

Settings is in the Campus finden header. The basemap button is 12px from the map bottom-right corner, with status text constrained to leave it clear. Campus overview queries all Gebaeude_* features and frames their extent with north-up, top-down orientation. It no longer depends on the saved scene camera or a viewpoint captured at startup. Pending older selections cannot override a newer navigation action.

## Tighter overview (0.1.8)

Removed the minimum 1:4000 overview scale. The overview accounts for Web Mercator latitude distortion and fits the campus extent with a 25% framing margin, targeting approximately 80% use of the limiting map dimension. The north-up campus centre and selected basemap are preserved.

Overview waits for the map resize after dismissing search results before calculating scale, so initial and repeated overview actions use the same framing.

## Location

The optional My location button requests Android location permission on demand. Location is a one-shot measurement with an accuracy circle; tap again to refresh. No background location permission is requested. GPS/permission flow must still be checked on a physical device. Update source is the public organization repository EndopterygotaO/th-bingen-campus-downloads.
