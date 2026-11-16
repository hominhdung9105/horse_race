import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type RouteWaypoint = { id: string; label: string; latitude?: number; longitude?: number; kind: 'pickup' | 'checkpoint' | 'delivery' | 'shape' };
export type RouteShapePoint = { latitude: number; longitude: number };
type Props = { waypoints: RouteWaypoint[]; mode?: string; shapePoints?: RouteShapePoint[]; editable?: boolean; onShapeChange?: (points: RouteShapePoint[]) => void; onRouteDistance?: (value: { km: number | null; status: 'loading' | 'ready' | 'unavailable' }) => void };

const TILE_URL = (import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png').replace(/\/$/, '');
const emptyShape: RouteShapePoint[] = [];

function markerIcon(label: string, kind: string) {
  return L.divIcon({ className: '', html: `<span class="osm-live-marker ${kind}">${label}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

function pointSegmentDistance(point: L.Point, start: L.Point, end: L.Point) {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const fraction = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + fraction * dx), point.y - (start.y + fraction * dy));
}

export function OsmRouteMap({ waypoints, mode = 'ROAD', shapePoints = emptyShape, editable = false, onShapeChange, onRouteDistance }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const shapeRef = useRef(shapePoints);
  const changeRef = useRef(onShapeChange);
  const fittedKey = useRef('');
  const [mapReady, setMapReady] = useState(false);
  const [routePoints, setRoutePoints] = useState<RouteShapePoint[]>([]);
  const [routeSummary, setRouteSummary] = useState('');
  const [routeError, setRouteError] = useState('');
  useEffect(() => { shapeRef.current = shapePoints; changeRef.current = onShapeChange; }, [shapePoints, onShapeChange]);

  const points = useMemo(() => {
    const convert = (point: RouteWaypoint) => ({ ...point, latitude: Number(point.latitude), longitude: Number(point.longitude) });
    const start = waypoints.slice(0, -1).map(convert);
    const end = waypoints.slice(-1).map(convert);
    const shape = shapePoints.map((point, index) => ({ ...point, id: `shape-${index}`, label: `Route point ${index + 1}`, kind: 'shape' as const }));
    return [...start, ...shape, ...end];
  }, [waypoints, shapePoints]);
  const hasCoordinates = points.length >= 2 && points.every(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 85.05112878 && Math.abs(point.longitude) <= 180);
  const pointKey = points.map(point => `${point.latitude},${point.longitude}`).join(';');
  const endpointKey = waypoints.map(point => `${point.id}:${point.latitude},${point.longitude}`).join(';');

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([10.7769, 106.7009], 5);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map; setMapReady(true);
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; layersRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !hasCoordinates || fittedKey.current === endpointKey) return;
    fittedKey.current = endpointKey;
    map.fitBounds(L.latLngBounds(points.map(point => [point.latitude, point.longitude] as L.LatLngTuple)), { padding: [36, 36], maxZoom: 13 });
  }, [mapReady, endpointKey, hasCoordinates]);

  useEffect(() => {
    if (!hasCoordinates) { setRoutePoints([]); setRouteSummary(''); setRouteError('Saved coordinates are needed to draw this route.'); onRouteDistance?.({ km: null, status: 'unavailable' }); return; }
    const stops = points.map(point => ({ latitude: point.latitude, longitude: point.longitude }));
    if (mode.toUpperCase() === 'AIR') { setRoutePoints(stops); setRouteSummary('Air route sketch · not an airline-confirmed flight path.'); setRouteError(''); onRouteDistance?.({ km: null, status: 'unavailable' }); return; }
    const controller = new AbortController();
    setRoutePoints(stops); setRouteSummary('Calculating road route…'); setRouteError(''); onRouteDistance?.({ km: null, status: 'loading' });
    const endpoint = (import.meta.env.VITE_OSRM_ROUTING_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
    const coords = stops.map(point => `${point.longitude},${point.latitude}`).join(';');
    const timer = window.setTimeout(() => { void fetch(`${endpoint}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json(); const route = payload?.routes?.[0];
        if (!response.ok || payload?.code !== 'Ok' || !Array.isArray(route?.geometry?.coordinates)) throw new Error('OSM routing could not calculate this road route.');
        setRoutePoints(route.geometry.coordinates.map(([longitude, latitude]: [number, number]) => ({ latitude, longitude })));
        const km = Number(route.distance) / 1000; const minutes = Math.round(Number(route.duration) / 60);
        onRouteDistance?.({ km, status: 'ready' }); setRouteSummary(`OSRM road route · ${km.toLocaleString(undefined, { maximumFractionDigits: 1 })} km · about ${minutes} min`);
      }).catch(error => {
        if (controller.signal.aborted) return;
        onRouteDistance?.({ km: null, status: 'unavailable' }); setRoutePoints(stops);
        setRouteSummary('Showing connections between the selected locations.'); setRouteError(error instanceof Error ? error.message : 'OSM routing is temporarily unavailable.');
      }); }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [pointKey, hasCoordinates, mode, onRouteDistance]);

  useEffect(() => {
    const map = mapRef.current; const layers = layersRef.current;
    if (!mapReady || !map || !layers) return;
    layers.clearLayers();
    if (!hasCoordinates) return;
    const line = L.polyline(routePoints.map(point => [point.latitude, point.longitude] as L.LatLngTuple), { color: '#147f78', weight: 5, opacity: 0.95 }).addTo(layers);
    let cancelLineDrag: (() => void) | undefined;
    if (editable) line.on('mousedown', event => {
      const current = shapeRef.current;
      if (!changeRef.current || current.length >= 20) return;
      L.DomEvent.stop(event.originalEvent);
      const anchor = points.filter(point => point.kind !== 'shape').at(-2);
      const end = points.at(-1);
      if (!anchor || !end) return;
      const routeAnchors = [anchor, ...current, end];
      const anchors = routeAnchors.map(point => map.latLngToLayerPoint([point.latitude, point.longitude]));
      const click = map.latLngToLayerPoint(event.latlng);
      let insertAt = 0; let nearest = Infinity;
      for (let index = 0; index < anchors.length - 1; index += 1) {
        const distance = pointSegmentDistance(click, anchors[index], anchors[index + 1]);
        if (distance < nearest) { nearest = distance; insertAt = index; }
      }
      const wasDraggingEnabled = map.dragging.enabled();
      map.dragging.disable();
      const preview = L.circleMarker(event.latlng, { radius: 9, color: '#fff', weight: 3, fillColor: '#5265bd', fillOpacity: 1, interactive: false }).addTo(map);
      const before = routeAnchors[insertAt]; const after = routeAnchors[insertAt + 1];
      const guide = L.polyline([[before.latitude, before.longitude], event.latlng, [after.latitude, after.longitude]], { color: '#5265bd', weight: 3, dashArray: '6 6', interactive: false }).addTo(map);
      let latest = event.latlng;
      const move = (mouse: MouseEvent) => { latest = map.mouseEventToLatLng(mouse).wrap(); preview.setLatLng(latest); guide.setLatLngs([[before.latitude, before.longitude], latest, [after.latitude, after.longitude]]); };
      const cleanup = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', finish); map.removeLayer(preview); map.removeLayer(guide); if (wasDraggingEnabled) map.dragging.enable(); cancelLineDrag = undefined; };
      const finish = () => { cleanup(); const next = [...shapeRef.current]; next.splice(insertAt, 0, { latitude: Math.max(-85.05112878, Math.min(85.05112878, latest.lat)), longitude: latest.lng }); changeRef.current?.(next); };
      cancelLineDrag = cleanup;
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', finish, { once: true });
    });
    points.forEach((point, index) => {
      const shapeIndex = point.kind === 'shape' ? Number(point.id.slice(6)) : -1;
      const label = point.kind === 'pickup' ? 'S' : point.kind === 'delivery' ? 'Đ' : point.kind === 'shape' ? String(shapeIndex + 1) : String(index);
      const marker = L.marker([point.latitude, point.longitude], { icon: markerIcon(label, point.kind), draggable: editable && shapeIndex >= 0, keyboard: true }).addTo(layers);
      const tooltip = document.createElement('span'); tooltip.textContent = point.label; marker.bindTooltip(tooltip);
      if (editable && shapeIndex >= 0) marker.on('dragend', () => {
        const position = marker.getLatLng(); changeRef.current?.(shapeRef.current.map((item, itemIndex) => itemIndex === shapeIndex ? { latitude: position.lat, longitude: position.lng } : item));
      });
    });
    return () => { cancelLineDrag?.(); };
  }, [mapReady, pointKey, routePoints, hasCoordinates, editable]);

  return <section className="osm-route-card">
    <div className="osm-route-heading"><div><b>Route map</b><small>{routeSummary || 'Waiting for route locations…'}</small></div></div>
    <div className="osm-live-map" ref={containerRef} aria-label="Interactive route map" />
    {routeError && <small className="field-help">{routeError}</small>}
    {editable && <p className="field-help">Drag the route to add a point, or drag an existing point to adjust it. Drag the map or use the scroll wheel to navigate.</p>}
    {editable && shapePoints.length > 0 && <div className="header-actions">{shapePoints.map((_, index) => <button key={index} type="button" className="ghost small" onClick={() => onShapeChange?.(shapePoints.filter((__, itemIndex) => itemIndex !== index))}>Remove point {index + 1}</button>)}</div>}
    <ol className="osm-route-waypoints">{waypoints.map((point, index) => <li key={point.id}><span>{point.kind === 'pickup' ? 'Start' : point.kind === 'delivery' ? 'Destination' : `Checkpoint ${index}`}</span><b>{point.label}</b></li>)}</ol>
  </section>;
}
