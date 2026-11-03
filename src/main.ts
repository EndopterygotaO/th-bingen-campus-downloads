import { t, getLanguage, localizeText, applyLanguage, setLanguage } from './i18n.mjs';
import '@arcgis/core/assets/esri/themes/light/main.css';
import './style.css';
import type { Room, CampusMap, Facility } from './types';
import { initSettings } from './settings';
import { buildingId, findRooms, suggestions, findFacilities } from './search.mjs';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = element<HTMLFormElement>('search-form');
const searchInput = element<HTMLInputElement>('search');
const searchStatus = element<HTMLDivElement>('search-status');
const results = element<HTMLDivElement>('results');
const mapStatus = element<HTMLDivElement>('map-status');
const access = element<HTMLElement>('access-panel');
const publicButton = element<HTMLButtonElement>('public-load');
const basemapButton = element<HTMLButtonElement>('basemap-toggle');
let imageryEnabled = false;
let basemapBusy = false;
function refreshBasemapButton() {
  basemapButton.textContent = t(imageryEnabled ? 'Karte' : 'Bilddaten');
  basemapButton.setAttribute('aria-label', t(imageryEnabled ? 'Topografische Karte anzeigen' : 'Bilddaten anzeigen'));
  basemapButton.setAttribute('aria-pressed', String(imageryEnabled));
  basemapButton.disabled = !campusMap || basemapBusy;
}
basemapButton.addEventListener('click', () => {
  if (!campusMap || basemapBusy) return;
  const target = !imageryEnabled;
  basemapBusy = true; refreshBasemapButton();
  mapStatus.textContent = t('Grundkarte wird gewechselt …');
  void campusMap.setImagery(target).then(() => {
    imageryEnabled = target;
    mapStatus.textContent = t(target ? 'Bilddaten aktiv' : 'Topografische Karte aktiv');
  }).catch(() => { mapStatus.textContent = t('Grundkarte konnte nicht gewechselt werden. Bitte die Internetverbindung prüfen.'); })
    .finally(() => { basemapBusy = false; refreshBasemapButton(); });
});
const overviewButton = element<HTMLButtonElement>('overview');
const locateButton = element<HTMLButtonElement>('locate');
locateButton.addEventListener('click', () => {
  if (!campusMap) return;
  ++searchSequence;
  results.replaceChildren();
  locateButton.disabled = true;
  mapStatus.textContent = t('Standort wird ermittelt …');
  void campusMap.locate().catch(() => {
    mapStatus.textContent = t('Standort nicht verfügbar. Bitte Standortfreigabe und GPS prüfen und erneut versuchen.');
  }).finally(() => { locateButton.disabled = !campusMap; });
});
let rooms: Room[] = [];
let facilities: Facility[] = [];
let campusMap: CampusMap | undefined;
let searchSequence = 0;
let connecting = false;

function notice(message: string, kind = '') {
  searchStatus.textContent = message;
  searchStatus.className = `notice ${kind}`;
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/403|499|token|permission|unable to load|access denied/i.test(message)) {
    return t('Die Szene oder ein verknüpfter Dienst ist nicht öffentlich zugänglich. Bitte die Freigaben in ArcGIS Online prüfen.');
  }
  return message;
}

function card(title: string, description: string, id: string, review = false) {
  const article = document.createElement('article');
  article.className = 'result-card';
  const label = document.createElement('p'); label.className = 'eyebrow'; label.textContent = t("SUCHERGEBNIS");
  const heading = document.createElement('h2'); heading.textContent = title;
  const text = document.createElement('p'); text.textContent = description;
  const button = document.createElement('button'); button.textContent = t("Gebäude anzeigen →");
  button.disabled = !campusMap || review;
  button.addEventListener('click', () => void showBuilding(id, title));
  article.append(label, heading, text, button);
  if (review) {
    const warning = document.createElement('p'); warning.className = 'hint';
    warning.textContent = t("Diese Gebäudezuordnung muss noch bestätigt werden. Automatische Markierung ist deaktiviert.");
    article.append(warning);
  }
  results.append(article);
}

async function showBuilding(id: string, label: string) {
  const current = ++searchSequence;
  if (!campusMap) { notice(t('Die Campuskarte wird noch geladen.')); return; }
  if (window.matchMedia('(max-width:900px)').matches) {
    document.querySelector('.map-area')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  notice(t('{label} wird auf der Karte gesucht …', {label}));
  try {
    const count = await campusMap.showBuilding(id);
    if (current !== searchSequence) return;
    notice(t('{label}: {count} Gebäudeteile markiert.', {label,count}), 'success');
  } catch (error) {
    if (current === searchSequence) notice(errorText(error), 'error');
  }
}

function runSearch() {
  ++searchSequence;
  campusMap?.clear();
  const input = searchInput.value.trim();
  results.replaceChildren();
  if (!input) { notice(t("Bitte eine Raumnummer, ein Gebäude oder eine Einrichtung eingeben.")); return; }
  const places = findFacilities(input, facilities) as Facility[];
  if (places.length) {
    for (const place of places) {
      card(t(place.name), `${localizeText(place.building_name)} · ${place.translations?.[getLanguage()] || localizeText(place.description)}`, place.campus_id);
    }
    if (places.length === 1) void showBuilding(places[0].campus_id, t(places[0].name));
    else notice(t("Mehrere Einrichtungen gefunden. Wähle das gewünschte Ziel über „Gebäude anzeigen“."));
    return;
  }
  const id = buildingId(input);
  if (id) {
    if (id === 'Gebaeude_0') { notice(t("Gebäude 0 ist das separate Stadtgebäude und gehört nicht zu dieser Campuskarte.")); return; }
    const known = rooms.filter(room => room.campus_id === id);
    if (!known.length) { notice(t("Für dieses Gebäude liegt noch kein Eintrag vor.")); return; }
    const review = known.some(room => room.mapping_status === 'needs_review') && !facilities.some(place => place.campus_id === id);
    card(localizeText(known[0].building_name), t('{count} Räume im aktuellen Verzeichnis.', {count:known.length}), id, review);
    if (!review) void showBuilding(id, localizeText(known[0].building_name));
    return;
  }
  if (/^(?:raum\s*)?[LR]?0\s*[-–—−]/i.test(input)) {
    notice(t("Diese Raumnummer gehört zum separaten Stadtgebäude (Gebäude 0), das in dieser Campuskarte nicht enthalten ist."));
    return;
  }
  const matches = findRooms(input, rooms) as Room[];
  if (matches.length === 1) {
    const room = matches[0];
    const review = room.mapping_status === 'needs_review';
    card(t('Raum {room}', {room:room.room_id}) + (room.name ? ` · ${localizeText(room.name)}` : ''), `${localizeText(room.building_name)}${room.floor_name ? ` · ${t(room.floor_name)}` : ''}`, room.campus_id, review);
    if (!review) {
      if (campusMap) void showBuilding(room.campus_id, t('Raum {room}', {room:room.room_id}));
      else notice(t('Die Campuskarte wird noch geladen.'));
    } else notice(t("Raum ist gelistet, seine Gebäudezuordnung muss noch geprüft werden."));
    return;
  }
  notice(t("Kein Raum, Gebäude oder Einrichtungsname im aktuellen Verzeichnis gefunden. Die Liste ist noch nicht vollständig."));
  for (const room of suggestions(input, rooms) as Room[]) {
    const button = document.createElement('button'); button.className = 'suggestion';
    button.textContent = `${room.room_id} · ${localizeText(room.building_name)}`;
    button.addEventListener('click', () => { searchInput.value = room.room_id; runSearch(); });
    results.append(button);
  }
}

form.addEventListener('submit', event => { event.preventDefault(); runSearch(); });
form.querySelector<HTMLButtonElement>('button')!.disabled = true;
overviewButton.addEventListener('click', () => {
  const current = ++searchSequence;
  results.replaceChildren();
  if (window.matchMedia('(max-width:900px)').matches) {
    document.querySelector('.map-area')?.scrollIntoView({ block:'start', behavior:'smooth' });
  }
  void campusMap?.overview().then(() => {
    if (current === searchSequence) notice(t('Campusübersicht'));
  }).catch(error => { if (current === searchSequence) notice(errorText(error), 'error'); });
});

async function connect() {
  if (connecting) return;
  connecting = true; publicButton.disabled = true; access.hidden = true;
  mapStatus.textContent = t("ArcGIS wird geladen …");
  try {
    const sdk = await import('./scene');
    campusMap?.destroy();
    campusMap = await sdk.createCampusMap(element('scene-container'), message => { mapStatus.textContent = message; }, () => { ++searchSequence; });
    access.hidden = true;
    overviewButton.disabled = false;
    locateButton.disabled = false;
    imageryEnabled = false; refreshBasemapButton();
    if (searchInput.value) runSearch();
  } catch (error) {
    access.hidden = false;
    mapStatus.textContent = errorText(error);
    element('load-error').textContent = errorText(error);
  } finally {
    connecting = false; publicButton.disabled = false;
  }
}

publicButton.addEventListener('click', () => void connect());

async function loadDirectory() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/room_lookup.json`);
    if (!response.ok) throw new Error(t('Raumverzeichnis konnte nicht geladen werden ({status}).', {status:response.status}));
    const data = await response.json();
    if (!Array.isArray(data) || !data.every(room => typeof room.room_id === 'string' && typeof room.campus_id === 'string' && Array.isArray(room.aliases))) {
      throw new Error(t("Das Raumverzeichnis hat ein unerwartetes Format."));
    }
    rooms = data;
    const facilityResponse = await fetch(`${import.meta.env.BASE_URL}data/facilities.json`);
    if (!facilityResponse.ok) throw new Error(t("Das Einrichtungsverzeichnis konnte nicht geladen werden."));
    const facilityData = await facilityResponse.json();
    if (!Array.isArray(facilityData) || !facilityData.every(place => typeof place.name === 'string' && typeof place.campus_id === 'string' && Array.isArray(place.aliases))) {
      throw new Error(t("Das Einrichtungsverzeichnis hat ein unerwartetes Format."));
    }
    facilities = facilityData;
    form.querySelector<HTMLButtonElement>('button')!.disabled = false;
    notice(t("Verzeichnis bereit. Suche z. B. Mensa, Rechenzentrum oder eine Raumnummer."));
  } catch (error) { notice(errorText(error), 'error'); }
}

applyLanguage();
refreshBasemapButton();
window.addEventListener('campus-language-change', () => {
  refreshBasemapButton();
  mapStatus.textContent = campusMap ? t(t("3D-Campus bereit")) : t(t("Campus wird geladen …"));
  if (searchInput.value.trim()) runSearch();
  else notice(t(t("Verzeichnis bereit. Suche z. B. Mensa, Rechenzentrum oder eine Raumnummer.")));
});
void loadDirectory();
initSettings();
void connect();
