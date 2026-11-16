import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

export type MapPoint = { latitude: number; longitude: number };

export type PlaceDetails = {
  name: string;
  address: string;
  city: string;
  countryCode?: string;
};

type Props = {
  label: string;
  selected: MapPoint | null;
  onSelect: (point: MapPoint | null, place?: PlaceDetails) => void;
  savedLocations?: { id: string; name: string; latitude?: number; longitude?: number }[];
  activeLocationId?: string;
  selectedLocationIds?: string[];
  onSelectLocation?: (id: string) => void;
  onUseCurrentLocation?: (point: MapPoint) => void;
  pointSelectionEnabled?: boolean;
  pickupLocationId?: string;
  deliveryLocationId?: string;
  focusLocationVersion?: number;
  primaryRoute?: { start: MapPoint; end: MapPoint };
  routeDestination?: { point: MapPoint; label: string };
  onRouteDistance?: (value: { km: number | null; status: 'loading' | 'ready' | 'unavailable' }) => void;
};

type DragState = { x: number; y: number; center: MapPoint; moved: boolean };
type PlaceResult = { place_id: number; lat: string; lon: string; display_name: string; type?: string; name?: string; address?: Record<string, string>; namedetails?: Record<string, string> };

const TILE_SIZE = 256;
const MIN_ZOOM = 4;
const MAX_ZOOM = 19;
const INITIAL_CENTER: MapPoint = { latitude: 10.7769, longitude: 106.7009 };
const TILE_URL = (import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png').replace(/\/$/, '');
const SEARCH_URL = import.meta.env.VITE_OSM_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';

function project(point: MapPoint, zoom: number): [number, number] {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sin = Math.sin(latitude * Math.PI / 180);
  return [
    (point.longitude + 180) / 360 * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}

function unproject(x: number, y: number, zoom: number): MapPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = x / scale * 360 - 180;
  const mercator = Math.PI * (1 - 2 * y / scale);
  const latitude = Math.atan(Math.sinh(mercator)) * 180 / Math.PI;
  return { latitude, longitude };
}

export default function OsmPointPicker({ label, selected, onSelect, savedLocations, activeLocationId, selectedLocationIds = [], onSelectLocation, onUseCurrentLocation, pointSelectionEnabled = false, pickupLocationId, deliveryLocationId, focusLocationVersion, primaryRoute, routeDestination, onRouteDistance }: Props) {
  const savedLocationMode = savedLocations !== undefined;
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [center, setCenter] = useState(INITIAL_CENTER);
  const [previewCenter, setPreviewCenter] = useState<MapPoint | null>(null);
  const [zoom, setZoom] = useState(13);
  const [mapSize, setMapSize] = useState({ width: 640, height: 320 });
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const lastSearchAt = useRef(0);
  const lookupId = useRef(0);
  const [lookupMessage, setLookupMessage] = useState('');
  const [routeLine, setRouteLine] = useState<MapPoint[]>([]);
  const [primaryRouteLine, setPrimaryRouteLine] = useState<MapPoint[]>([]);
  const visibleCenter = previewCenter ?? center;
  const savedPins = useMemo(() => (savedLocations ?? []).flatMap(location => {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ ...location, point: { latitude, longitude } }] : [];
  }), [savedLocations]);

  useEffect(() => {
    if (!savedLocationMode) return;
    if (selected) return;
    const active = savedPins.find(pin => pin.id === activeLocationId);
    if (active) {
      setCenter(active.point);
      setZoom(15);
    } else if (savedPins.length) {
      const average = savedPins.reduce((result, pin) => ({ latitude: result.latitude + pin.point.latitude / savedPins.length, longitude: result.longitude + pin.point.longitude / savedPins.length }), { latitude: 0, longitude: 0 });
      setCenter(average);
      setZoom(savedPins.length === 1 ? 14 : 5);
    }
  }, [savedLocationMode, activeLocationId, savedPins, selected]);

  useEffect(() => {
    if (!savedLocationMode || !focusLocationVersion) return;
    const focused = savedPins.find(pin => pin.id === activeLocationId);
    if (focused) { setCenter(focused.point); setZoom(15); }
  }, [savedLocationMode, activeLocationId, focusLocationVersion, savedPins]);

  useEffect(() => {
    if (!selected || !routeDestination) { setRouteLine([]); onRouteDistance?.({ km: null, status: 'unavailable' }); return; }
    const controller = new AbortController();
    setRouteLine([]); onRouteDistance?.({ km: null, status: 'loading' });
    const endpoint = (import.meta.env.VITE_OSRM_ROUTING_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
    void fetch(`${endpoint}/route/v1/driving/${selected.longitude},${selected.latitude};${routeDestination.point.longitude},${routeDestination.point.latitude}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json(); const route = payload?.routes?.[0];
        if (!response.ok || payload?.code !== 'Ok' || !Array.isArray(route?.geometry?.coordinates)) throw new Error('OSM route is unavailable.');
        setRouteLine(route.geometry.coordinates.map(([longitude, latitude]: [number, number]) => ({ latitude, longitude })));
        onRouteDistance?.({ km: Number(route.distance) / 1000, status: 'ready' });
      })
      .catch(error => { if (!controller.signal.aborted) { setRouteLine([selected, routeDestination.point]); onRouteDistance?.({ km: null, status: 'unavailable' }); } });
    return () => controller.abort();
  }, [selected?.latitude, selected?.longitude, routeDestination?.point.latitude, routeDestination?.point.longitude, onRouteDistance]);

  useEffect(() => {
    if (!primaryRoute) { setPrimaryRouteLine([]); return; }
    const { start, end } = primaryRoute;
    const controller = new AbortController();
    setPrimaryRouteLine([start, end]);
    const endpoint = (import.meta.env.VITE_OSRM_ROUTING_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
    void fetch(`${endpoint}/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal })
      .then(async response => {
        const payload = await response.json(); const coordinates = payload?.routes?.[0]?.geometry?.coordinates;
        if (!response.ok || payload?.code !== 'Ok' || !Array.isArray(coordinates)) throw new Error('Road route unavailable.');
        setPrimaryRouteLine(coordinates.map(([longitude, latitude]: [number, number]) => ({ latitude, longitude })));
      })
      .catch(() => { if (!controller.signal.aborted) setPrimaryRouteLine([start, end]); });
    return () => controller.abort();
  }, [primaryRoute?.start.latitude, primaryRoute?.start.longitude, primaryRoute?.end.latitude, primaryRoute?.end.longitude]);

  useEffect(() => {
    if (!primaryRoute) return;
    const start = project(primaryRoute.start, 0);
    const end = project(primaryRoute.end, 0);
    const midpoint = unproject((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, 0);
    const width = Math.max(1, mapSize.width - 120);
    const height = Math.max(1, mapSize.height - 120);
    const scaleX = width / Math.max(1, Math.abs(end[0] - start[0]));
    const scaleY = height / Math.max(1, Math.abs(end[1] - start[1]));
    const fitZoom = Math.floor(Math.log2(Math.min(scaleX, scaleY)));
    setCenter(midpoint);
    setZoom(Math.max(MIN_ZOOM, Math.min(16, fitZoom)));
  }, [primaryRoute?.start.latitude, primaryRoute?.start.longitude, primaryRoute?.end.latitude, primaryRoute?.end.longitude, mapSize.width, mapSize.height]);

  useEffect(() => {
    if (!selected || !routeDestination || primaryRoute) return;
    const midpoint = { latitude: (selected.latitude + routeDestination.point.latitude) / 2, longitude: (selected.longitude + routeDestination.point.longitude) / 2 };
    const km = Math.hypot((selected.latitude - routeDestination.point.latitude) * 111, (selected.longitude - routeDestination.point.longitude) * 111 * Math.cos(midpoint.latitude * Math.PI / 180));
    setCenter(selected); setZoom(Math.max(5, Math.min(16, Math.round(16 - Math.log2(Math.max(1, km / 2))))));
  }, [selected?.latitude, selected?.longitude, routeDestination?.point.latitude, routeDestination?.point.longitude, primaryRoute]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setMapSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    setMapSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(() => {
    const [centerX, centerY] = project(visibleCenter, zoom);
    const { width, height } = mapSize;
    const left = centerX - width / 2;
    const top = centerY - height / 2;
    const firstX = Math.floor(left / TILE_SIZE);
    const firstY = Math.floor(top / TILE_SIZE);
    const columns = Math.ceil(width / TILE_SIZE) + 1;
    const rows = Math.ceil(height / TILE_SIZE) + 1;
    const worldTiles = 2 ** zoom;
    const result: { x: number; y: number; left: number; top: number; key: string }[] = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const rawX = firstX + column;
        const y = firstY + row;
        if (y < 0 || y >= worldTiles) continue;
        const x = ((rawX % worldTiles) + worldTiles) % worldTiles;
        result.push({
          x,
          y,
          left: rawX * TILE_SIZE - left,
          top: y * TILE_SIZE - top,
          key: `${zoom}/${x}/${y}`,
        });
      }
    }
    return result;
  }, [mapSize, visibleCenter, zoom]);

  const markerPosition = selected ? (() => {
    const [centerX, centerY] = project(visibleCenter, zoom);
    const [pointX, pointY] = project(selected, zoom);
    return { left: mapSize.width / 2 + pointX - centerX, top: mapSize.height / 2 + pointY - centerY };
  })() : null;
  const savedPinPositions = savedPins.map(location => {
    const [centerX, centerY] = project(visibleCenter, zoom);
    const [pointX, pointY] = project(location.point, zoom);
    return { ...location, left: mapSize.width / 2 + pointX - centerX, top: mapSize.height / 2 + pointY - centerY };
  });
  const toScreenPoint = (point: MapPoint) => {
    const [centerX, centerY] = project(visibleCenter, zoom);
    const [pointX, pointY] = project(point, zoom);
    return `${mapSize.width / 2 + pointX - centerX},${mapSize.height / 2 + pointY - centerY}`;
  };
  const routeLinePoints = routeLine.map(toScreenPoint).join(' ');
  const primaryRouteLinePoints = primaryRouteLine.map(toScreenPoint).join(' ');

  function moveCenterForDrag(event: PointerEvent<HTMLDivElement>, drag: DragState) {
    const [centerX, centerY] = project(drag.center, zoom);
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    setPreviewCenter(unproject(centerX - dx, centerY - dy, zoom));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, center, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) moveCenterForDrag(event, drag);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.moved && previewCenter) setCenter(previewCenter);
    else if (savedLocationMode && !pointSelectionEnabled) setLookupMessage('Choose a saved location pin to set the pickup or delivery point.');
    else {
      const rect = event.currentTarget.getBoundingClientRect();
      const [centerX, centerY] = project(center, zoom);
      const point = unproject(centerX + event.clientX - rect.left - rect.width / 2, centerY + event.clientY - rect.top - rect.height / 2, zoom);
      onSelect(point);
      const requestId = ++lookupId.current;
      void reverseLookup(point, requestId);
    }
    setPreviewCenter(null);
    dragRef.current = null;
  }

  async function searchPlaces() {
    const query = searchQuery.trim();
    if (!query) return;
    const elapsed = Date.now() - lastSearchAt.current;
    if (elapsed < 1000) {
      setSearchError('Please wait a moment before searching again.');
      return;
    }
    lastSearchAt.current = Date.now();
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const url = new URL(SEARCH_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '5');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('namedetails', '1');
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Place search failed (${response.status}).`);
      const results = await response.json() as PlaceResult[];
      setSearchResults(results);
      if (!results.length) setSearchError('No matching places found. Try a nearby landmark or town.');
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not search OpenStreetMap right now.');
    } finally {
      setSearching(false);
    }
  }

  function placeDetails(result: PlaceResult): PlaceDetails {
    const address = result.address ?? {};
    const street = [address.house_number, address.road].filter(Boolean).join(' ');
    const city = address.city || address.town || address.village || address.municipality || address.suburb || address.county || '';
    const name = result.namedetails?.name || result.name || address.amenity || address.building || address.shop || address.tourism || address.road || city || result.display_name.split(',')[0];
    return { name, address: street || result.display_name, city, countryCode: address.country_code?.toUpperCase() };
  }

  function centerOnPlace(result: PlaceResult) {
    const point = { latitude: Number(result.lat), longitude: Number(result.lon) };
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
    lookupId.current += 1;
    setCenter(point);
    setPreviewCenter(null);
    setZoom(16);
    onSelect(point, placeDetails(result));
    setLookupMessage('Address details filled. Check them before saving.');
  }

  async function reverseLookup(point: MapPoint, requestId: number) {
    const waitMs = Math.max(0, 1100 - (Date.now() - lastSearchAt.current));
    if (waitMs) await new Promise(resolve => window.setTimeout(resolve, waitMs));
    if (requestId !== lookupId.current) return;
    lastSearchAt.current = Date.now();
    setLookupMessage('Looking up address details…');
    try {
      const url = new URL(SEARCH_URL.replace(/\/search\/?$/, '/reverse'));
      url.searchParams.set('lat', String(point.latitude));
      url.searchParams.set('lon', String(point.longitude));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('namedetails', '1');
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`);
      const result = await response.json() as PlaceResult;
      if (requestId !== lookupId.current) return;
      if (!result.display_name) throw new Error('No address details were found for this point.');
      onSelect(point, placeDetails(result));
      setLookupMessage('Address details filled. Check them before saving.');
    } catch (error) {
      if (requestId === lookupId.current) setLookupMessage(error instanceof Error ? `${error.message} You can still enter the details manually.` : 'Address lookup failed. You can still enter the details manually.');
    }
  }

  return <section className={`osm-point-picker${savedLocationMode ? ' osm-saved-location-picker' : ''}`} aria-label={label}>
    {(!savedLocationMode || pointSelectionEnabled) && <div className="osm-place-search">
      <label>Search for a place or address<input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Stable, airport, town, or public address" /></label>
      <button type="button" className="ghost" disabled={searching || !searchQuery.trim()} onClick={() => void searchPlaces()}>{searching ? 'Searching…' : 'Search OSM'}</button>
      <small className="field-help">Search runs only when you press the button. The query is sent to OpenStreetMap search; do not enter private information.</small>
      {searchError && <small className="osm-search-error" role="status">{searchError}</small>}
      {lookupMessage && <small className="field-help" role="status">{lookupMessage}</small>}
      {!!searchResults.length && <div className="osm-search-results" role="list" aria-label="Place search results">{searchResults.map(result => <button type="button" key={result.place_id} className="ghost small" onClick={() => centerOnPlace(result)}><b>{result.display_name}</b><span>Center map here · {result.type || 'place'}</span></button>)}</div>}
    </div>}
    <div className="osm-picker-heading">
      <div><b>{label}</b><small>{savedLocationMode ? 'Click a saved place pin to choose it. Drag to pan; use +/− to zoom.' : 'Click a point to select it. Drag to pan; use +/− to zoom.'}</small></div>
      <div className="osm-map-controls">
        {onUseCurrentLocation && <button type="button" className="ghost small" onClick={() => {
          if (!navigator.geolocation) { setLookupMessage('This browser does not support current location.'); return; }
          setLookupMessage('Finding your current location…');
          navigator.geolocation.getCurrentPosition(position => {
            const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            setCenter(point); setZoom(16); onSelect(point); onUseCurrentLocation(point); setLookupMessage('Current location selected.');
          }, error => setLookupMessage(error.code === error.PERMISSION_DENIED ? 'Location access was denied. You can select a point on the map instead.' : 'Could not read your location. Select a point on the map instead.'), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
        }}>Use my location</button>}
        <button type="button" className="ghost small" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom(value => Math.min(MAX_ZOOM, value + 1))}>+</button>
        <span>Zoom {zoom}</span>
        <button type="button" className="ghost small" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom(value => Math.max(MIN_ZOOM, value - 1))}>−</button>
        {selected && <button type="button" className="ghost small" onClick={() => onSelect(null)}>Clear point</button>}
      </div>
    </div>
    <div
      ref={mapRef}
      className={`osm-point-map${dragRef.current?.moved ? ' is-dragging' : ''}`}
      role="application"
      aria-label="OpenStreetMap point picker"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { setPreviewCenter(null); dragRef.current = null; }}
      onContextMenu={event => event.preventDefault()}
    >
      {tiles.map(tile => <img
        key={tile.key}
        className="osm-map-tile"
        src={`${TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y))}`}
        alt=""
        draggable={false}
        style={{ left: tile.left, top: tile.top }}
        onError={() => setTilesUnavailable(true)}
      />)}
      {(routeLinePoints || primaryRouteLinePoints) && <svg className="osm-point-route-overlay" aria-hidden="true">{primaryRouteLinePoints && <polyline className="osm-primary-route" points={primaryRouteLinePoints} />}{routeLinePoints && <polyline className="osm-customer-collection-route" points={routeLinePoints} />}</svg>}
      {savedLocationMode && savedPinPositions.map(location => <button
        type="button"
        key={location.id}
        className={`osm-saved-location-pin${selectedLocationIds.includes(location.id) ? ' is-selected' : ''}${pickupLocationId === location.id ? ' is-pickup' : ''}${deliveryLocationId === location.id ? ' is-delivery' : ''}`}
        style={{ left: location.left, top: location.top }}
        title={location.name}
        onPointerDown={event => { if (onSelectLocation) event.stopPropagation(); }}
        onPointerUp={event => { if (onSelectLocation) event.stopPropagation(); }}
        onClick={event => { if (!onSelectLocation) return; event.stopPropagation(); onSelectLocation(location.id); setLookupMessage(`${location.name} selected.`); }}
      ><span aria-hidden="true">●</span><small>{location.name}</small></button>)}
      {markerPosition && <span className="osm-point-marker" style={{ left: markerPosition.left, top: markerPosition.top }} aria-label="Selected point" />}
      {tilesUnavailable && <div className="osm-map-error">Map tiles are unavailable. Check your connection, then reload this page.</div>}
      {savedLocationMode && !savedPinPositions.length && <div className="osm-map-error">No saved locations have map coordinates yet. Ask Logistics to add coordinates to the locations.</div>}
      <a className="osm-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}>© OpenStreetMap contributors</a>
    </div>
    {savedLocationMode && pointSelectionEnabled && <div className="osm-point-legend"><span><i className="customer" />Customer point</span><span><i className="pickup" />Pickup</span><span><i className="delivery" />Delivery</span>{selected && <span>Click the map to change customer point · {routeDestination ? `Route to ${routeDestination.label}` : 'Pickup and Delivery pins stay visible'}</span>}</div>}
    <div className="osm-point-summary" aria-live="polite">
      {savedLocationMode
        ? <>{selectedLocationIds.length ? <><span>Selected saved location{selectedLocationIds.length === 1 ? '' : 's'}</span><code>{savedPinPositions.filter(pin => selectedLocationIds.includes(pin.id)).map(pin => pin.name).join(' · ')}</code></> : <span>Choose a saved pickup or delivery location from the map.</span>}</>
        : selected
        ? <><span>Selected point</span><code>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</code></>
        : <span>Select a point on the map before recording this event.</span>}
    </div>
    <small className="field-help">{savedLocationMode ? 'Only locations registered by Logistics can be used in a transport request.' : 'A manually selected map point is not a live GPS reading from the driver’s device.'}</small>
  </section>;
}
