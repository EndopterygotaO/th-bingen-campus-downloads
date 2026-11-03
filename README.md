# TH Bingen Campus finden

Local Vite/TypeScript web app and Capacitor Android app. The public ArcGIS web scene loads automatically without login or Client ID. Search and clicks highlight all scene features sharing Campus_ID; only the most recent selection remains highlighted.

## Start

With Node.js 22+ installed, install dependencies and run `npm run dev` (or `pnpm dev`). Open http://localhost:5173/. `npm run build` checks TypeScript and builds the site. `npm test` runs the room, facility and OAuth helper tests. See ANDROID.md for APK builds and installation.

## Data

The canonical room directory is `public/data/room_lookup.json`: 120 entries. Building 5 includes 68 numbered rooms/stairwells transcribed from the three supplied photographs (IMG_20261026_141359.jpg, IMG_20261026_172355.jpg, IMG_20261026_172449.jpg). Only visible room numbers were added. Unnumbered WCs and the unnumbered learning area were not assigned invented numbers. Existing research for other buildings remains in the directory; it is incomplete.

Room codes and names are aliases of the same destination, for example Bibliothek/5-201 and Empfang/5-131. Mensa/5-102 uses the user-confirmed scene ID `Gebaeude_M` even though its room number starts with 5. Other building-5 rooms use `Gebaeude_5`. Floor numbers refer to EG=0, 1.OG=1, 2.OG=2 and describe the directory only; there is no indoor navigation or floor-plan display.

`public/data/facilities.json` adds names and abbreviations such as Mensa, Kantine, Bibliothek and RZ. Sources and mapping notes are stored with entries. Original research files under ../daten/room_lookup are historical inputs, not the updated canonical directory.

## Scene

Web scene: 49e00509d7fc47368b41318bbcda89da
Scene service: https://services3.arcgis.com/NS3Rj39pJkkmPH7N/arcgis/rest/services/Campus_All_Web/SceneServer
Associated feature service: https://services3.arcgis.com/NS3Rj39pJkkmPH7N/arcgis/rest/services/Campus_All_Web/FeatureServer

Scene and services were verified anonymously on 27 October 2026. All required layers must remain publicly readable; feature editing should remain disabled. The application does not change sharing permissions. Popups are configured in code.

## Appearance and releases

Settings in the title header contain the saved light/dark/system preference and Android updater. Public source and APKs: https://github.com/EndopterygotaO/th-bingen-campus-downloads/releases/latest . The existing private repository is not made public. No signing key, password, OAuth token or GitHub credential belongs in this repository.

This is a student prototype, not an official campus or emergency navigation service. Building data attribution: GeoBasis-DE / LVermGeoRP, dl-de/by-2-0; data modified. Additional room source: https://www.deincampusplan.de/raumliste/th-bingen/ .

## Languages (0.1.4)

Saved DE/ENG/FR selection is available in Settings. Translations live in src/i18n.mjs; facility aliases and translated descriptions are in public/data/facilities.json. Language changes update the UI and ArcGIS locale without reloading the scene. IDs stay unchanged.

## Basemap toggle (0.1.5)

Bottom-right button: switch between the web scene’s saved starting basemap and World Imagery from https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer . The initial scene basemap is restored on every app start, and the toggle never changes the web scene item. No extra OAuth key is needed for this anonymous tile endpoint.

## Header and overview correction (0.1.6)

Settings is in the title header opposite Campus finden. The map/imagery button is 12px from the map bottom-right corner. Campus overview uses the Gebaeude_* feature extent, an explicit centre and a zoom fitted to view dimensions, with north-up/top-down orientation. It is independent of the saved scene camera and removes previous selection/results.

## Location and organization releases (0.1.8)

My location requests a fresh position only on tap using Capacitor Geolocation (browser Geolocation on web). A blue marker and accuracy circle show the last measured position; tap again to refresh. There is no background tracking or coordinate storage by the app. Map tile requests follow the displayed extent. Indoor accuracy depends on the device and is not room-level positioning. Android asks for coarse/fine location permission; denial leaves campus search usable. Public web hosting requires HTTPS (localhost works for development).

Updates now use EndopterygotaO/th-bingen-campus-downloads. Existing 0.1.7 installations still use the previous repository: install 0.1.8 manually once from the organization release, then subsequent updates use the new repository.
