import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { ApiError, api, login, logout, PaginationMeta, registerCustomer, restoreSession, User } from '../core/api';
import { action, addCheckpoint, addLeg, assignHorse, assignResource, assignStaff, createPlan, createTrip, deleteRow, getAssignments, getCheckpoints, getLegs, getTrip, getReadiness, getRoutePlanByTrip, getVersions, newVersion, RecordRow, ResourceName, RoutePlan, RouteVersion, saveRow, Trip, getRows, getBookingLocations, Location, getAllTrips, getStaffDirectory, StaffAccount } from '../features/planning/api';
import { deleteHorse, getHorse, getHorses, getManagerQueue, getProfile, getRequests, getRequest, Horse, RequestSummary, TransportRequest, reviewRequest, saveHorse, saveProfile, saveRequest, submitRequest, CustomerProfile, ComplianceDocument, DocumentType, getDocuments, getDocumentTypes, uploadDocumentFile, reviewDocument, ComplianceReadiness, evaluateCompliance, ClearanceCase, getClearanceCases, createClearanceCase, submitClearanceCase, reviewClearanceCase } from '../features/booking/api';
import OperationsView from '../features/operations/OperationsView';
import DashboardView from '../features/dashboard/DashboardView';
import './styles.css';

const allowedRoles = ['CUSTOMER', 'TRANSPORT_SPECIALIST', 'LOGISTICS_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'DRIVER', 'ESCORT', 'DRIVER_ESCORT', 'FLEET_ROUTE_COORDINATOR'];
type FleetField = { key: string; label: string; kind: 'text' | 'number' | 'boolean' | 'select' | 'datetime' | 'textarea' | 'generated'; required?: boolean; help?: string; min?: number; max?: number; step?: number; maxLength?: number; source?: 'countries' | 'airlines' | 'airports'; options?: { value: string; label: string }[]; defaultValue?: string };
type FleetResource = { key: ResourceName; title: string; description: string; columns: { key: string; label: string }[]; fields: FleetField[] };
const vehicleTypes = [
  { value: 'TRUCK', label: 'Horse transport truck' },
  { value: 'TRAILER', label: 'Horse trailer' },
  { value: 'VAN', label: 'Transport van' },
  { value: 'OTHER', label: 'Other vehicle' },
];
const vehicleStatuses = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'IN_USE', label: 'In use' },
  { value: 'MAINTENANCE', label: 'In maintenance' },
  { value: 'RETIRED', label: 'Retired' },
];
const locationTypes = [
  { value: 'STABLE', label: 'Stable / horse facility' },
  { value: 'AIRPORT', label: 'Airport' },
  { value: 'BORDER_CROSSING', label: 'Border crossing' },
  { value: 'QUARANTINE_STATION', label: 'Quarantine station' },
  { value: 'REST_STOP', label: 'Rest stop' },
  { value: 'FUEL_STOP', label: 'Fuel stop' },
  { value: 'CUSTOMER_SITE', label: 'Customer pickup / delivery' },
  { value: 'HANDOVER_POINT', label: 'Handover point' },
];
const fleet: FleetResource[] = [
  { key: 'vehicles', title: 'Vehicles', description: 'Transport vehicles used on road legs. The system creates an internal code; plate number is the vehicle registration plate.', columns: [{ key: 'vehicleCode', label: 'Internal code' }, { key: 'plateNumber', label: 'License plate' }, { key: 'vehicleType', label: 'Type' }, { key: 'horseCapacity', label: 'Horse capacity' }, { key: 'status', label: 'Availability' }], fields: [
    { key: 'vehicleCode', label: 'Internal vehicle code · assigned by the system', kind: 'generated' },
    { key: 'plateNumber', label: 'License plate number', kind: 'text', required: true, help: 'The registration plate shown on the vehicle.' },
    { key: 'vehicleType', label: 'Vehicle type', kind: 'select', options: vehicleTypes, required: true, defaultValue: 'TRUCK' },
    { key: 'horseCapacity', label: 'Horse capacity', kind: 'number', min: 1, step: 1, required: true, help: 'Maximum number of horses this vehicle can transport.' },
    { key: 'stallCapacity', label: 'Horse compartments (stalls)', kind: 'number', min: 1, step: 1, required: true, help: 'Number of separate horse compartments inside the vehicle.' },
    { key: 'temperatureControlled', label: 'Temperature controlled', kind: 'boolean', defaultValue: 'false' },
    { key: 'status', label: 'Availability status', kind: 'select', options: vehicleStatuses, required: true, defaultValue: 'AVAILABLE' },
  ] },
  { key: 'locations', title: 'Locations', description: 'Pickup, delivery, stable, airport, border, and rest-stop locations used in route plans.', columns: [{ key: 'name', label: 'Location' }, { key: 'locationType', label: 'Purpose' }, { key: 'address', label: 'Address' }, { key: 'city', label: 'City' }, { key: 'countryId', label: 'Country' }], fields: [
    { key: 'locationCode', label: 'Location code · assigned by the system', kind: 'generated' },
    { key: 'name', label: 'Location name', kind: 'text', required: true },
    { key: 'locationType', label: 'Location purpose', kind: 'select', options: locationTypes, required: true, defaultValue: 'CUSTOMER_SITE' },
    { key: 'address', label: 'Street address', kind: 'text', help: 'Use the full street address so the pickup or delivery site is recognizable.' },
    { key: 'city', label: 'City / town', kind: 'text' },
    { key: 'countryId', label: 'Country', kind: 'select', source: 'countries', required: true },
    { key: 'latitude', label: 'Latitude', kind: 'number', min: -90, max: 90, help: 'Decimal degrees, between -90 and 90.' },
    { key: 'longitude', label: 'Longitude', kind: 'number', min: -180, max: 180, help: 'Decimal degrees, between -180 and 180.' },
    { key: 'active', label: 'Available for planning', kind: 'boolean', defaultValue: 'true' },
  ] },
  { key: 'stalls', title: 'Horse compartments', description: 'A stall is a dedicated space a horse can be assigned to during a trip. It is not a stable address.', columns: [{ key: 'stallCode', label: 'Compartment code' }, { key: 'stallType', label: 'Compartment type' }, { key: 'capacity', label: 'Horse capacity' }, { key: 'active', label: 'Available' }], fields: [
    { key: 'stallCode', label: 'Compartment code · assigned by the system', kind: 'generated' },
    { key: 'stallType', label: 'Compartment type', kind: 'text', help: 'Optional description, for example single-horse compartment or quarantine stall.' },
    { key: 'capacity', label: 'Horse capacity', kind: 'number', min: 1, step: 1, required: true, help: 'How many horses can be assigned to this compartment.' },
    { key: 'active', label: 'Available for assignment', kind: 'boolean', defaultValue: 'true' },
    { key: 'notes', label: 'Notes', kind: 'textarea' },
  ] },
  { key: 'countries', title: 'Countries', description: 'Countries currently supported by the service. Locations and international compliance routes refer to these records.', columns: [{ key: 'isoCode', label: 'ISO code' }, { key: 'name', label: 'Country' }, { key: 'active', label: 'Supported' }], fields: [
    { key: 'isoCode', label: 'ISO 3166-1 alpha-2 code', kind: 'text', required: true, maxLength: 2, help: 'Two-letter country code, for example VN or SG.' },
    { key: 'name', label: 'Country name', kind: 'text', required: true },
    { key: 'active', label: 'Supported for routes', kind: 'boolean', defaultValue: 'true' },
  ] },
  { key: 'airlines', title: 'Airlines', description: 'Air carriers approved for horse cargo bookings. The airline code is the carrier code, not a system record ID.', columns: [{ key: 'airlineCode', label: 'Airline code' }, { key: 'name', label: 'Airline' }, { key: 'active', label: 'Available' }], fields: [
    { key: 'airlineCode', label: 'Airline code (IATA)', kind: 'text', required: true, maxLength: 3, help: 'Enter the carrier code, for example VN or SQ.' },
    { key: 'name', label: 'Airline name', kind: 'text', required: true },
    { key: 'active', label: 'Available for booking', kind: 'boolean', defaultValue: 'true' },
  ] },
  { key: 'flight-bookings', title: 'Flight bookings', description: 'A scheduled flight reservation used as a transport resource on an air route leg.', columns: [{ key: 'bookingReference', label: 'Booking reference' }, { key: 'airlineId', label: 'Airline' }, { key: 'flightNumber', label: 'Flight' }, { key: 'originAirportId', label: 'From' }, { key: 'destinationAirportId', label: 'To' }, { key: 'scheduledDepartureAt', label: 'Departure' }, { key: 'scheduledArrivalAt', label: 'Arrival' }], fields: [
    { key: 'bookingReference', label: 'Air cargo booking reference', kind: 'text', required: true },
    { key: 'airlineId', label: 'Airline', kind: 'select', source: 'airlines', required: true },
    { key: 'flightNumber', label: 'Flight number', kind: 'text', required: true },
    { key: 'originAirportId', label: 'Origin airport', kind: 'select', source: 'airports', required: true },
    { key: 'destinationAirportId', label: 'Destination airport', kind: 'select', source: 'airports', required: true },
    { key: 'scheduledDepartureAt', label: 'Scheduled departure', kind: 'datetime', required: true },
    { key: 'scheduledArrivalAt', label: 'Scheduled arrival', kind: 'datetime', required: true },
  ] },
];

function errorText(error: unknown) { return error instanceof Error ? error.message : 'Unexpected error'; }
const osmSearchUrl = (query: string) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value?: string | number | boolean; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return <label>{label}<input required={required} type={type === 'boolean' ? 'checkbox' : type} checked={type === 'boolean' ? Boolean(value) : undefined} value={type !== 'boolean' ? String(value ?? '') : undefined} onChange={e => onChange(type === 'boolean' ? String(e.target.checked) : e.target.value)} /></label>;
}

const emptyPagination: PaginationMeta = { page: 0, pageSize: 10, totalItems: 0, totalPages: 0 };

function Pagination({ value, onChange }: { value: PaginationMeta; onChange: (page: number, pageSize: number) => void }) {
  if (value.totalItems === 0) return null;
  return <div className="pagination"><span>{value.totalItems} item{value.totalItems === 1 ? '' : 's'}</span><div className="pagination-controls"><label>Rows<select aria-label="Rows per page" value={value.pageSize} onChange={e => onChange(0, Number(e.target.value))}><option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><button className="ghost small" disabled={value.page <= 0} onClick={() => onChange(value.page - 1, value.pageSize)}>Previous</button><b>Page {value.page + 1} of {Math.max(value.totalPages, 1)}</b><button className="ghost small" disabled={value.page + 1 >= value.totalPages} onClick={() => onChange(value.page + 1, value.pageSize)}>Next</button></div></div>;
}

function ListFilters({ query, status, statuses, placeholder, onQueryChange, onStatusChange, onSearch, onClear }: { query: string; status: string; statuses: string[]; placeholder: string; onQueryChange: (value: string) => void; onStatusChange: (value: string) => void; onSearch: () => void; onClear: () => void }) {
  return <form className="filter-bar" onSubmit={e => { e.preventDefault(); onSearch(); }}><label className="search-field"><span>Search</span><input value={query} onChange={e => onQueryChange(e.target.value)} placeholder={placeholder} /></label><label><span>Status</span><select value={status} onChange={e => onStatusChange(e.target.value)}><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label><div className="filter-actions"><button>Search</button>{(query || status) && <button type="button" className="ghost" onClick={onClear}>Clear</button>}</div></form>;
}

type NavGroup = { label: string; items: { id: string; label: string }[] };
function navigationFor(role: string): NavGroup[] {
  const manager = role === 'LOGISTICS_MANAGER';
  const complianceItems = [
    { id: 'Compliance documents', label: 'Documents' },
    { id: 'Compliance readiness', label: 'Trip readiness' },
    { id: 'Border clearance', label: 'Border clearance' },
  ].filter(item => item.id !== 'Compliance documents' || ['CUSTOMER', 'COMPLIANCE_OFFICER', 'ADMIN'].includes(role));
  if (role === 'CUSTOMER') return [
    { label: 'Booking', items: [{ id: 'My horses', label: 'My horses' }, { id: 'Transport requests', label: 'Transport requests' }] },
    { label: 'Compliance', items: complianceItems },
    { label: 'Journey', items: [{ id: 'Timeline', label: 'Trip timeline' }, { id: 'Tracking', label: 'Live tracking' }, { id: 'Health', label: 'Horse health' }, { id: 'Handover', label: 'Handover' }] },
    { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] },
  ];
  if (role === 'DRIVER' || role === 'ESCORT' || role === 'DRIVER_ESCORT') return [
    { label: 'Driver workspace', items: [
      { id: 'Execution', label: 'Assigned trips' },
      { id: 'Tracking', label: 'Live tracking' },
      { id: 'Incidents', label: 'Report an incident' },
      { id: 'Handover', label: 'Horse handover' },
    ] },
    { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] },
  ];
  if (role === 'ADMIN') return [
    { label: 'Administration', items: [{ id: 'Dashboard', label: 'Operations dashboard' }] },
    { label: 'Dispatch', items: [{ id: 'Request review', label: 'Transport requests' }] },
    { label: 'Planning', items: [{ id: 'Trips', label: 'Trips, routes & assignments' }, { id: 'Fleet', label: 'Fleet & reference data' }] },
    { label: 'Compliance', items: complianceItems },
    { label: 'Operations', items: ['Execution','Tracking','Health','Incidents','Handover','Route changes'].map(id => ({ id, label: id })) },
    { label: 'Reporting', items: [{ id: 'KPI & audit', label: 'KPI & audit' }] },
    { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] },
  ];
  if (manager) return [
    { label: 'Overview', items: [{ id: 'Dashboard', label: 'Dashboard' }] },
    { label: 'Dispatch', items: [{ id: 'Request review', label: 'Transport requests' }] },
    { label: 'Planning', items: [{ id: 'Trips', label: 'Trips, routes & assignments' }, { id: 'Fleet', label: 'Fleet & reference data' }] },
    { label: 'Compliance', items: complianceItems },
    { label: 'Operations', items: ['Execution','Tracking','Health','Incidents','Handover','Route changes'].map(id => ({ id, label: id })) },
    { label: 'Reporting', items: [{ id: 'KPI & audit', label: 'KPI & audit' }] },
    { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] },
  ];
  if (role === 'COMPLIANCE_OFFICER') return [{ label: 'Compliance', items: complianceItems }, { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] }];
  if (role === 'TRANSPORT_SPECIALIST' || role === 'FLEET_ROUTE_COORDINATOR') return [
    { label: 'Planning', items: [{ id: 'Trips', label: 'Trips, routes & assignments' }, { id: 'Fleet', label: 'Fleet & reference data' }] },
    { label: 'Compliance', items: complianceItems },
    { label: 'Operations', items: ['Execution','Tracking','Health','Incidents','Route changes'].map(id => ({ id, label: id })) },
    { label: 'Reporting', items: [{ id: 'KPI & audit', label: 'KPI & audit' }] }, { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] },
  ];
  return [{ label: 'Operations', items: ['Execution','Tracking','Health','Incidents','Handover'].map(id => ({ id, label: id })) }, { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] }];
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); const [phone, setPhone] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [page, setPage] = useState('Transport requests');
  const [focusedTripId, setFocusedTripId] = useState('');
  const [focusedHorseOptions, setFocusedHorseOptions] = useState<{ id: string; label: string }[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { restoreSession().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false)); }, []);
  async function signIn(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const account = await login(email, password); setUser(account); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function signUp(e: FormEvent) {
    e.preventDefault(); setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const account = await registerCustomer({ email: email.trim(), password, fullName: fullName.trim(), phone: phone.trim() || undefined });
      setUser(account);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  function changeAuthMode(mode: 'login' | 'register') {
    setAuthMode(mode); setError(''); setPassword(''); setConfirmPassword('');
  }
  async function signOut() { await logout(); setUser(null); }
  function openTripForPlanning(tripId: string, horses: { id: string; label: string }[]) { setFocusedTripId(tripId); setFocusedHorseOptions(horses); setPage('Trips'); }
  if (checking) return <main className="center"><p>Restoring secure session…</p></main>;
  if (!user) return <main className="center"><section className="login panel"><div className="brand">Equi<span>Route</span></div><div className="auth-tabs" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'active' : 'ghost'} onClick={() => changeAuthMode('login')}>Sign in</button><button type="button" role="tab" aria-selected={authMode === 'register'} className={authMode === 'register' ? 'active' : 'ghost'} onClick={() => changeAuthMode('register')}>Create account</button></div>{authMode === 'login' ? <form className="auth-form" onSubmit={signIn}><div><h1>Welcome back</h1><p>Sign in with your customer or operations account.</p></div>{error && <p className="auth-error" role="alert">{error}</p>}<Input label="Email" value={email} onChange={setEmail} type="email" required /><Input label="Password" value={password} onChange={setPassword} type="password" required /><button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><p className="auth-switch">New to EquiRoute? <button type="button" onClick={() => changeAuthMode('register')}>Create an account</button></p></form> : <form className="auth-form" onSubmit={signUp}><div><h1>Create customer account</h1><p>Register to manage horses and transport requests.</p></div>{error && <p className="auth-error" role="alert">{error}</p>}<Input label="Full name" value={fullName} onChange={setFullName} required /><Input label="Email" value={email} onChange={setEmail} type="email" required /><Input label="Phone (optional)" value={phone} onChange={setPhone} type="tel" /><label>Password<span className="field-hint">Use at least 12 characters</span><input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><Input label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} type="password" required /><button disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button><p className="auth-switch">Already have an account? <button type="button" onClick={() => changeAuthMode('login')}>Sign in</button></p></form>}</section></main>;
  if (!allowedRoles.includes(user.role.toUpperCase())) return <main className="center"><section className="panel"><h1>Workspace access unavailable</h1><p>Your account role ({user.role}) has no matching workspace.</p><button onClick={signOut}>Sign out</button></section></main>;
  const role = user.role.toUpperCase();
  const groups = navigationFor(role);
  const pages = groups.flatMap(group => group.items.map(item => item.id));
  const activePage = pages.includes(page) ? page : pages[0];
  const operationSection = activePage === 'Timeline' ? 'Execution' : activePage as 'Execution' | 'Tracking' | 'Health' | 'Incidents' | 'Handover' | 'Notifications' | 'Route changes' | 'KPI & audit';
  const complianceSection = activePage === 'Compliance documents' ? 'documents' : activePage === 'Compliance readiness' ? 'readiness' : activePage === 'Border clearance' ? 'clearance' : null;
  return <div className="shell"><aside><div className="brand">Equi<span>Route</span><small>TRANSPORT OPERATIONS</small></div><nav className="nav" aria-label="Main navigation">{groups.map(group => <div className="nav-group" key={group.label}><div className="nav-group-title">{group.label}</div>{group.items.map(item => <button key={item.id} className={activePage === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><span className="nav-dot" />{item.label}</button>)}</div>)}</nav><button className="profile" onClick={() => role === 'CUSTOMER' && setProfileOpen(true)} aria-label={role === 'CUSTOMER' ? 'Open customer profile' : undefined}><div className="avatar">{user.fullName.slice(0,1).toUpperCase()}</div><div><b>{user.fullName}</b><small>{user.role}</small></div></button></aside><div className="workspace"><header><div><p>EquiRoute · Transport operations</p><h1>{activePage}</h1></div><div className="header-actions"><span className="account">{user.email}</span>{role === 'CUSTOMER' && <button className="profile-icon" onClick={() => setProfileOpen(true)} aria-label="Edit customer profile" title="Customer profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" /></svg></button>}<button className="ghost" onClick={signOut}>Sign out</button></div></header>{error && <div className="banner error">{error}<button className="ghost" onClick={() => setError('')}>Dismiss</button></div>}{notice && <div className="banner success">{notice}<button className="ghost" onClick={() => setNotice('')}>Dismiss</button></div>}{activePage === 'Dashboard' ? <DashboardView userName={user.fullName} report={setError} /> : activePage === 'Trips' ? <TripsView focusTripId={focusedTripId} focusHorseOptions={focusedHorseOptions} report={setError} notify={setNotice} /> : activePage === 'Fleet' ? <FleetView report={setError} notify={setNotice} /> : activePage === 'Request review' ? <ReviewView onOpenTrip={openTripForPlanning} report={setError} notify={setNotice} /> : activePage === 'My horses' ? <BookingView section="horses" report={setError} notify={setNotice} /> : activePage === 'Transport requests' ? <BookingView section="requests" report={setError} notify={setNotice} /> : complianceSection ? <ComplianceView section={complianceSection} role={role} report={setError} notify={setNotice} /> : <OperationsView section={operationSection} role={role} report={setError} notify={setNotice} />}{profileOpen && <CustomerProfileModal user={user} onClose={() => setProfileOpen(false)} report={setError} notify={setNotice} />}</div></div>;
}

function CustomerProfileModal({ user, onClose, report, notify }: { user: User; onClose: () => void; report: (s: string) => void; notify: (s: string) => void }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  useEffect(() => { getProfile().then(setProfile).catch(e => { if (!(e instanceof ApiError && e.status === 404)) report(errorText(e)); }).finally(() => setLoading(false)); }, [report]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  async function save(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); report(''); setBusy(true); try { setProfile(await saveProfile({ name: String(f.get('name')), customerType: String(f.get('customerType')), contactPerson: String(f.get('contactPerson') || ''), phone: String(f.get('phone') || ''), address: String(f.get('address') || ''), countryId: String(f.get('countryId') || '') || undefined, versionNo: profile?.versionNo })); report(''); notify('Customer profile saved.'); onClose(); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="panel-title"><div><h2 id="profile-title">Customer profile</h2><p>Account and contact details used for bookings.</p></div><button className="icon-close ghost" onClick={onClose} aria-label="Close profile">×</button></div>{loading ? <p className="modal-loading">Loading profile…</p> : <><section className="profile-account" aria-label="Registered account information"><h3>Registered account</h3><div className="profile-account-grid"><div><small>Full name</small><b>{user.fullName}</b></div><div><small>Email</small><b>{user.email}</b></div></div></section><form className="form-grid profile-form" key={`${profile?.id ?? 'new'}-${profile?.versionNo ?? 0}`} onSubmit={save}><h3>Booking profile</h3><label>Customer name<input name="name" defaultValue={profile?.name ?? user.fullName} required /></label><label>Customer type<select name="customerType" defaultValue={profile?.customerType ?? 'INDIVIDUAL_OWNER'}><option value="INDIVIDUAL_OWNER">Individual</option><option value="CLUB">Club</option><option value="BREEDER">Breeder</option><option value="AGENT">Agent</option></select></label><label>Contact person<input name="contactPerson" defaultValue={profile?.contactPerson ?? user.fullName} /></label><label>Phone<input name="phone" type="tel" defaultValue={profile?.phone ?? ''} /></label><label className="span-2">Address<input name="address" defaultValue={profile?.address ?? ''} /></label><label>Country ID<input name="countryId" defaultValue={profile?.countryId ?? ''} /></label><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div></form></>}</section></div>;
}

function ActionModal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="action-modal-title"><div className="panel-title"><div><h2 id="action-modal-title">{title}</h2><p>{description}</p></div><button className="icon-close ghost" onClick={onClose} aria-label={`Close ${title}`}>×</button></div>{children}</section></div>;
}

function BookingView({ section, report, notify }: { section: 'horses' | 'requests'; report: (s: string) => void; notify: (s: string) => void }) {
  const [horses, setHorses] = useState<Horse[]>([]); const [requests, setRequests] = useState<RequestSummary[]>([]); const [busy, setBusy] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]); const [requestHorseIds, setRequestHorseIds] = useState<string[]>([]); const [originLocationId, setOriginLocationId] = useState(''); const [destinationLocationId, setDestinationLocationId] = useState(''); const [osmAddressQuery, setOsmAddressQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null); const [horseDetailLoading, setHorseDetailLoading] = useState(false);
  const [horsePagination, setHorsePagination] = useState(emptyPagination); const [requestPagination, setRequestPagination] = useState(emptyPagination);
  const [horseQuery, setHorseQuery] = useState(''); const [horseSearch, setHorseSearch] = useState(''); const [horseStatus, setHorseStatus] = useState('');
  const [requestQuery, setRequestQuery] = useState(''); const [requestSearch, setRequestSearch] = useState(''); const [requestStatus, setRequestStatus] = useState('');
  const reload = useCallback(async () => { try { if (section === 'horses') { const result = await getHorses(horsePagination.page, horsePagination.pageSize, horseSearch, horseStatus); setHorses(result.data); setHorsePagination(result.pagination); } else { const [h, r, l] = await Promise.all([getHorses(0, 100), getRequests(requestPagination.page, requestPagination.pageSize, requestSearch, requestStatus), getBookingLocations()]); setHorses(h.data); setRequests(r.data); setRequestPagination(r.pagination); setLocations(l.data.filter(location => location.active)); } } catch (e) { report(errorText(e)); } }, [section, horsePagination.page, horsePagination.pageSize, horseSearch, horseStatus, requestPagination.page, requestPagination.pageSize, requestSearch, requestStatus, report]);
  useEffect(() => { void reload(); }, [reload]);
  async function createHorse(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); report(''); setBusy(true); try { await saveHorse({ horseName: String(f.get('horseName')), registrationNumber: String(f.get('registrationNumber') || ''), passportNumber: String(f.get('passportNumber') || ''), breed: String(f.get('breed') || ''), sex: String(f.get('sex') || ''), dateOfBirth: String(f.get('dateOfBirth') || '') || undefined, color: String(f.get('color') || ''), specialRequirements: String(f.get('specialRequirements') || '') }); form.reset(); setCreateOpen(false); report(''); notify('Horse registered.'); await reload(); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  async function openHorseDetails(id: string) { setHorseDetailLoading(true); report(''); try { setSelectedHorse(await getHorse(id)); } catch (e) { report(errorText(e)); } finally { setHorseDetailLoading(false); } }
  async function createRequest(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); if (!requestHorseIds.length) { report('Select at least one horse for this transport request.'); return; } setBusy(true); report(''); try { const request = await saveRequest({ originLocationId: String(f.get('originLocationId')), destinationLocationId: String(f.get('destinationLocationId')), requestedDepartureAt: new Date(String(f.get('requestedDepartureAt'))).toISOString(), requestedArrivalAt: String(f.get('requestedArrivalAt')) ? new Date(String(f.get('requestedArrivalAt')) as string).toISOString() : undefined, preferredTransportMode: String(f.get('preferredTransportMode') || ''), notes: String(f.get('notes') || ''), horseIds: requestHorseIds }); await submitRequest(request.id); form.reset(); setRequestHorseIds([]); setOriginLocationId(''); setDestinationLocationId(''); setCreateOpen(false); report(''); notify('Request submitted for review.'); await reload(); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  if (section === 'horses') return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>My horses</h2><p>Register and manage horses available for transport requests.</p></div><div className="header-actions"><span className="result-count">{horsePagination.totalItems} registered</span><button onClick={() => setCreateOpen(true)}>+ Register horse</button></div></div><ListFilters query={horseQuery} status={horseStatus} statuses={['ACTIVE','INACTIVE','RETIRED']} placeholder="Name, code, registration or passport…" onQueryChange={setHorseQuery} onStatusChange={value => { setHorseStatus(value); setHorsePagination(p => ({ ...p, page: 0 })); }} onSearch={() => { setHorseSearch(horseQuery.trim()); setHorsePagination(p => ({ ...p, page: 0 })); }} onClear={() => { setHorseQuery(''); setHorseSearch(''); setHorseStatus(''); setHorsePagination(p => ({ ...p, page: 0 })); }} /><div className="assignment-list">{horses.map(h => <div className="assignment-row" key={h.id}><button className="horse-details-trigger" onClick={() => void openHorseDetails(h.id)} disabled={horseDetailLoading}><b>{h.horseName}</b><small>{h.horseCode} · {h.status}{h.breed ? ` · ${h.breed}` : ''}</small></button><button className="danger small" onClick={async () => { if (!window.confirm(`Remove ${h.horseName} from your horse registry?`)) return; report(''); try { await deleteHorse(h.id); if (horses.length === 1 && horsePagination.page > 0) setHorsePagination(p => ({ ...p, page: p.page - 1 })); else await reload(); report(''); notify('Horse removed.'); } catch (e) { report(errorText(e)); } }}>Delete</button></div>)}{!horses.length && <div className="empty-state">No horses match the current filters.</div>}</div><Pagination value={horsePagination} onChange={(page, pageSize) => setHorsePagination(p => ({ ...p, page, pageSize }))} /></section>{selectedHorse && <ActionModal title={selectedHorse.horseName} description={`${selectedHorse.horseCode} · ${selectedHorse.status}`} onClose={() => setSelectedHorse(null)}><div className="detail-grid">{[['Registration no.', selectedHorse.registrationNumber], ['Passport no.', selectedHorse.passportNumber], ['Breed', selectedHorse.breed], ['Sex', selectedHorse.sex], ['Date of birth', selectedHorse.dateOfBirth ? new Date(`${selectedHorse.dateOfBirth}T00:00:00`).toLocaleDateString() : '—'], ['Color', selectedHorse.color], ['Country of origin ID', selectedHorse.countryOfOriginId], ['Special requirements', selectedHorse.specialRequirements], ['Record version', String(selectedHorse.versionNo)]].map(([label, value]) => <div className="detail-field" key={label}><small>{label}</small><b>{value || '—'}</b></div>)}</div><div className="modal-actions"><button className="ghost" onClick={() => setSelectedHorse(null)}>Close</button></div></ActionModal>}{createOpen && <ActionModal title="Register a horse" description="Add identity and care details before booking transport." onClose={() => setCreateOpen(false)}><form className="form-grid" onSubmit={createHorse}><label>Horse name<input name="horseName" placeholder="e.g. Thunder Bay" autoFocus required /></label><label>Registration no.<input name="registrationNumber" placeholder="e.g. VN-RH-2026-001" /></label><label>Passport no.<input name="passportNumber" placeholder="e.g. HPA-123456" /></label><label>Breed<input name="breed" placeholder="e.g. Thoroughbred" /></label><label>Sex<input name="sex" placeholder="e.g. Mare, stallion or gelding" /></label><label>Date of birth<input name="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} /></label><label>Color<input name="color" placeholder="e.g. Bay" /></label><label className="span-2">Special requirements<input name="specialRequirements" placeholder="e.g. Temperature control, extra rest stops" /></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => setCreateOpen(false)}>Cancel</button><button disabled={busy}>{busy ? 'Registering…' : 'Register horse'}</button></div></form></ActionModal>}</div>;
  return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>Transport requests</h2><p>Track drafts and requests sent for review.</p></div><div className="header-actions"><button className="ghost" onClick={() => void reload()}>Refresh</button><button disabled={!horses.length || !locations.length} onClick={() => { setRequestHorseIds([]); setOriginLocationId(''); setDestinationLocationId(''); setOsmAddressQuery(''); setCreateOpen(true); }}>+ New request</button></div></div>{!horses.length && <p className="form-hint">Register at least one horse before creating a request.</p>}{!locations.length && <p className="form-hint">No active pickup or destination locations are available yet. Ask Logistics to register the locations first.</p>}<ListFilters query={requestQuery} status={requestStatus} statuses={['DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFORMATION','APPROVED','REJECTED']} placeholder="Search request number…" onQueryChange={setRequestQuery} onStatusChange={value => { setRequestStatus(value); setRequestPagination(p => ({ ...p, page: 0 })); }} onSearch={() => { setRequestSearch(requestQuery.trim()); setRequestPagination(p => ({ ...p, page: 0 })); }} onClear={() => { setRequestQuery(''); setRequestSearch(''); setRequestStatus(''); setRequestPagination(p => ({ ...p, page: 0 })); }} /><div className="table-wrap"><table><thead><tr><th>Request</th><th>Status</th><th>Departure</th><th>Horses</th></tr></thead><tbody>{requests.map(r => <tr key={r.id}><td>{r.requestNo}</td><td><em>{r.status}</em></td><td>{new Date(r.requestedDepartureAt).toLocaleString()}</td><td>{r.horseCount}</td></tr>)}{!requests.length && <tr><td colSpan={4}>No requests match the current filters.</td></tr>}</tbody></table></div><Pagination value={requestPagination} onChange={(page, pageSize) => setRequestPagination(p => ({ ...p, page, pageSize }))} /></section>{createOpen && <ActionModal title="New transport request" description="Select the real pickup and delivery sites, then choose the horses for this trip." onClose={() => setCreateOpen(false)}><form className="form-grid" onSubmit={createRequest}><label>Pickup address<select name="originLocationId" autoFocus required value={originLocationId} onChange={event => setOriginLocationId(event.target.value)}><option value="" disabled>Select a saved location</option>{locations.map(location => <option key={location.id} value={location.id} disabled={location.id === destinationLocationId}>{location.name}{location.address ? ` · ${location.address}` : ''}{location.city ? `, ${location.city}` : ''}</option>)}</select></label><label>Delivery address<select name="destinationLocationId" required value={destinationLocationId} onChange={event => setDestinationLocationId(event.target.value)}><option value="" disabled>Select a saved location</option>{locations.map(location => <option key={location.id} value={location.id} disabled={location.id === originLocationId}>{location.name}{location.address ? ` · ${location.address}` : ''}{location.city ? `, ${location.city}` : ''}</option>)}</select></label><p className="location-help span-2">{originLocationId && <a href={osmSearchUrl([locations.find(location => location.id === originLocationId)?.name, locations.find(location => location.id === originLocationId)?.address, locations.find(location => location.id === originLocationId)?.city].filter(Boolean).join(', '))} target="_blank" rel="noreferrer">Check pickup on OpenStreetMap</a>}{originLocationId && destinationLocationId ? ' · ' : ''}{destinationLocationId && <a href={osmSearchUrl([locations.find(location => location.id === destinationLocationId)?.name, locations.find(location => location.id === destinationLocationId)?.address, locations.find(location => location.id === destinationLocationId)?.city].filter(Boolean).join(', '))} target="_blank" rel="noreferrer">Check destination on OpenStreetMap</a>}<span> · © OpenStreetMap contributors. Routing uses the saved site.</span></p><div className="location-search span-2"><label>Search for another address on OpenStreetMap<input value={osmAddressQuery} onChange={event => setOsmAddressQuery(event.target.value)} placeholder="Type a stable, farm, airport, or town" /></label><a className={`ghost ${!osmAddressQuery.trim() ? 'disabled-link' : ''}`} href={osmAddressQuery.trim() ? osmSearchUrl(osmAddressQuery.trim()) : undefined} target="_blank" rel="noreferrer" aria-disabled={!osmAddressQuery.trim()}>Search map</a><small className="field-help">New addresses must first be registered as a saved location by Logistics before they can be used for routing.</small></div><label>Departure<input name="requestedDepartureAt" type="datetime-local" required /></label><label>Expected arrival<input name="requestedArrivalAt" type="datetime-local" /></label><label>Mode<select name="preferredTransportMode" defaultValue="ROAD"><option value="ROAD">Road</option><option value="AIR">Air</option><option value="MIXED">Road + air</option></select></label><fieldset className="horse-picker span-2"><legend>Horses for this request <span>Select at least one</span></legend>{horses.map(horse => <label key={horse.id}><input type="checkbox" checked={requestHorseIds.includes(horse.id)} onChange={event => setRequestHorseIds(current => event.target.checked ? [...current, horse.id] : current.filter(id => id !== horse.id))} /><span><b>{horse.horseName}</b><small>{horse.horseCode}{horse.breed ? ` · ${horse.breed}` : ''}</small></span></label>)}</fieldset><label className="span-2">Notes<input name="notes" /></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => setCreateOpen(false)}>Cancel</button><button disabled={busy || !requestHorseIds.length || !locations.length}>{busy ? 'Submitting…' : 'Create & submit request'}</button></div></form></ActionModal>}</div>;
}

function ReviewView({ report, notify, onOpenTrip }: { report: (s: string) => void; notify: (s: string) => void; onOpenTrip: (tripId: string, horses: { id: string; label: string }[]) => void }) {
  const [queue, setQueue] = useState<RequestSummary[]>([]); const [selected, setSelected] = useState<TransportRequest | null>(null); const [reason, setReason] = useState(''); const [pagination, setPagination] = useState(emptyPagination);
  const [tripCreationBusy, setTripCreationBusy] = useState(false);
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [locations, setLocations] = useState<Location[]>([]);
  const reload = useCallback(async () => { try { const result = await getManagerQueue(pagination.page, pagination.pageSize, search, status); setQueue(result.data); setPagination(result.pagination); } catch (e) { report(errorText(e)); } }, [pagination.page, pagination.pageSize, search, status, report]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { getBookingLocations(0, 100).then(result => setLocations(result.data)).catch(e => report(errorText(e))); }, [report]);
  async function runReview(actionName: 'start-review' | 'request-information' | 'approve' | 'reject') { if (!selected) return; try { const decisionReason = actionName === 'approve' ? reason.trim() || 'Request approved after manager review.' : reason; const updated = await reviewRequest(selected.id, actionName, decisionReason); setSelected(updated); setReason(''); notify(actionName === 'start-review' ? 'Request taken into dispatch.' : actionName === 'approve' ? 'Transport order created from the approved request.' : `Request ${actionName.replace('-', ' ')} completed.`); await reload(); } catch (e) { report(errorText(e)); } }
  async function createTripForSelectedOrder() { if (!selected?.orderId) return; setTripCreationBusy(true); try { const trip = await createTrip(selected.orderId); const horses = selected.horses?.length ? selected.horses.map(horse => ({ id: horse.id, label: `${horse.horseName} · ${horse.horseCode}` })) : selected.horseIds.map((id, index) => ({ id, label: `Horse ${index + 1} · ${id}` })); notify(`Trip ${trip.tripNo} is ready for route planning and staff assignment.`); onOpenTrip(trip.id, horses); } catch (e) { report(errorText(e)); } finally { setTripCreationBusy(false); } }
  const locationDescription = (id?: string) => { if (!id) return 'Not set'; const location = locations.find(item => item.id === id); return location ? [location.name, location.address, location.city].filter(Boolean).join(' · ') : id; };
  const selectedStatus = selected?.status.toUpperCase();
  return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>Transport request queue</h2><p>Take new requests into dispatch. Ask for changes only when information is missing; approving a request creates its transport order.</p></div><button className="ghost" onClick={() => void reload()}>Refresh</button></div><ListFilters query={query} status={status} statuses={['SUBMITTED','UNDER_REVIEW']} placeholder="Search request number…" onQueryChange={setQuery} onStatusChange={value => { setStatus(value); setPagination(p => ({ ...p, page: 0 })); }} onSearch={() => { setSearch(query.trim()); setPagination(p => ({ ...p, page: 0 })); }} onClear={() => { setQuery(''); setSearch(''); setStatus(''); setPagination(p => ({ ...p, page: 0 })); }} /><div className="table-wrap"><table><thead><tr><th>Request</th><th>Status</th><th>Departure</th><th>Horses</th><th /></tr></thead><tbody>{queue.map(item => <tr key={item.id}><td>{item.requestNo}</td><td><em>{item.status}</em></td><td>{new Date(item.requestedDepartureAt).toLocaleString()}</td><td>{item.horseCount}</td><td><button className="ghost small" onClick={async () => { try { setSelected(await getRequest(item.id, true)); setReason(''); } catch (e) { report(errorText(e)); } }}>{item.status.toUpperCase() === 'SUBMITTED' ? 'Take request' : 'Continue'}</button></td></tr>)}{!queue.length && <tr><td colSpan={5}>No requests need dispatch action.</td></tr>}</tbody></table></div><Pagination value={pagination} onChange={(page, pageSize) => setPagination(p => ({ ...p, page, pageSize }))} /></section>{selected && <section className="panel"><div className="panel-title"><div><h2>{selected.requestNo}</h2><p>Requested by the horse owner (customer account) · {selected.status}</p></div><button className="ghost" onClick={() => setSelected(null)}>Close</button></div><p>Pickup: {locationDescription(selected.originLocationId)}{selected.originLocationId && <a className="subtle" href={osmSearchUrl(locationDescription(selected.originLocationId))} target="_blank" rel="noreferrer"> · View map</a>}</p><p>Delivery: {locationDescription(selected.destinationLocationId)}{selected.destinationLocationId && <a className="subtle" href={osmSearchUrl(locationDescription(selected.destinationLocationId))} target="_blank" rel="noreferrer"> · View map</a>}</p><p>Horses selected by owner: {selected.horses?.length ? selected.horses.map(horse => `${horse.horseName} · ${horse.horseCode}`).join(', ') : selected.horseIds.join(', ') || 'none'}</p><p>{selected.specialRequirements || selected.notes || 'No additional notes.'}</p>{selectedStatus === 'SUBMITTED' && <><p className="field-help">Take ownership of this request to handle it. After that, you can request missing information or approve it and create the transport order.</p><button onClick={() => void runReview('start-review')}>Take request</button></>}{selectedStatus === 'UNDER_REVIEW' && <><label>Decision note <span className="field-hint">Required when requesting information or declining; optional when approving</span><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} /></label><div className="header-actions" style={{ marginTop: 14 }}><button className="ghost" disabled={!reason.trim()} onClick={() => void runReview('request-information')}>Ask for missing information</button><button onClick={() => void runReview('approve')}>Approve & create transport order</button><button className="danger" disabled={!reason.trim()} onClick={() => void runReview('reject')}>Decline request</button></div></>}{selectedStatus === 'APPROVED' && <div className="notice-card"><b>Transport order created{selected.orderNo ? ` · ${selected.orderNo}` : ''}.</b><p>The horse owner is the customer who submitted this transport request. Continue to create the trip and assign route resources and staff.</p>{selected.orderId && <button disabled={tripCreationBusy} onClick={() => void createTripForSelectedOrder()}>{tripCreationBusy ? 'Opening planning…' : 'Create trip & continue to planning'}</button>}</div>}</section>}</div>;
}

function ComplianceView({ section, role, report, notify }: { section: 'documents' | 'readiness' | 'clearance'; role: string; report: (s: string) => void; notify: (s: string) => void }) {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [readiness, setReadiness] = useState<ComplianceReadiness | null>(null);
  const [clearances, setClearances] = useState<ClearanceCase[]>([]);
  const [tripChoices, setTripChoices] = useState<Trip[]>([]);
  const [tripChoicesLoading, setTripChoicesLoading] = useState(false);
  const [complianceTripId, setComplianceTripId] = useState('');
  const [actionOpen, setActionOpen] = useState<'upload' | 'clearance' | null>(null);
  const [ownedHorses, setOwnedHorses] = useState<Horse[]>([]);
  const [ownedRequests, setOwnedRequests] = useState<TransportRequest[]>([]);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState('');
  const [documentHorseId, setDocumentHorseId] = useState('');
  const [documentRequestId, setDocumentRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const reviewer = role === 'COMPLIANCE_OFFICER' || role === 'ADMIN';
  const canUpload = role === 'CUSTOMER';
  const documentScope = (types.find(type => type.id === selectedDocumentTypeId)?.scope ?? '').toLowerCase();
  const scopeHasHorse = documentScope === 'horse' || documentScope === 'request';
  const scopeHasRequest = documentScope === 'request';
  const scopeHasTrip = documentScope === 'trip';
  const requestsForSelectedHorse = ownedRequests.filter(request => !documentHorseId || request.horseIds.includes(documentHorseId));

  const reloadDocuments = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([getDocumentTypes(), getDocuments()]);
      setTypes(t);
      setDocuments(d);
      if (role === 'CUSTOMER') {
        const [horsePage, requestPage] = await Promise.all([getHorses(0, 100), getRequests(0, 100)]);
        setOwnedHorses(horsePage.data);
        const details = await Promise.all(requestPage.data.map(item => getRequest(item.id)));
        setOwnedRequests(details);
      }
    } catch (e) {
      report(errorText(e));
    }
  }, [report, role]);

  useEffect(() => {
    if (section === 'documents') void reloadDocuments();
  }, [section, reloadDocuments]);

  useEffect(() => {
    if (!['readiness', 'clearance'].includes(section) || role === 'CUSTOMER') return;
    let cancelled = false;
    setTripChoicesLoading(true);
    getAllTrips().then(rows => { if (!cancelled) setTripChoices(rows); })
      .catch(e => { if (!cancelled) report(errorText(e)); })
      .finally(() => { if (!cancelled) setTripChoicesLoading(false); });
    return () => { cancelled = true; };
  }, [section, role, report]);

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const file = form.get('file');
      if (!(file instanceof File) || !file.size) throw new Error('Choose a document file first.');
      const payload = new FormData();
      payload.set('file', file);
      payload.set('documentTypeId', String(form.get('documentTypeId')));
      for (const key of ['horseId', 'requestId', 'tripId', 'issueDate', 'expiryDate', 'issuingAuthority']) {
        const value = String(form.get(key) ?? '');
        if (value) payload.set(key, value);
      }
      await uploadDocumentFile(payload);
      formElement.reset();
      setActionOpen(null);
      notify('Compliance document uploaded.');
      await reloadDocuments();
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function evaluate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      setReadiness(await evaluateCompliance({
        tripId: String(f.get('tripId')),
        originCountryId: String(f.get('originCountryId')),
        destinationCountryId: String(f.get('destinationCountryId')),
        horseIds: String(f.get('horseIds') || '').split(/[ ,]+/).filter(Boolean),
        plannedDepartureDate: String(f.get('plannedDepartureDate') || '') || undefined,
      }));
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadClearances(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      setClearances(await getClearanceCases(String(f.get('tripId'))));
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function makeClearance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const f = new FormData(formElement);
    setBusy(true);
    try {
      const row = await createClearanceCase({
        tripId: String(f.get('tripId')),
        countryId: String(f.get('countryId')),
        authorityName: String(f.get('authorityName')),
        referenceNumber: String(f.get('referenceNumber') || ''),
        notes: String(f.get('notes') || ''),
      });
      setClearances(rows => [row, ...rows]);
      formElement.reset();
      setActionOpen(null);
      notify('Clearance case created.');
    } catch (e) {
      report(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (section === 'documents') {
    return <div className="stack">
      <section className="panel">
        <div className="panel-title">
          <div><h2>Compliance documents</h2><p>Upload horse, request or trip evidence and track review status.</p></div>
          <div className="header-actions"><button className="ghost" onClick={() => void reloadDocuments()}>Refresh</button>{canUpload && <button onClick={() => setActionOpen('upload')}>+ Upload evidence</button>}</div>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Document</th><th>Type</th><th>Scope</th><th>Entity</th><th>Status</th><th>Expiry</th><th /></tr></thead><tbody>
          {documents.map(d => <tr key={d.id}><td>{d.documentNo}<small className="subtle">{d.fileName}</small></td><td>{d.documentTypeName ?? d.documentTypeId}</td><td>{d.horseId ? 'Horse' : d.tripId ? 'Trip' : d.requestId ? 'Request' : '—'}</td><td className="mono">{d.horseId ?? d.tripId ?? d.requestId ?? '—'}</td><td><em>{d.status}</em></td><td>{d.expiryDate ?? '—'}</td><td>{reviewer && <span className="header-actions"><button className="small" onClick={async () => { try { await reviewDocument(d.id, 'APPROVED', ''); notify('Document approved.'); await reloadDocuments(); } catch (e) { report(errorText(e)); } }}>Approve</button><button className="danger small" onClick={async () => { const comment = window.prompt('Reason for rejection:'); if (!comment?.trim()) return; try { await reviewDocument(d.id, 'REJECTED', comment); notify('Document rejected.'); await reloadDocuments(); } catch (e) { report(errorText(e)); } }}>Reject</button></span>}</td></tr>)}
          {!documents.length && <tr><td colSpan={7}>No compliance documents found.</td></tr>}
        </tbody></table></div>
      </section>
      {actionOpen === 'upload' && canUpload && <ActionModal title="Upload compliance evidence" description="Choose the document type first. The form then asks only for the related horse, request, or trip." onClose={() => setActionOpen(null)}>
        <form className="form-grid" onSubmit={upload}>
          <label>Document type<select name="documentTypeId" required value={selectedDocumentTypeId} onChange={event => { setSelectedDocumentTypeId(event.target.value); setDocumentHorseId(''); setDocumentRequestId(''); }}><option value="" disabled>Select type</option>{types.map(t => <option key={t.id} value={t.id}>{t.name} · {t.scope}</option>)}</select></label>
          {scopeHasHorse && (role === 'CUSTOMER' ? <label>Horse<select name="horseId" required value={documentHorseId} onChange={event => { setDocumentHorseId(event.target.value); setDocumentRequestId(''); }}><option value="">Select your horse</option>{ownedHorses.map(horse => <option key={horse.id} value={horse.id}>{horse.horseName} · {horse.horseCode}</option>)}</select></label> : <label>Horse ID<input name="horseId" /></label>)}
          {scopeHasRequest && (role === 'CUSTOMER' ? <label>Related request<select name="requestId" required value={documentRequestId} onChange={event => setDocumentRequestId(event.target.value)}><option value="">Select a request for this horse</option>{requestsForSelectedHorse.map(request => <option key={request.id} value={request.id}>{request.requestNo} · {request.status}</option>)}</select></label> : <label>Related request ID<input name="requestId" /></label>)}
          {scopeHasTrip && <label>Trip ID<input name="tripId" placeholder="Use the trip ID from the transport confirmation" required /><small className="field-help">The approved request creates a transport order, and the trip is linked to that order. Enter the Trip ID from the approved transport details; this customer view does not yet list trips automatically.</small></label>}
          {scopeHasRequest && role === 'CUSTOMER' && <p className="field-help span-2">Request choices are limited to requests that include the selected horse.</p>}
          <label>Issue date <span className="field-hint">Date printed on the document</span><input name="issueDate" type="date" /></label><label>Expiry date <span className="field-hint">Last day the document is valid</span><input name="expiryDate" type="date" /></label>
          <label>Issued by <span className="field-hint">Example: FEI or government veterinary authority</span><input name="issuingAuthority" placeholder="Name of the organization that issued it" /></label><label className="span-2">Evidence file (PDF or photo)<input name="file" type="file" accept="application/pdf,image/*" required /></label>
          <p className="field-help span-2">If issue or expiry dates are not shown on the document, leave them blank. The system may use the document type’s default validity period.</p>
          <div className="modal-actions"><button type="button" className="ghost" onClick={() => setActionOpen(null)}>Cancel</button><button disabled={busy || !selectedDocumentTypeId}>{busy ? 'Uploading…' : 'Upload evidence'}</button></div>
        </form>
      </ActionModal>}
    </div>;
  }

  if (section === 'readiness') {
    return <section className="panel">
      <div className="panel-title"><div><h2>Trip compliance readiness</h2><p>Evaluate required documents for route countries and horses.</p></div></div>
      <form className="form-grid" onSubmit={evaluate}>
        <label>Trip<select name="tripId" value={complianceTripId} onChange={event => setComplianceTripId(event.target.value)} required><option value="">{tripChoicesLoading ? 'Loading trips…' : 'Choose a trip'}</option>{tripChoices.map(trip => <option key={trip.id} value={trip.id}>{trip.tripNo} · {trip.status}</option>)}</select><small className="field-help">Choose the trip number; the system uses its Trip ID for the readiness check.</small></label><label>Origin country ID<input name="originCountryId" required /></label>
        <label>Destination country ID<input name="destinationCountryId" required /></label><label>Horse IDs (comma-separated)<input name="horseIds" /></label>
        <label>Departure date<input name="plannedDepartureDate" type="date" /></label><button disabled={busy}>{busy ? 'Evaluating…' : 'Evaluate requirements'}</button>
      </form>
      {readiness && <div className="readiness"><div><h3>{readiness.isReady ? 'Ready for departure' : 'Compliance blockers'}</h3><p>{readiness.metRequirements}/{readiness.totalRequirements} requirements met · {readiness.missingRequirements} missing · {readiness.expiredRequirements} expired · {readiness.pendingReviewRequirements} in review</p>{readiness.items.filter(i => !i.isMet).map((item, index) => <p className="blocker" key={index}>{item.documentTypeName}: {item.status}{item.notes ? ' — ' + item.notes : ''}</p>)}</div></div>}
    </section>;
  }

  return <div className="stack">
    <section className="panel">
      <div className="panel-title"><div><h2>Border clearance cases</h2><p>Find and manage country-specific clearance records for a trip.</p></div><button onClick={() => setActionOpen('clearance')}>+ New case</button></div>
      <form className="inline-form" onSubmit={loadClearances}><label>Trip<select name="tripId" value={complianceTripId} onChange={event => setComplianceTripId(event.target.value)} required><option value="">{tripChoicesLoading ? 'Loading trips…' : 'Choose a trip'}</option>{tripChoices.map(trip => <option key={trip.id} value={trip.id}>{trip.tripNo} · {trip.status}</option>)}</select></label><button disabled={busy || tripChoicesLoading}>{busy ? 'Loading…' : 'Load cases'}</button></form>
      <div className="table-wrap"><table><thead><tr><th>Case</th><th>Country</th><th>Authority</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {clearances.map(c => <tr key={c.id}><td>{c.caseNo}</td><td className="mono">{c.countryId}</td><td>{c.authorityName}</td><td><em>{c.status}</em></td><td><span className="header-actions">{c.status.toUpperCase() === 'DRAFT' && <button className="ghost small" onClick={async () => { try { await submitClearanceCase(c.id); notify('Clearance case submitted.'); setClearances(await getClearanceCases(c.tripId)); } catch (e) { report(errorText(e)); } }}>Submit</button>}{reviewer && c.status.toUpperCase() === 'SUBMITTED' && <button className="small" onClick={async () => { try { await reviewClearanceCase(c.id, 'UNDER_REVIEW', 'Started review of synthetic clearance case.'); notify('Clearance case moved to review.'); setClearances(await getClearanceCases(c.tripId)); } catch (e) { report(errorText(e)); } }}>Start review</button>}{reviewer && c.status.toUpperCase() === 'UNDER_REVIEW' && <button className="small" onClick={async () => { try { await reviewClearanceCase(c.id, 'APPROVED', 'Synthetic local test approval.'); notify('Clearance case approved.'); setClearances(await getClearanceCases(c.tripId)); } catch (e) { report(errorText(e)); } }}>Approve</button>}{reviewer && c.status.toUpperCase() === 'APPROVED' && <button className="small" onClick={async () => { try { await reviewClearanceCase(c.id, 'COMPLETED', 'Synthetic local test completed.'); notify('Clearance case completed.'); setClearances(await getClearanceCases(c.tripId)); } catch (e) { report(errorText(e)); } }}>Complete</button>}</span></td></tr>)}
        {!clearances.length && <tr><td colSpan={5}>Enter a trip ID to load clearance cases.</td></tr>}
      </tbody></table></div>
    </section>
    {actionOpen === 'clearance' && <ActionModal title="New border clearance case" description="Create a country-specific clearance record for a trip." onClose={() => setActionOpen(null)}>
      <form className="form-grid" onSubmit={makeClearance}>
        <label>Trip<select name="tripId" value={complianceTripId} onChange={event => setComplianceTripId(event.target.value)} required><option value="">Choose a trip</option>{tripChoices.map(trip => <option key={trip.id} value={trip.id}>{trip.tripNo} · {trip.status}</option>)}</select></label><label>Country ID<input name="countryId" required /></label>
        <label>Authority name<input name="authorityName" required /></label><label>Reference number<input name="referenceNumber" /></label>
        <label className="span-2">Notes<input name="notes" /></label>
        <div className="modal-actions"><button type="button" className="ghost" onClick={() => setActionOpen(null)}>Cancel</button><button disabled={busy}>{busy ? 'Creating…' : 'Create case'}</button></div>
      </form>
    </ActionModal>}
  </div>;
}
function TripsView({ report, notify, focusTripId, focusHorseOptions }: { report: (s: string) => void; notify: (s: string) => void; focusTripId: string; focusHorseOptions: { id: string; label: string }[] }) {
  const [trip, setTrip] = useState<Trip | null>(null); const [selectedId, setSelectedId] = useState(''); const [tripSearch, setTripSearch] = useState('');
  const [tripStatus, setTripStatus] = useState(''); const [tripSort, setTripSort] = useState('departure-desc'); const [tripOptions, setTripOptions] = useState<Trip[]>([]); const [tripListLoading, setTripListLoading] = useState(false);
  const [plan, setPlan] = useState<RoutePlan | null>(null); const [versions, setVersions] = useState<RouteVersion[]>([]); const [version, setVersion] = useState<RouteVersion | null>(null);
  const [legs, setLegs] = useState<RecordRow[]>([]); const [readiness, setReadiness] = useState<{ ready: boolean; blockers: string[] } | null>(null);
  const [assignments, setAssignments] = useState<{ resources: RecordRow[]; staff: RecordRow[]; horses: RecordRow[] }>({ resources: [], staff: [], horses: [] });
  const [checkpoints, setCheckpoints] = useState<RecordRow[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<RecordRow[]>([]); const [flightBookings, setFlightBookings] = useState<RecordRow[]>([]); const [fleetStalls, setFleetStalls] = useState<RecordRow[]>([]); const [routeLocations, setRouteLocations] = useState<RecordRow[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffAccount[]>([]); const [staffRole, setStaffRole] = useState<'DRIVER' | 'ESCORT'>('DRIVER'); const [staffUserId, setStaffUserId] = useState('');
  const [requestHorseOptions, setRequestHorseOptions] = useState<{ id: string; label: string }[]>([]);
  const [orderId, setOrderId] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (focusTripId) { setSelectedId(focusTripId); setRequestHorseOptions(focusHorseOptions); } }, [focusHorseOptions, focusTripId]);
  useEffect(() => { setTripListLoading(true); getAllTrips().then(setTripOptions).catch(e => report(errorText(e))).finally(() => setTripListLoading(false)); }, [report]);
  useEffect(() => { Promise.all([getRows('vehicles'), getRows('flight-bookings'), getRows('stalls'), getRows('locations')]).then(([vehicles, flights, stalls, locations]) => { setFleetVehicles(vehicles); setFlightBookings(flights); setFleetStalls(stalls); setRouteLocations(locations); }).catch(e => report(errorText(e))); }, [report]);
  useEffect(() => { getStaffDirectory().then(setStaffDirectory).catch(e => report(errorText(e))); }, [report]);
  const refreshTrips = useCallback(async () => { if (!selectedId) return; try { setTrip(await getTrip(selectedId)); } catch (e) { report(errorText(e)); } }, [selectedId, report]);
  const loadTrip = useCallback(async () => {
    if (!selectedId) { setPlan(null); setVersions([]); setLegs([]); setReadiness(null); setAssignments({ resources: [], staff: [], horses: [] }); setCheckpoints([]); return; }
    try {
      setPlan(null); setVersions([]); setVersion(null); setTrip(null);
      const t = await getTrip(selectedId); setTrip(t);
      const [r, a] = await Promise.all([getReadiness(selectedId), getAssignments(selectedId)]);
      setAssignments(a);
      setReadiness(r);
      let routePlan: RoutePlan | null = null;
      try { routePlan = await getRoutePlanByTrip(selectedId); }
      catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
      setPlan(routePlan);
      if (routePlan) {
        const routeVersions = await getVersions(routePlan.id);
        setVersions(routeVersions);
        const selectedVersion = routeVersions.find(item => item.id === routePlan?.activeVersionId) ?? routeVersions.at(-1) ?? null;
        setVersion(selectedVersion);
        const routeLegs = selectedVersion ? await getLegs(selectedVersion.id) : [];
        setLegs(routeLegs);
        setCheckpoints(routeLegs[0] ? await getCheckpoints(routeLegs[0].id) : []);
      } else { setVersions([]); setVersion(null); setLegs([]); setCheckpoints([]); }
    } catch (e) { if (e instanceof ApiError && e.status === 404) { setTrip(null); setPlan(null); setVersions([]); setLegs([]); } else report(errorText(e)); }
  }, [selectedId, report]);
  useEffect(() => { void loadTrip(); }, [loadTrip]);
  const visibleTrips = tripOptions.filter(item => (!tripStatus || item.status.toUpperCase() === tripStatus) && (!tripSearch || `${item.tripNo} ${item.id} ${item.status}`.toLowerCase().includes(tripSearch.toLowerCase()))).sort((a, b) => { const aTime = new Date(a.plannedDepartureAt ?? 0).getTime(); const bTime = new Date(b.plannedDepartureAt ?? 0).getTime(); return tripSort === 'departure-asc' ? aTime - bTime : bTime - aTime; });
  async function run(fn: () => Promise<unknown>, message: string) { setBusy(true); report(''); try { await fn(); notify(message); if (selectedId) { await refreshTrips(); await loadTrip(); } } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  async function onCreateTrip(e: FormEvent) { e.preventDefault(); setBusy(true); report(''); try { const created = await createTrip(orderId); setTripOptions(current => [created, ...current.filter(item => item.id !== created.id)]); setSelectedId(created.id); setTrip(created); setOrderId(''); notify('Trip created.'); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  async function onAddLeg(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!version) return; const f = new FormData(e.currentTarget);
    const payload = { sequenceNo: Number(f.get('sequenceNo')), originLocationId: f.get('originLocationId'), destinationLocationId: f.get('destinationLocationId'), mode: f.get('mode'), departureAt: new Date(String(f.get('departureAt'))).toISOString(), arrivalAt: new Date(String(f.get('arrivalAt'))).toISOString(), distanceKm: Number(f.get('distanceKm')) || null };
    await run(() => addLeg(version.id, payload), 'Route leg added.'); e.currentTarget.reset();
  }
  async function onAddCheckpoint(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const leg = legs[0]; if (!leg) return; const f = new FormData(e.currentTarget);
    const arrivalAt = new Date(String(f.get('arrivalAt'))).toISOString(); const departureAt = new Date(String(f.get('departureAt'))).toISOString();
    await run(() => addCheckpoint(leg.id, { sequenceNo: checkpoints.length + 1, locationId: f.get('locationId'), type: f.get('type'), arrivalAt, departureAt }), 'Checkpoint added.'); e.currentTarget.reset();
  }
  async function selectVersion(id: string) {
    const selectedVersion = versions.find(item => item.id === id) ?? null;
    setVersion(selectedVersion);
    try { const routeLegs = selectedVersion ? await getLegs(selectedVersion.id) : []; setLegs(routeLegs); setCheckpoints(routeLegs[0] ? await getCheckpoints(routeLegs[0].id) : []); }
    catch (e) { report(errorText(e)); }
  }
  const locationLabel = (row: RecordRow) => `${row.name}${row.city ? ` · ${row.city}` : ''}${row.address ? ` · ${row.address}` : ''}`;
  const resourceLabel = (row: RecordRow) => `${row.vehicleCode ?? row.bookingReference ?? row.id}${row.plateNumber ? ` · ${row.plateNumber}` : ''}${row.flightNumber ? ` · ${row.flightNumber}` : ''}`;
  return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>Trips</h2><p>Browse trips, search by trip number, filter by status, and sort by departure.</p></div><button className="ghost" onClick={async () => { setTripListLoading(true); try { setTripOptions(await getAllTrips()); if (selectedId) await refreshTrips(); } catch (e) { report(errorText(e)); } finally { setTripListLoading(false); } }}>Refresh trips</button></div><div className="trip-browser"><label>Search<input value={tripSearch} onChange={event => setTripSearch(event.target.value)} placeholder="Trip number or ID" /></label><label>Status<select value={tripStatus} onChange={event => setTripStatus(event.target.value)}><option value="">All statuses</option>{[...new Set(tripOptions.map(item => item.status.toUpperCase()))].sort().map(status => <option key={status}>{status}</option>)}</select></label><label>Sort by<select value={tripSort} onChange={event => setTripSort(event.target.value)}><option value="departure-desc">Latest departure</option><option value="departure-asc">Earliest departure</option></select></label><label>Choose trip<select value={selectedId} onChange={event => { setSelectedId(event.target.value); setTripSearch(''); }}><option value="">{tripListLoading ? 'Loading trips…' : 'Select a trip'}</option>{visibleTrips.map(item => <option key={item.id} value={item.id}>{item.tripNo} · {item.status}{item.plannedDepartureAt ? ` · ${new Date(item.plannedDepartureAt).toLocaleDateString()}` : ''}</option>)}</select></label><small className="field-help">{visibleTrips.length} trip{visibleTrips.length === 1 ? '' : 's'} shown.</small></div><form className="inline-form" onSubmit={onCreateTrip}><Input label="Booking Order ID" value={orderId} onChange={setOrderId} required /><button disabled={busy}>Create trip</button></form>{trip && <div className="assignment-row"><b>{trip.tripNo}</b><span>{trip.status} · Order {trip.orderId} · {trip.complianceReady ? 'Compliance ready' : 'Compliance pending'}</span></div>}</section>
  {selectedId && trip && <section className="panel"><div className="panel-title"><div><h2>Route planning</h2><p>Trip {trip.tripNo}. Build the route, then assign its vehicle, flight, horse compartments, and driver or escort.</p></div><div className="header-actions">{!plan ? <button disabled={busy} onClick={() => void run(async () => { const p = await createPlan(selectedId); setPlan(p); const v = await getVersions(p.id); setVersions(v); setVersion(v.at(-1) ?? null); }, 'Route plan created.')}>Create route plan</button> : <><form className="inline-form compact" onSubmit={e => { e.preventDefault(); void run(async () => { const v = await newVersion(plan.id, reason); setReason(''); setVersion(v); setVersions(await getVersions(plan.id)); }, 'New draft version created.'); }}><input aria-label="Version reason" placeholder="Reason for new version" value={reason} onChange={e => setReason(e.target.value)} /><button className="ghost" disabled={busy}>New version</button></form></>}</div></div>
    {plan && <><div className="version-bar"><span>Route plan v{plan.versionNo}</span><select value={version?.id ?? ''} onChange={e => void selectVersion(e.target.value)}>{versions.map(v => <option key={v.id} value={v.id}>Version {v.versionNo} · {v.status}</option>)}</select><div className="header-actions">{version && ['DRAFT','REJECTED'].includes(version.status.toUpperCase()) && <button className="ghost" disabled={busy} onClick={() => void run(() => action(`/api/v1/route-plan-versions/${version.id}/submit`), 'Version submitted for approval.')}>Submit</button>}{version && version.status.toUpperCase() === 'PENDING_APPROVAL' && <button className="ghost" disabled={busy} onClick={() => void run(() => action(`/api/v1/route-plan-versions/${version.id}/approve`), 'Version approved.')}>Approve</button>}{version && version.status.toUpperCase() === 'APPROVED' && <button disabled={busy} onClick={() => void run(() => action(`/api/v1/route-plan-versions/${version.id}/activate`), 'Version activated.')}>Activate</button>}</div></div>
    <div className="table-wrap"><table><thead><tr><th>Leg</th><th>From</th><th>To</th><th>Mode</th><th>Status</th></tr></thead><tbody>{legs.map(l => <tr key={l.id}><td>{l.sequenceNo}</td><td>{routeLocations.find(item => item.id === l.originLocationId) ? locationLabel(routeLocations.find(item => item.id === l.originLocationId)!) : l.originLocationId}</td><td>{routeLocations.find(item => item.id === l.destinationLocationId) ? locationLabel(routeLocations.find(item => item.id === l.destinationLocationId)!) : l.destinationLocationId}</td><td>{l.transportMode}</td><td>{l.status}</td></tr>)}{!legs.length && <tr><td colSpan={5}>No route legs in this version yet.</td></tr>}</tbody></table></div>
    {legs.length > 0 && <div className="planning-tools"><section><h3>Route-leg checkpoints</h3><p>For leg {legs[0].sequenceNo} · choose saved stops from Locations.</p>{checkpoints.map(cp => <div className="assignment-row" key={cp.id}><span>#{cp.sequenceNo} · {cp.type}</span><span>{routeLocations.find(item => item.id === cp.locationId) ? locationLabel(routeLocations.find(item => item.id === cp.locationId)!) : cp.locationId}</span></div>)}<form className="form-grid" onSubmit={onAddCheckpoint}><label>Checkpoint location<select name="locationId" required defaultValue=""><option value="">Choose a location</option>{routeLocations.filter(item => item.active !== false).map(item => <option key={item.id} value={item.id}>{locationLabel(item)}</option>)}</select></label><label>Checkpoint type<input name="type" placeholder="REST_STOP" required /></label><label>Arrival<input name="arrivalAt" type="datetime-local" required /></label><label>Departure<input name="departureAt" type="datetime-local" required /></label><button disabled={busy}>Add checkpoint</button></form></section>
      <section><h3>Resource assignment</h3><p>Assign a vehicle or flight booking to leg {legs[0].sequenceNo}.</p>{assignments.resources.map(a => <div className="assignment-row" key={a.id}><span>{a.vehicleId ? 'Vehicle' : 'Flight'}</span><span>{a.vehicleId ? resourceLabel(fleetVehicles.find(item => item.id === String(a.vehicleId)) ?? { id: String(a.vehicleId) }) : resourceLabel(flightBookings.find(item => item.id === String(a.flightBookingId ?? '')) ?? { id: String(a.flightBookingId ?? '') })}</span></div>)}<form className="form-grid" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => assignResource(legs[0].id, { vehicleId: String(f.get('vehicleId') || '') || null, flightBookingId: String(f.get('flightBookingId') || '') || null }), 'Resource assigned.'); e.currentTarget.reset(); }}><label>Vehicle<select name="vehicleId" defaultValue=""><option value="">Choose a vehicle</option>{fleetVehicles.filter(item => String(item.status).toUpperCase() === 'AVAILABLE').map(item => <option key={item.id} value={item.id}>{resourceLabel(item)}</option>)}</select></label><label>Flight booking<select name="flightBookingId" defaultValue=""><option value="">Choose a flight booking</option>{flightBookings.map(item => <option key={item.id} value={item.id}>{resourceLabel(item)}</option>)}</select></label><button disabled={busy}>Assign resource</button></form></section>
      <section><h3>Staff assignment</h3>{assignments.staff.map(a => { const member = staffDirectory.find(item => item.id === String(a.userId)); return <div className="assignment-row" key={a.id}><span>{member ? `${member.fullName} · ${a.role}` : a.role}<small>{member?.email ?? a.userId}</small></span></div>; })}<form className="form-grid" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); await run(() => assignStaff(selectedId, { legId: legs[0].id, userId: f.get('userId'), role: f.get('role') }), 'Staff member assigned.'); setStaffUserId(''); }}><label>Staff member<select name="userId" value={staffUserId} onChange={event => setStaffUserId(event.target.value)} required><option value="">Choose an active staff member</option>{staffDirectory.filter(member => member.role === staffRole || member.role === 'DRIVER_ESCORT').map(member => <option key={member.id} value={member.id}>{member.fullName} · {member.role} · {member.email}</option>)}</select><small className="field-help">Only active driver and escort accounts are listed.</small></label><label>Assignment role<select name="role" value={staffRole} onChange={event => { setStaffRole(event.target.value as 'DRIVER' | 'ESCORT'); setStaffUserId(''); }}><option value="DRIVER">Driver</option><option value="ESCORT">Escort</option></select></label><button disabled={busy || !staffDirectory.length}>Assign staff</button></form></section>
      <section><h3>Horse assignment</h3>{assignments.horses.map(a => <div className="assignment-row" key={a.id}><span>Horse</span><span className="mono">{a.horseId} · {a.stallId ?? 'no stall'}</span></div>)}<form className="form-grid" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => assignHorse(selectedId, { horseId: f.get('horseId'), legId: legs[0].id, stallId: String(f.get('stallId') || '') || null }), 'Horse assigned.'); e.currentTarget.reset(); }}><label>Horse {requestHorseOptions.length ? <select name="horseId" required defaultValue=""><option value="">Choose a horse from the approved request</option>{requestHorseOptions.filter(horse => !assignments.horses.some(assigned => String(assigned.horseId) === horse.id)).map(horse => <option key={horse.id} value={horse.id}>{horse.label}</option>)}</select> : <input name="horseId" placeholder="Horse ID from the approved request" required />}<small className="field-help">{requestHorseOptions.length ? "These named horses were selected by the owner for this request." : "For older trips, use the horse ID recorded on the approved request."}</small></label><label>Horse compartment<select name="stallId" defaultValue=""><option value="">No compartment assigned</option>{fleetStalls.filter(item => item.active !== false).map(item => <option key={item.id} value={item.id}>{item.stallCode}{item.stallType ? ` · ${item.stallType}` : ''} · capacity ${item.capacity}</option>)}</select></label><button disabled={busy || (requestHorseOptions.length > 0 && requestHorseOptions.every(horse => assignments.horses.some(assigned => String(assigned.horseId) === horse.id)))}>Assign horse</button></form></section></div>}
    {version && version.status.toUpperCase() === 'DRAFT' && <form className="form-grid leg-form" onSubmit={onAddLeg}><h3>Add route leg</h3><label>Sequence<input name="sequenceNo" type="number" min="1" defaultValue={legs.length + 1} required /></label><label>From<select name="originLocationId" required defaultValue=""><option value="">Choose origin</option>{routeLocations.filter(item => item.active !== false).map(item => <option key={item.id} value={item.id}>{locationLabel(item)}</option>)}</select></label><label>To<select name="destinationLocationId" required defaultValue=""><option value="">Choose destination</option>{routeLocations.filter(item => item.active !== false).map(item => <option key={item.id} value={item.id}>{locationLabel(item)}</option>)}</select></label><label>Mode<select name="mode"><option value="ROAD">Road</option><option value="AIR">Air</option></select></label><label>Departure<input name="departureAt" type="datetime-local" required /></label><label>Arrival<input name="arrivalAt" type="datetime-local" required /></label><label>Distance km<input name="distanceKm" type="number" min="0" step="0.1" /></label><button disabled={busy}>Add leg</button></form>}
    </>}
    <div className="readiness"><div><h3>Pre-departure readiness</h3><p>{readiness ? readiness.ready ? 'No blockers reported.' : `${readiness.blockers.length} blocker(s) need attention.` : 'Loading readiness…'}</p>{readiness?.blockers.map((b,i) => <p className="blocker" key={i}>• {b}</p>)}</div>{readiness?.ready && <button disabled={busy} onClick={() => void run(() => action(`/api/v1/trips/${selectedId}/confirm-ready`), 'Trip confirmed ready.')}>Confirm READY</button>}</div>
  </section>}</div>;
}

function FleetView({ report, notify }: { report: (s: string) => void; notify: (s: string) => void }) {
  const [resource, setResource] = useState<FleetResource>(fleet[0]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [countries, setCountries] = useState<RecordRow[]>([]);
  const [airlines, setAirlines] = useState<RecordRow[]>([]);
  const [locations, setLocations] = useState<RecordRow[]>([]);
  const [mapSearch, setMapSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setRows(await getRows(resource.key)); } catch (e) { report(errorText(e)); } }, [resource, report]);
  useEffect(() => { setEditing(null); setValues({}); setMapSearch(''); void load(); }, [load]);
  useEffect(() => {
    Promise.all([getRows('countries'), getRows('airlines'), getRows('locations')])
      .then(([countryRows, airlineRows, locationRows]) => { setCountries(countryRows); setAirlines(airlineRows); setLocations(locationRows); })
      .catch(error => report(errorText(error)));
  }, [report]);

  function fieldValue(field: FleetField, value: RecordRow[string] | undefined) {
    if (value == null) return field.defaultValue ?? '';
    if (field.kind === 'datetime') return new Date(String(value)).toISOString().slice(0, 16);
    return String(value);
  }
  function edit(row?: RecordRow) {
    setEditing(row ?? null);
    setMapSearch('');
    setValues(Object.fromEntries(resource.fields.map(field => [field.key, row
      ? fieldValue(field, row[field.key])
      : field.defaultValue ?? ''])));
  }
  function cancelEdit() { setEditing(null); setValues({}); setMapSearch(''); }
  function sourceRows(field: FleetField) {
    if (field.source === 'countries') return countries.filter(row => row.active !== false);
    if (field.source === 'airlines') return airlines.filter(row => row.active !== false);
    if (field.source === 'airports') return locations.filter(row => row.active !== false && String(row.locationType).toUpperCase() === 'AIRPORT');
    return [];
  }
  function optionLabel(field: FleetField, row: RecordRow) {
    if (field.source === 'countries') return `${row.name} · ${row.isoCode}`;
    if (field.source === 'airlines') return `${row.name} · ${row.airlineCode}`;
    return `${row.name}${row.city ? ` · ${row.city}` : ''}${row.locationCode ? ` · ${row.locationCode}` : ''}`;
  }
  function displayCell(key: string, value: RecordRow[string]) {
    if (value == null) return '—';
    if (key === 'countryId') { const row = countries.find(item => item.id === String(value)); return row ? `${row.name} (${row.isoCode})` : value; }
    if (key === 'airlineId') { const row = airlines.find(item => item.id === String(value)); return row ? `${row.name} (${row.airlineCode})` : value; }
    if (key === 'originAirportId' || key === 'destinationAirportId') { const row = locations.find(item => item.id === String(value)); return row ? `${row.name}${row.city ? ` · ${row.city}` : ''}` : value; }
    if (key.endsWith('At')) return new Date(String(value)).toLocaleString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value;
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    const input: Record<string, unknown> = {};
    for (const field of resource.fields) {
      if (field.kind === 'generated' && !editing) continue;
      const value = values[field.key] ?? '';
      if (field.kind === 'boolean') input[field.key] = value === 'true';
      else if (field.kind === 'number') input[field.key] = value === '' ? null : Number(value);
      else if (field.kind === 'datetime') input[field.key] = value ? new Date(value).toISOString() : null;
      else if (['isoCode', 'airlineCode'].includes(field.key)) input[field.key] = value.trim().toUpperCase();
      else input[field.key] = value.trim() || null;
    }
    try { await saveRow(resource.key, editing?.id, input); notify(`${resource.title} record saved.`); cancelEdit(); await load(); }
    catch (e) { report(errorText(e)); } finally { setBusy(false); }
  }
  async function remove(row: RecordRow) { if (!window.confirm(`Delete ${row.name ?? row.vehicleCode ?? row.stallCode ?? row.id}?`)) return; try { await deleteRow(resource.key, row.id); notify('Record deleted.'); await load(); } catch (e) { report(errorText(e)); } }
  const airportLocations = locations.filter(row => row.active !== false && String(row.locationType).toUpperCase() === 'AIRPORT');
  const singularTitle = resource.title === 'Countries' ? 'Country' : resource.title === 'Horse compartments' ? 'compartment' : resource.title.replace(/s$/, '');
  return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>Fleet & route reference data</h2><p>{resource.description}</p></div><button onClick={() => edit()}>+ Add {singularTitle}</button></div><div className="tabs">{fleet.map(item => <button key={item.key} className={resource.key === item.key ? 'tab-active' : 'ghost'} onClick={() => setResource(item)}>{item.title}</button>)}</div><div className="table-wrap"><table><thead><tr>{resource.columns.map(column => <th key={column.key}>{column.label}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>{resource.columns.map(column => <td key={column.key}>{displayCell(column.key, row[column.key])}</td>)}<td><button className="ghost small" onClick={() => edit(row)}>Edit</button> <button className="danger small" onClick={() => void remove(row)}>Delete</button></td></tr>)}{!rows.length && <tr><td colSpan={resource.columns.length + 1}>No {resource.title.toLowerCase()} have been added.</td></tr>}</tbody></table></div></section>
    {editing !== null || Object.keys(values).length > 0 ? <section className="panel"><div className="panel-title"><div><h2>{editing ? 'Edit' : 'Add'} {singularTitle}</h2><p>{resource.description}</p></div><button type="button" className="ghost" onClick={cancelEdit}>Cancel</button></div><form className="form-grid" onSubmit={save}>
      {resource.fields.map(field => {
        const value = values[field.key] ?? '';
        const update = (next: string) => setValues(current => ({ ...current, [field.key]: next }));
        const help = field.help ? <small className="field-help">{field.help}</small> : null;
        if (field.kind === 'boolean') return <label key={field.key} className="checkbox-field"><input type="checkbox" checked={value === 'true'} onChange={event => update(String(event.target.checked))} />{field.label}</label>;
        if (field.kind === 'select') {
          const options = field.options ?? sourceRows(field).map(row => ({ value: row.id, label: optionLabel(field, row) }));
          return <label key={field.key}>{field.label}<select value={value} required={field.required} onChange={event => update(event.target.value)}><option value="">{field.source === 'airports' && !airportLocations.length ? 'Add an airport location first' : field.source === 'airlines' && !airlines.length ? 'Add an airline first' : field.source === 'countries' && !countries.length ? 'Add a supported country first' : 'Choose an option'}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{help}</label>;
        }
        if (field.kind === 'textarea') return <label key={field.key} className="span-2">{field.label}<textarea value={value} onChange={event => update(event.target.value)} rows={3} required={field.required} />{help}</label>;
        return <label key={field.key}>{field.label}<input value={value} readOnly={field.kind === 'generated'} placeholder={field.kind === 'generated' && !editing ? 'Assigned when saved' : undefined} type={field.kind === 'number' ? 'number' : field.kind === 'datetime' ? 'datetime-local' : 'text'} min={field.min} max={field.max} maxLength={field.maxLength} step={field.kind === 'number' ? field.step ?? 'any' : undefined} required={field.required} onChange={event => update(event.target.value)} />{help}</label>;
      })}
      {resource.key === 'locations' && <div className="location-search span-2"><label>Find or verify this address on OpenStreetMap<input value={mapSearch} onChange={event => setMapSearch(event.target.value)} placeholder="Address, stable, airport, or town" /></label><a className={`ghost ${!mapSearch.trim() ? 'disabled-link' : ''}`} href={mapSearch.trim() ? osmSearchUrl(mapSearch.trim()) : undefined} target="_blank" rel="noreferrer" aria-disabled={!mapSearch.trim()}>Search map</a><small className="field-help">Copy the verified address and decimal coordinates into the fields above. © OpenStreetMap contributors.</small></div>}
      <button disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
    </form></section> : null}</div>;
}
