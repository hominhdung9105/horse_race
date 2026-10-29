import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

export type MapPoint = { latitude: number; longitude: number };

type Props = {
  label: string;
  selected: MapPoint | null;
  onSelect: (point: MapPoint | null) => void;
};

type DragState = { x: number; y: number; center: MapPoint; moved: boolean };
type PlaceResult = { place_id: number; lat: string; lon: string; display_name: string; type?: string };

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

export default function OsmPointPicker({ label, selected, onSelect }: Props) {
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
  const visibleCenter = previewCenter ?? center;

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
    else {
      const rect = event.currentTarget.getBoundingClientRect();
      const [centerX, centerY] = project(center, zoom);
      onSelect(unproject(centerX + event.clientX - rect.left - rect.width / 2, centerY + event.clientY - rect.top - rect.height / 2, zoom));
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
      url.searchParams.set('addressdetails', '0');
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

  function centerOnPlace(result: PlaceResult) {
    const point = { latitude: Number(result.lat), longitude: Number(result.lon) };
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
    setCenter(point);
    setPreviewCenter(null);
    setZoom(16);
  }

  return <section className="osm-point-picker" aria-label={label}>
    <div className="osm-place-search">
      <label>Search for a place or address<input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Stable, airport, town, or public address" /></label>
      <button type="button" className="ghost" disabled={searching || !searchQuery.trim()} onClick={() => void searchPlaces()}>{searching ? 'Searching…' : 'Search OSM'}</button>
      <small className="field-help">Search runs only when you press the button. The query is sent to OpenStreetMap search; do not enter private information.</small>
      {searchError && <small className="osm-search-error" role="status">{searchError}</small>}
      {!!searchResults.length && <div className="osm-search-results" role="list" aria-label="Place search results">{searchResults.map(result => <button type="button" key={result.place_id} className="ghost small" onClick={() => centerOnPlace(result)}><b>{result.display_name}</b><span>Center map here · {result.type || 'place'}</span></button>)}</div>}
    </div>
    <div className="osm-picker-heading">
      <div><b>{label}</b><small>Click a point to select it. Drag to pan; use +/− to zoom.</small></div>
      <div className="osm-map-controls">
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
      {markerPosition && <span className="osm-point-marker" style={{ left: markerPosition.left, top: markerPosition.top }} aria-label="Selected point" />}
      {tilesUnavailable && <div className="osm-map-error">Map tiles are unavailable. Check your connection, then reload this page.</div>}
      <a className="osm-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}>© OpenStreetMap contributors</a>
    </div>
    <div className="osm-point-summary" aria-live="polite">
      {selected
        ? <><span>Selected point</span><code>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</code></>
        : <span>Select a point on the map before recording this event.</span>}
    </div>
    <small className="field-help">A manually selected map point is not a live GPS reading from the driver's device.</small>
  </section>;
}
