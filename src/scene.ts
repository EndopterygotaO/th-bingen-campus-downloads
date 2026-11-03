import type Extent from '@arcgis/core/geometry/Extent.js';
import Graphic from '@arcgis/core/Graphic.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import Point from '@arcgis/core/geometry/Point.js';
import Circle from '@arcgis/core/geometry/Circle.js';
import { Geolocation } from '@capacitor/geolocation';
import Basemap from '@arcgis/core/Basemap.js';
import TileLayer from '@arcgis/core/layers/TileLayer.js';
import { setLocale } from '@arcgis/core/intl.js';
import { t, getLanguage, localizeText, applyLanguage, setLanguage } from './i18n.mjs';
import '@arcgis/map-components/components/arcgis-scene';
import Popup from '@arcgis/core/widgets/Popup.js';
import SceneLayer from '@arcgis/core/layers/SceneLayer.js';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js';
import type { CampusMap } from './types';
import { sqlLiteral } from './search.mjs';

export const portalUrl = (import.meta.env.VITE_ARCGIS_PORTAL_URL || 'https://www.arcgis.com').replace(/\/$/, '');
const sceneId = import.meta.env.VITE_WEB_SCENE_ID || '49e00509d7fc47368b41318bbcda89da';
const layerUrl = import.meta.env.VITE_SCENE_LAYER_URL || 'https://services3.arcgis.com/NS3Rj39pJkkmPH7N/arcgis/rest/services/Campus_All_Web/SceneServer';
export const featureUrl = import.meta.env.VITE_FEATURE_LAYER_URL || 'https://services3.arcgis.com/NS3Rj39pJkkmPH7N/arcgis/rest/services/Campus_All_Web/FeatureServer';

function serviceRoot(url: string) {
  return url.replace(/\/layers\/\d+\/?$/i, '').replace(/\/$/, '').toLowerCase();
}

export async function createCampusMap(container: HTMLElement, status: (message: string) => void, onMapSelection: () => void = () => {}): Promise<CampusMap> {
  setLocale(getLanguage());
  const localeChanged = () => { setLocale(getLanguage()); };
  window.addEventListener('campus-language-change', localeChanged);
  const scene = document.createElement('arcgis-scene');
  scene.itemId = sceneId;
  scene.qualityProfile = 'medium';
  container.replaceChildren(scene);
  try {
    status(t("Webszene wird geladen …"));
    await scene.viewOnReady();
    const view = scene.view;
    if (!view) throw new Error(t("Die 3D-Ansicht konnte nicht erstellt werden."));
    const map = view.map;
    if (!map) throw new Error(t("Die Webszene enthält keine Karte."));
    await Promise.all(map.allLayers.toArray().map(layer => layer.load()));
    // Retain the scene's exact starting basemap; switching never saves to ArcGIS Online.
    const originalBasemap = map.basemap;
    let imageryBasemap: Basemap | undefined;
    let destroyed = false;
    const locationLayer = new GraphicsLayer({ title: 'Standort', listMode: 'hide', elevationInfo: { mode: 'on-the-ground' } });
    map.add(locationLayer);
    const layers = map.allLayers.toArray().filter((layer): layer is SceneLayer => layer.type === 'scene');
    let buildings = layers.find(layer => layer.url && serviceRoot(layer.url) === serviceRoot(layerUrl));
    if (!buildings) {
      if (layers.length) {
        throw new Error(t("Die Webszene enthält einen anderen Szenenlayer als die konfigurierte URL. Bitte die Item- und Service-URLs prüfen; es wurde kein zweites Gebäudemodell hinzugefügt."));
      }
      buildings = new SceneLayer({ url: `${layerUrl.replace(/\/$/, '')}/layers/0` });
      map.add(buildings);
      await buildings.load();
    }
    const idField = buildings.fields.find(field => field.name.toLowerCase() === 'campus_id');
    if (!idField) throw new Error(t("Dem veröffentlichten Gebäudelayer fehlt das Feld campus_id. Bitte beim Veröffentlichen einschließen."));
    const nameField = buildings.fields.find(field => field.name.toLowerCase() === 'name');
    const usage = buildings.getFieldUsageInfo(idField.name) as { supportsLayerQuery?: boolean };
    if (!usage.supportsLayerQuery) {
      throw new Error(t("Der Szenenlayer unterstützt keine Abfragen über campus_id. Bitte die Verknüpfung zum zugehörigen Feature-Layer und dessen Freigabe prüfen."));
    }
    buildings.outFields = ['*'];
    buildings.popupEnabled = true;
    const refreshPopup = () => {
    buildings.popupTemplate = {
      title: `{${nameField?.name || idField.name}}`,
      content: [{ type: 'fields', fieldInfos: [
        ...(nameField ? [{ fieldName: nameField.name, label: t("Gebäude") }] : []),
        { fieldName: idField.name, label: t("Gebäude-ID") },
      ] }],
    };
    };
    refreshPopup();
    const popupLanguageChanged = () => { view.closePopup(); refreshPopup(); };
    window.addEventListener('campus-language-change', popupLanguageChanged);
    const layerView = await view.whenLayerView(buildings);
    let overviewExtent: Extent | null | undefined;
    let highlight: { remove(): void } | undefined;
    let sequence = 0;
    const makeQuery = (id: string) => {
      const query = buildings.createQuery();
      query.where = `${idField.name} = ${sqlLiteral(id)}`;
      return query;
    };
    // Search and map clicks share one selection; popup highlighting is disabled.
    view.popupEnabled = false;
    view.popup = new Popup({ highlightEnabled: false });
    const resetSelection = () => {
      const current = ++sequence;
      highlight?.remove();
      highlight = undefined;
      view.animation?.stop();
      view.closePopup();
      return current;
    };
    const selectBuilding = async (id: string, current: number, zoom: boolean) => {
      const query = makeQuery(id);
      const [ids, extentResult] = await Promise.all([
        buildings.queryObjectIds(query),
        zoom ? buildings.queryExtent(query) : Promise.resolve({ extent: null }),
      ]);
      if (current !== sequence) return 0;
      if (!ids?.length) throw new Error(t('{id} wurde im veröffentlichten Layer nicht gefunden. Bitte die Schreibweise der Gebäude-ID prüfen.', {id}));
      if (extentResult.extent) {
        try { await view.goTo(extentResult.extent.expand(1.8), { duration: 850 }); }
        catch (error) { if ((error as Error).name !== 'AbortError') throw error; }
      }
      if (current !== sequence) return 0;
      await reactiveUtils.whenOnce(() => !layerView.updating);
      if (current !== sequence) return 0;
      highlight = layerView.highlight(ids);
      return ids.length;
    };
    const clickHandle = view.on('click', event => {
      const current = resetSelection();
      onMapSelection();
      void (async () => {
        const hit = await view.hitTest(event, { include: [buildings] });
        if (current !== sequence) return;
        const result = hit.results.find(result => result.type === 'graphic' && result.graphic.layer === buildings);
        if (!result || result.type !== 'graphic') { status(t("3D-Campus bereit")); return; }
        const feature = result.graphic;
        let id = feature.attributes?.[idField.name];
        // Some scene caches only include the object ID in hit-test attributes.
        if (id == null) {
          const objectId = feature.getObjectId();
          if (objectId == null) throw new Error(t("Der angeklickte Gebäudeteil hat keine Objekt-ID."));
          const query = buildings.createQuery();
          query.objectIds = [objectId];
          query.outFields = ['*'];
          query.returnGeometry = false;
          const response = await buildings.queryFeatures(query);
          if (current !== sequence) return;
          const fullFeature = response.features[0];
          if (fullFeature) { feature.attributes = fullFeature.attributes; }
          id = feature.attributes?.[idField.name];
        }
        if (current !== sequence) return;
        if (typeof id !== 'string' || !id.trim()) {
          status(t("Dieser Gebäudeteil hat noch keine Gebäude-ID."));
          return;
        }
        const count = await selectBuilding(id, current, false);
        if (current !== sequence) return;
        status(t('{label}: {count} Gebäudeteile markiert.', {label:id,count}));
        await view.openPopup({ features: [feature], location: result.mapPoint ?? undefined });
      })().catch(error => {
        if (current === sequence) status(t('Gebäudeauswahl fehlgeschlagen: {error}', {error:(error as Error).message}));
      });
    });
    status(t("3D-Campus bereit"));
    return {
      async locate() {
        const current = resetSelection();
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        if (destroyed || current !== sequence) return;
        const { latitude, longitude, accuracy } = position.coords;
        if (![latitude, longitude, accuracy].every(Number.isFinite) || accuracy < 0) throw new Error('Invalid location');
        const point = new Point({ longitude, latitude });
        locationLayer.removeAll();
        locationLayer.addMany([
          new Graphic({ geometry: new Circle({ center: point, radius: Math.max(accuracy, 1), radiusUnit: 'meters', geodesic: true }), symbol: { type: 'simple-fill', color: [35, 120, 245, 0.15], outline: { color: [35, 120, 245, 0.5], width: 1 } } }),
          new Graphic({ geometry: point, symbol: { type: 'simple-marker', color: '#2378f5', size: 13, outline: { color: '#ffffff', width: 2 } } }),
        ]);
        status(t('Standort ermittelt (Genauigkeit ca. {accuracy} m). Zum Aktualisieren erneut tippen.', { accuracy: Math.round(accuracy) }));
        try { await view.goTo({ target: point, scale: Math.max(1500, Math.min(accuracy * 30, 100000)), tilt: 0 }, { duration: 700 }); }
        catch (error) { if ((error as Error).name !== 'AbortError') throw error; }
      },
      async setImagery(enabled) {
        if (destroyed) return;
        const previous = map.basemap;
        if (enabled && !imageryBasemap) {
          const candidate = new Basemap({
            title: 'World Imagery',
            baseLayers: [new TileLayer({ url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer' })],
          });
          try { await candidate.loadAll(); }
          catch (error) { candidate.destroy(); throw error; }
          if (destroyed) { candidate.destroy(); return; }
          imageryBasemap = candidate;
        }
        const target = enabled ? imageryBasemap : originalBasemap;
        if (!target || destroyed) return;
        try {
          map.basemap = target;
          await Promise.all(target.baseLayers.map(layer => view.whenLayerView(layer)).toArray());
        } catch (error) {
          if (!destroyed) map.basemap = previous;
          throw error;
        }
      },
      showBuilding(id) { return selectBuilding(id, resetSelection(), true); },
      async overview() {
        const current = resetSelection();
        // Frame the actual campus buildings, independent of the scene's saved camera.
        if (!overviewExtent) {
          const query = buildings.createQuery();
          query.where = `${idField.name} LIKE 'Gebaeude_%'`;
          overviewExtent = (await buildings.queryExtent(query)).extent;
        }
        if (current !== sequence || destroyed) return;
        if (!overviewExtent) throw new Error(t('Die Campusausdehnung konnte nicht ermittelt werden.'));
        // An explicit centre avoids extent fitting inheriting an unsuitable camera target.
        // Removing the result card enlarges the map; wait for SceneView to resize first.
        await reactiveUtils.whenOnce(() => Math.abs(view.width - container.clientWidth) <= 1 && Math.abs(view.height - container.clientHeight) <= 1);
        if (current !== sequence || destroyed) return;
        // Web Mercator distances are inflated by latitude; SceneView scale uses ground metres.
        const latitude = overviewExtent.center.latitude ?? 0;
        const groundFactor = overviewExtent.spatialReference.isWebMercator ? Math.cos(latitude * Math.PI / 180) : 1;
        const metresPerPixel = Math.max(overviewExtent.width / Math.max(view.width, 1), overviewExtent.height / Math.max(view.height, 1)) * groundFactor;
        const scale = metresPerPixel * 3779.527559 * 1.25;
        try { await view.goTo({ target: overviewExtent.center, scale, tilt: 0, heading: 0 }, { duration: 700 }); }
        catch (error) { if ((error as Error).name !== 'AbortError') throw error; }
      },
      clear() { resetSelection(); },
      destroy() { destroyed = true; locationLayer.destroy(); window.removeEventListener('campus-language-change', popupLanguageChanged); window.removeEventListener('campus-language-change', localeChanged); resetSelection(); clickHandle.remove(); scene.remove(); },
    };
  } catch (error) {
    window.removeEventListener('campus-language-change', localeChanged);
    scene.remove();
    throw error;
  }
}
