import { FormEvent, useEffect, useMemo, useState } from 'react';
import ModalDialog from '../../core/ModalDialog';
import { getRows, getRouteCapabilityCatalog, saveRouteCapability, RecordRow, RouteCapabilities } from './api';

const modes = [
  { value: 'ROAD', label: 'Road' },
  { value: 'AIR', label: 'Air' },
  { value: 'MIXED', label: 'Road and air' },
];
type DurationHours = Record<string, { min: string; max: string }>;

export default function RouteCapabilitiesView({ notify }: { notify: (message: string) => void }) {
  const [locations, setLocations] = useState<RecordRow[]>([]);
  const [routes, setRoutes] = useState<RouteCapabilities[]>([]);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [routeQuery, setRouteQuery] = useState('');
  const [routeSort, setRouteSort] = useState('origin');
  const [routeDirection, setRouteDirection] = useState<'asc' | 'desc'>('asc');
  const [allowedModes, setAllowedModes] = useState<string[]>([]);
  const [durationHours, setDurationHours] = useState<DurationHours>({});
  const [expressDurationHours, setExpressDurationHours] = useState<DurationHours>({});
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getRows('locations'), getRouteCapabilityCatalog()])
      .then(([locationRows, catalog]) => { setLocations(locationRows); setRoutes(catalog); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load route capabilities.'));
  }, []);

  const locationName = (id: string) => String(locations.find(item => item.id === id)?.name ?? 'Unknown location');
  const visibleRoutes = useMemo(() => {
    const query = routeQuery.trim().toLocaleLowerCase();
    const filtered = routes.filter(route => !query || `${locationName(route.originLocationId)} ${locationName(route.destinationLocationId)} ${route.allowedModes.join(' ')}`.toLocaleLowerCase().includes(query));
    return filtered.sort((a, b) => {
      const keyA = routeSort === 'destination' ? locationName(a.destinationLocationId) : locationName(a.originLocationId);
      const keyB = routeSort === 'destination' ? locationName(b.destinationLocationId) : locationName(b.originLocationId);
      const comparison = keyA.localeCompare(keyB, undefined, { sensitivity: 'base' }) || locationName(a.destinationLocationId).localeCompare(locationName(b.destinationLocationId), undefined, { sensitivity: 'base' });
      return routeDirection === 'asc' ? comparison : -comparison;
    });
  }, [routes, locations, routeQuery, routeSort, routeDirection]);
  function startCreate() {
    setIsEditing(false);
    setOriginId(''); setDestinationId(''); setAllowedModes([]); setDurationHours({}); setExpressDurationHours({});
    setError(''); setFormOpen(true);
  }
  function editRoute(route: RouteCapabilities) {
    setIsEditing(true);
    setOriginId(route.originLocationId); setDestinationId(route.destinationLocationId); setAllowedModes(route.allowedModes);
    setDurationHours(Object.fromEntries((route.estimatedDurations ?? []).map(item => [item.mode, { min: String(item.minDurationMinutes / 60), max: String(item.maxDurationMinutes / 60) }])));
    setExpressDurationHours(Object.fromEntries((route.estimatedDurations ?? []).filter(item => item.minExpressDurationMinutes && item.maxExpressDurationMinutes).map(item => [item.mode, { min: String(item.minExpressDurationMinutes! / 60), max: String(item.maxExpressDurationMinutes! / 60) }])));
    setError(''); setFormOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!originId || !destinationId || originId === destinationId) { setError('Choose two different locations.'); return; }
    if (!allowedModes.length) { setError('Choose at least one supported transport mode.'); return; }
    const estimatedDurations = [];
    for (const mode of allowedModes) {
      const range = durationHours[mode];
      const express = expressDurationHours[mode];
      if (!range?.min && !range?.max) {
        if (express?.min || express?.max) { setError(`Configure the Standard range before adding an Express range for ${mode}.`); return; }
        continue;
      }
      const minDurationMinutes = Math.round(Number(range.min) * 60);
      const maxDurationMinutes = Math.round(Number(range.max) * 60);
      if (!range.min || !range.max || minDurationMinutes <= 0 || maxDurationMinutes < minDurationMinutes) {
        setError(`Enter a valid minimum and maximum duration for ${mode}, or leave both blank.`); return;
      }
      if (express?.min || express?.max) {
        const minExpressDurationMinutes = Math.round(Number(express.min) * 60);
        const maxExpressDurationMinutes = Math.round(Number(express.max) * 60);
        if (!express.min || !express.max || minExpressDurationMinutes <= 0 || maxExpressDurationMinutes < minExpressDurationMinutes) {
          setError(`Enter a valid express minimum and maximum for ${mode}, or leave both blank.`); return;
        }
        estimatedDurations.push({ mode, minDurationMinutes, maxDurationMinutes, minExpressDurationMinutes, maxExpressDurationMinutes });
      } else estimatedDurations.push({ mode, minDurationMinutes, maxDurationMinutes });
    }
    setBusy(true);
    try {
      await saveRouteCapability({ originLocationId: originId, destinationLocationId: destinationId, allowedModes, estimatedDurations });
      setRoutes(await getRouteCapabilityCatalog()); setFormOpen(false);
      notify(isEditing ? 'Supported route updated.' : 'Supported route added.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save route capability.'); }
    finally { setBusy(false); }
  }

  return <div className="stack">
    <section className="panel">
      <div className="panel-title"><div><h2>Supported transport routes</h2><p>Choose which transport modes are offered for each direction between saved locations.</p></div><button onClick={startCreate}>+ Add route</button></div>
      {error && !formOpen && <p className="auth-error" role="alert">{error}</p>}
      <div className="table-tools"><label>Search routes<input value={routeQuery} onChange={event => setRouteQuery(event.target.value)} placeholder="Pickup, delivery or transport mode…" /></label><label>Sort by<select value={routeSort} onChange={event => setRouteSort(event.target.value)}><option value="origin">Pickup</option><option value="destination">Delivery</option></select></label><label>Direction<select value={routeDirection} onChange={event => setRouteDirection(event.target.value as 'asc' | 'desc')}><option value="asc">A to Z</option><option value="desc">Z to A</option></select></label><small className="field-help">{visibleRoutes.length} of {routes.length} routes</small></div>
      <div className="table-wrap"><table><thead><tr><th>Pickup</th><th>Delivery</th><th>Modes and estimates</th><th>Actions</th></tr></thead><tbody>{visibleRoutes.map(route => <tr key={`${route.originLocationId}:${route.destinationLocationId}`}><td>{locationName(route.originLocationId)}</td><td>{locationName(route.destinationLocationId)}</td><td>{route.allowedModes.map(mode => { const range = route.estimatedDurations?.find(item => item.mode === mode); return `${mode}${range ? ` · Standard ${range.minDurationMinutes / 60}–${range.maxDurationMinutes / 60} h${range.minExpressDurationMinutes && range.maxExpressDurationMinutes ? ` · Express ${range.minExpressDurationMinutes / 60}–${range.maxExpressDurationMinutes / 60} h` : ''}` : ' · no estimate'}`; }).join(', ')}</td><td><button className="ghost small" onClick={() => editRoute(route)}>Edit</button></td></tr>)}{!visibleRoutes.length && <tr><td colSpan={4}>{routes.length ? 'No routes match your search.' : 'No supported routes configured yet.'}</td></tr>}</tbody></table></div>
    </section>
    {formOpen && <ModalDialog title={isEditing ? 'Edit supported route' : 'Add supported route'} description="Configure modes and estimated journey times for this direction." onClose={() => setFormOpen(false)}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="form-grid" onSubmit={save}>
        <label>Pickup location<select value={originId} onChange={event => setOriginId(event.target.value)} required><option value="">Choose a location</option>{locations.filter(item => item.active !== false).map(item => <option key={item.id} value={item.id}>{String(item.name)}{item.city ? ` · ${item.city}` : ''}</option>)}</select></label>
        <label>Delivery location<select value={destinationId} onChange={event => setDestinationId(event.target.value)} required><option value="">Choose a location</option>{locations.filter(item => item.active !== false && item.id !== originId).map(item => <option key={item.id} value={item.id}>{String(item.name)}{item.city ? ` · ${item.city}` : ''}</option>)}</select></label>
        <fieldset className="span-2 horse-picker"><legend>Supported modes</legend>{modes.map(mode => <label key={mode.value}><input type="checkbox" checked={allowedModes.includes(mode.value)} onChange={event => setAllowedModes(current => event.target.checked ? [...current, mode.value] : current.filter(value => value !== mode.value))} />{mode.label}</label>)}</fieldset>
        <div className="span-2"><h3>Estimated transport time</h3><p className="field-help">Optional range for each enabled mode. Customers see it as an estimate; Logistics confirms the arrival when planning the trip.</p></div>
        {modes.filter(mode => allowedModes.includes(mode.value)).map(mode => <div className="span-2 form-grid" key={mode.value}><b>{mode.label}</b><label>Standard minimum hours<input type="number" min="0.5" step="0.5" value={durationHours[mode.value]?.min ?? ''} onChange={event => setDurationHours(current => ({ ...current, [mode.value]: { min: event.target.value, max: current[mode.value]?.max ?? '' } }))} /></label><label>Standard maximum hours<input type="number" min="0.5" step="0.5" value={durationHours[mode.value]?.max ?? ''} onChange={event => setDurationHours(current => ({ ...current, [mode.value]: { min: current[mode.value]?.min ?? '', max: event.target.value } }))} /></label><label>Express minimum hours<input type="number" min="0.5" step="0.5" value={expressDurationHours[mode.value]?.min ?? ''} onChange={event => setExpressDurationHours(current => ({ ...current, [mode.value]: { min: event.target.value, max: current[mode.value]?.max ?? '' } }))} /></label><label>Express maximum hours<input type="number" min="0.5" step="0.5" value={expressDurationHours[mode.value]?.max ?? ''} onChange={event => setExpressDurationHours(current => ({ ...current, [mode.value]: { min: current[mode.value]?.min ?? '', max: event.target.value } }))} /></label><small className="field-help span-2">Set a Standard range first. Leave both Express fields blank for Standard only; Express is shown only when configured.</small></div>)}
        <p className="field-help span-2">Routes are directional. Configure the reverse direction separately when it is offered.</p>
        <div className="modal-actions span-2"><button type="button" className="ghost" onClick={() => setFormOpen(false)}>Cancel</button><button disabled={busy}>{busy ? 'Saving…' : 'Save route'}</button></div>
      </form>
    </ModalDialog>}
  </div>;
}
