import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { ApiError, api, login, logout, PaginationMeta, registerCustomer, restoreSession, User } from '../core/api';
import { action, addCheckpoint, addLeg, assignHorse, assignResource, assignStaff, createPlan, createTrip, deleteRow, getAssignments, getCheckpoints, getLegs, getTrip, getReadiness, getVersions, newVersion, RecordRow, ResourceName, RoutePlan, RouteVersion, saveRow, Trip, getRows } from '../features/planning/api';
import { deleteHorse, getHorses, getManagerQueue, getProfile, getRequests, getRequest, Horse, RequestSummary, TransportRequest, reviewRequest, saveHorse, saveProfile, saveRequest, submitRequest, CustomerProfile, ComplianceDocument, DocumentType, getDocuments, getDocumentTypes, uploadDocumentFile, reviewDocument, ComplianceReadiness, evaluateCompliance, ClearanceCase, getClearanceCases, createClearanceCase, submitClearanceCase, reviewClearanceCase } from '../features/booking/api';
import OperationsView from '../features/operations/OperationsView';
import DashboardView from '../features/dashboard/DashboardView';
import './styles.css';

const allowedRoles = ['CUSTOMER', 'TRANSPORT_SPECIALIST', 'LOGISTICS_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'DRIVER', 'ESCORT', 'DRIVER_ESCORT', 'FLEET_ROUTE_COORDINATOR'];
const fleet: { key: ResourceName; title: string; fields: string[] }[] = [
  { key: 'vehicles', title: 'Vehicles', fields: ['vehicleCode','plateNumber','vehicleType','horseCapacity','stallCapacity','temperatureControlled','status'] },
  { key: 'locations', title: 'Locations', fields: ['locationCode','name','locationType','address','city','countryId','latitude','longitude','active'] },
  { key: 'stalls', title: 'Stalls', fields: ['stallCode','stallType','capacity','active','notes'] },
  { key: 'countries', title: 'Countries', fields: ['isoCode','name','active'] },
  { key: 'airlines', title: 'Airlines', fields: ['airlineCode','name','active'] },
  { key: 'flight-bookings', title: 'Flight bookings', fields: ['bookingReference','airlineId','flightNumber','originAirportId','destinationAirportId','scheduledDepartureAt','scheduledArrivalAt'] },
];

function errorText(error: unknown) { return error instanceof Error ? error.message : 'Unexpected error'; }
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
  const manager = role === 'LOGISTICS_MANAGER' || role === 'ADMIN';
  const complianceItems = [
    { id: 'Compliance documents', label: 'Documents' },
    { id: 'Compliance readiness', label: 'Trip readiness' },
    { id: 'Border clearance', label: 'Border clearance' },
  ];
  if (role === 'CUSTOMER') return [
    { label: 'Booking', items: [{ id: 'My horses', label: 'My horses' }, { id: 'Transport requests', label: 'Transport requests' }] },
    { label: 'Compliance', items: complianceItems },
    { label: 'Journey', items: [{ id: 'Timeline', label: 'Trip timeline' }, { id: 'Tracking', label: 'Live tracking' }, { id: 'Health', label: 'Horse health' }, { id: 'Handover', label: 'Handover' }] },
    { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] },
  ];
  if (manager) return [
    { label: 'Overview', items: [{ id: 'Dashboard', label: 'Dashboard' }] },
    { label: 'Booking', items: [{ id: 'Request review', label: 'Request review' }] },
    { label: 'Planning', items: [{ id: 'Trips', label: 'Trips & route plans' }, { id: 'Fleet', label: 'Fleet master data' }] },
    { label: 'Compliance', items: complianceItems },
    { label: 'Operations', items: ['Execution','Tracking','Health','Incidents','Handover','Route changes'].map(id => ({ id, label: id })) },
    { label: 'Reporting', items: [{ id: 'KPI & audit', label: 'KPI & audit' }] },
    { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] },
  ];
  if (role === 'COMPLIANCE_OFFICER') return [{ label: 'Compliance', items: complianceItems }, { label: 'Account', items: [{ id: 'Notifications', label: 'Notifications' }] }];
  if (role === 'TRANSPORT_SPECIALIST' || role === 'FLEET_ROUTE_COORDINATOR') return [
    { label: 'Planning', items: [{ id: 'Trips', label: 'Trips & route plans' }, { id: 'Fleet', label: 'Fleet master data' }] },
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
  if (checking) return <main className="center"><p>Restoring secure session…</p></main>;
  if (!user) return <main className="center"><section className="login panel"><div className="brand">Equi<span>Route</span></div><div className="auth-tabs" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'active' : 'ghost'} onClick={() => changeAuthMode('login')}>Sign in</button><button type="button" role="tab" aria-selected={authMode === 'register'} className={authMode === 'register' ? 'active' : 'ghost'} onClick={() => changeAuthMode('register')}>Create account</button></div>{authMode === 'login' ? <form className="auth-form" onSubmit={signIn}><div><h1>Welcome back</h1><p>Sign in with your customer or operations account.</p></div>{error && <p className="auth-error" role="alert">{error}</p>}<Input label="Email" value={email} onChange={setEmail} type="email" required /><Input label="Password" value={password} onChange={setPassword} type="password" required /><button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><p className="auth-switch">New to EquiRoute? <button type="button" onClick={() => changeAuthMode('register')}>Create an account</button></p></form> : <form className="auth-form" onSubmit={signUp}><div><h1>Create customer account</h1><p>Register to manage horses and transport requests.</p></div>{error && <p className="auth-error" role="alert">{error}</p>}<Input label="Full name" value={fullName} onChange={setFullName} required /><Input label="Email" value={email} onChange={setEmail} type="email" required /><Input label="Phone (optional)" value={phone} onChange={setPhone} type="tel" /><label>Password<span className="field-hint">Use at least 12 characters</span><input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><Input label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} type="password" required /><button disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button><p className="auth-switch">Already have an account? <button type="button" onClick={() => changeAuthMode('login')}>Sign in</button></p></form>}</section></main>;
  if (!allowedRoles.includes(user.role.toUpperCase())) return <main className="center"><section className="panel"><h1>Workspace access unavailable</h1><p>Your account role ({user.role}) has no matching workspace.</p><button onClick={signOut}>Sign out</button></section></main>;
  const role = user.role.toUpperCase();
  const groups = navigationFor(role);
  const pages = groups.flatMap(group => group.items.map(item => item.id));
  const activePage = pages.includes(page) ? page : pages[0];
  const operationSection = activePage === 'Timeline' ? 'Execution' : activePage as 'Execution' | 'Tracking' | 'Health' | 'Incidents' | 'Handover' | 'Notifications' | 'Route changes' | 'KPI & audit';
  const complianceSection = activePage === 'Compliance documents' ? 'documents' : activePage === 'Compliance readiness' ? 'readiness' : activePage === 'Border clearance' ? 'clearance' : null;
  return <div className="shell"><aside><div className="brand">Equi<span>Route</span><small>TRANSPORT OPERATIONS</small></div><nav className="nav" aria-label="Main navigation">{groups.map(group => <div className="nav-group" key={group.label}><div className="nav-group-title">{group.label}</div>{group.items.map(item => <button key={item.id} className={activePage === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><span className="nav-dot" />{item.label}</button>)}</div>)}</nav><button className="profile" onClick={() => role === 'CUSTOMER' && setProfileOpen(true)} aria-label={role === 'CUSTOMER' ? 'Open customer profile' : undefined}><div className="avatar">{user.fullName.slice(0,1).toUpperCase()}</div><div><b>{user.fullName}</b><small>{user.role}</small></div></button></aside><div className="workspace"><header><div><p>EquiRoute · Transport operations</p><h1>{activePage}</h1></div><div className="header-actions"><span className="account">{user.email}</span>{role === 'CUSTOMER' && <button className="profile-icon" onClick={() => setProfileOpen(true)} aria-label="Edit customer profile" title="Customer profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" /></svg></button>}<button className="ghost" onClick={signOut}>Sign out</button></div></header>{error && <div className="banner error">{error}<button className="ghost" onClick={() => setError('')}>Dismiss</button></div>}{notice && <div className="banner success">{notice}<button className="ghost" onClick={() => setNotice('')}>Dismiss</button></div>}{activePage === 'Dashboard' ? <DashboardView userName={user.fullName} report={setError} /> : activePage === 'Trips' ? <TripsView report={setError} notify={setNotice} /> : activePage === 'Fleet' ? <FleetView report={setError} notify={setNotice} /> : activePage === 'Request review' ? <ReviewView report={setError} notify={setNotice} /> : activePage === 'My horses' ? <BookingView section="horses" report={setError} notify={setNotice} /> : activePage === 'Transport requests' ? <BookingView section="requests" report={setError} notify={setNotice} /> : complianceSection ? <ComplianceView section={complianceSection} role={role} report={setError} notify={setNotice} /> : <OperationsView section={operationSection} role={role} report={setError} notify={setNotice} />}{profileOpen && <CustomerProfileModal onClose={() => setProfileOpen(false)} report={setError} notify={setNotice} />}</div></div>;
}

function CustomerProfileModal({ onClose, report, notify }: { onClose: () => void; report: (s: string) => void; notify: (s: string) => void }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  useEffect(() => { getProfile().then(setProfile).catch(e => { if (!(e instanceof ApiError && e.status === 404)) report(errorText(e)); }).finally(() => setLoading(false)); }, [report]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  async function save(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); try { setProfile(await saveProfile({ name: String(f.get('name')), customerType: String(f.get('customerType')), contactPerson: String(f.get('contactPerson') || ''), phone: String(f.get('phone') || ''), address: String(f.get('address') || ''), countryId: String(f.get('countryId') || '') || undefined, versionNo: profile?.versionNo })); notify('Customer profile saved.'); onClose(); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="panel-title"><div><h2 id="profile-title">Customer profile</h2><p>Contact information used for bookings.</p></div><button className="icon-close ghost" onClick={onClose} aria-label="Close profile">×</button></div>{loading ? <p className="modal-loading">Loading profile…</p> : <form className="form-grid profile-form" key={`${profile?.id ?? 'new'}-${profile?.versionNo ?? 0}`} onSubmit={save}><label>Name<input name="name" defaultValue={profile?.name ?? ''} required /></label><label>Customer type<select name="customerType" defaultValue={profile?.customerType ?? 'INDIVIDUAL'}><option value="INDIVIDUAL">Individual</option><option value="ORGANIZATION">Organization</option></select></label><label>Contact person<input name="contactPerson" defaultValue={profile?.contactPerson ?? ''} /></label><label>Phone<input name="phone" defaultValue={profile?.phone ?? ''} /></label><label className="span-2">Address<input name="address" defaultValue={profile?.address ?? ''} /></label><label>Country ID<input name="countryId" defaultValue={profile?.countryId ?? ''} /></label><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div></form>}</section></div>;
}

function ActionModal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="action-modal-title"><div className="panel-title"><div><h2 id="action-modal-title">{title}</h2><p>{description}</p></div><button className="icon-close ghost" onClick={onClose} aria-label={`Close ${title}`}>×</button></div>{children}</section></div>;
}

function BookingView({ section, report, notify }: { section: 'horses' | 'requests'; report: (s: string) => void; notify: (s: string) => void }) {
  const [horses, setHorses] = useState<Horse[]>([]); const [requests, setRequests] = useState<RequestSummary[]>([]); const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [horsePagination, setHorsePagination] = useState(emptyPagination); const [requestPagination, setRequestPagination] = useState(emptyPagination);
  const [horseQuery, setHorseQuery] = useState(''); const [horseSearch, setHorseSearch] = useState(''); const [horseStatus, setHorseStatus] = useState('');
  const [requestQuery, setRequestQuery] = useState(''); const [requestSearch, setRequestSearch] = useState(''); const [requestStatus, setRequestStatus] = useState('');
  const reload = useCallback(async () => { try { if (section === 'horses') { const result = await getHorses(horsePagination.page, horsePagination.pageSize, horseSearch, horseStatus); setHorses(result.data); setHorsePagination(result.pagination); } else { const [h, r] = await Promise.all([getHorses(0, 100), getRequests(requestPagination.page, requestPagination.pageSize, requestSearch, requestStatus)]); setHorses(h.data); setRequests(r.data); setRequestPagination(r.pagination); } } catch (e) { report(errorText(e)); } }, [section, horsePagination.page, horsePagination.pageSize, horseSearch, horseStatus, requestPagination.page, requestPagination.pageSize, requestSearch, requestStatus, report]);
  useEffect(() => { void reload(); }, [reload]);
  async function createHorse(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setBusy(true); try { await saveHorse({ horseName: String(f.get('horseName')), registrationNumber: String(f.get('registrationNumber') || ''), passportNumber: String(f.get('passportNumber') || ''), breed: String(f.get('breed') || ''), sex: String(f.get('sex') || ''), dateOfBirth: String(f.get('dateOfBirth') || '') || undefined, color: String(f.get('color') || ''), specialRequirements: String(f.get('specialRequirements') || '') }); form.reset(); setCreateOpen(false); notify('Horse registered.'); await reload(); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  async function createRequest(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setBusy(true); try { const request = await saveRequest({ originLocationId: String(f.get('originLocationId')), destinationLocationId: String(f.get('destinationLocationId')), requestedDepartureAt: new Date(String(f.get('requestedDepartureAt'))).toISOString(), requestedArrivalAt: String(f.get('requestedArrivalAt')) ? new Date(String(f.get('requestedArrivalAt')) as string).toISOString() : undefined, preferredTransportMode: String(f.get('preferredTransportMode') || ''), notes: String(f.get('notes') || ''), horseIds: String(f.get('horseIds') || '').split(/[ ,]+/).filter(Boolean) }); await submitRequest(request.id); form.reset(); setCreateOpen(false); notify('Request submitted for review.'); await reload(); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  if (section === 'horses') return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>My horses</h2><p>Register and manage horses available for transport requests.</p></div><div className="header-actions"><span className="result-count">{horsePagination.totalItems} registered</span><button onClick={() => setCreateOpen(true)}>+ Register horse</button></div></div><ListFilters query={horseQuery} status={horseStatus} statuses={['ACTIVE','INACTIVE','RETIRED']} placeholder="Name, code, registration or passport…" onQueryChange={setHorseQuery} onStatusChange={value => { setHorseStatus(value); setHorsePagination(p => ({ ...p, page: 0 })); }} onSearch={() => { setHorseSearch(horseQuery.trim()); setHorsePagination(p => ({ ...p, page: 0 })); }} onClear={() => { setHorseQuery(''); setHorseSearch(''); setHorseStatus(''); setHorsePagination(p => ({ ...p, page: 0 })); }} /><div className="assignment-list">{horses.map(h => <div className="assignment-row" key={h.id}><span><b>{h.horseName}</b><small>{h.horseCode} · {h.status}{h.breed ? ` · ${h.breed}` : ''}</small></span><button className="danger small" onClick={async () => { if (!window.confirm(`Remove ${h.horseName} from your horse registry?`)) return; try { await deleteHorse(h.id); if (horses.length === 1 && horsePagination.page > 0) setHorsePagination(p => ({ ...p, page: p.page - 1 })); else await reload(); notify('Horse removed.'); } catch (e) { report(errorText(e)); } }}>Delete</button></div>)}{!horses.length && <div className="empty-state">No horses match the current filters.</div>}</div><Pagination value={horsePagination} onChange={(page, pageSize) => setHorsePagination(p => ({ ...p, page, pageSize }))} /></section>{createOpen && <ActionModal title="Register a horse" description="Add identity and care details before booking transport." onClose={() => setCreateOpen(false)}><form className="form-grid" onSubmit={createHorse}><label>Horse name<input name="horseName" autoFocus required /></label><label>Registration no.<input name="registrationNumber" /></label><label>Passport no.<input name="passportNumber" /></label><label>Breed<input name="breed" /></label><label>Sex<input name="sex" /></label><label>Date of birth<input name="dateOfBirth" type="date" /></label><label>Color<input name="color" /></label><label className="span-2">Special requirements<input name="specialRequirements" /></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => setCreateOpen(false)}>Cancel</button><button disabled={busy}>{busy ? 'Registering…' : 'Register horse'}</button></div></form></ActionModal>}</div>;
  return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>Transport requests</h2><p>Track drafts and requests sent for review.</p></div><div className="header-actions"><button className="ghost" onClick={() => void reload()}>Refresh</button><button disabled={!horses.length} onClick={() => setCreateOpen(true)}>+ New request</button></div></div>{!horses.length && <p className="form-hint">Register at least one horse before creating a request.</p>}<ListFilters query={requestQuery} status={requestStatus} statuses={['DRAFT','SUBMITTED','UNDER_REVIEW','NEED_INFORMATION','APPROVED','REJECTED']} placeholder="Search request number…" onQueryChange={setRequestQuery} onStatusChange={value => { setRequestStatus(value); setRequestPagination(p => ({ ...p, page: 0 })); }} onSearch={() => { setRequestSearch(requestQuery.trim()); setRequestPagination(p => ({ ...p, page: 0 })); }} onClear={() => { setRequestQuery(''); setRequestSearch(''); setRequestStatus(''); setRequestPagination(p => ({ ...p, page: 0 })); }} /><div className="table-wrap"><table><thead><tr><th>Request</th><th>Status</th><th>Departure</th><th>Horses</th></tr></thead><tbody>{requests.map(r => <tr key={r.id}><td>{r.requestNo}</td><td><em>{r.status}</em></td><td>{new Date(r.requestedDepartureAt).toLocaleString()}</td><td>{r.horseCount}</td></tr>)}{!requests.length && <tr><td colSpan={4}>No requests match the current filters.</td></tr>}</tbody></table></div><Pagination value={requestPagination} onChange={(page, pageSize) => setRequestPagination(p => ({ ...p, page, pageSize }))} /></section>{createOpen && <ActionModal title="New transport request" description="Create a draft and submit it to the Logistics Manager queue." onClose={() => setCreateOpen(false)}><form className="form-grid" onSubmit={createRequest}><label>Origin location ID<input name="originLocationId" autoFocus required /></label><label>Destination location ID<input name="destinationLocationId" required /></label><label>Departure<input name="requestedDepartureAt" type="datetime-local" required /></label><label>Arrival<input name="requestedArrivalAt" type="datetime-local" /></label><label>Mode<select name="preferredTransportMode" defaultValue="ROAD"><option value="ROAD">Road</option><option value="AIR">Air</option><option value="SEA">Sea</option></select></label><label>Horse IDs (comma-separated)<input name="horseIds" placeholder={horses.map(h => h.id).join(', ')} /></label><label className="span-2">Notes<input name="notes" /></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => setCreateOpen(false)}>Cancel</button><button disabled={busy}>{busy ? 'Submitting…' : 'Create & submit request'}</button></div></form></ActionModal>}</div>;
}

function ReviewView({ report, notify }: { report: (s: string) => void; notify: (s: string) => void }) {
  const [queue, setQueue] = useState<RequestSummary[]>([]); const [selected, setSelected] = useState<TransportRequest | null>(null); const [reason, setReason] = useState(''); const [pagination, setPagination] = useState(emptyPagination);
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const reload = useCallback(async () => { try { const result = await getManagerQueue(pagination.page, pagination.pageSize, search, status); setQueue(result.data); setPagination(result.pagination); } catch (e) { report(errorText(e)); } }, [pagination.page, pagination.pageSize, search, status, report]);
  useEffect(() => { void reload(); }, [reload]);
  async function runReview(actionName: 'start-review' | 'request-information' | 'approve' | 'reject') { if (!selected) return; try { const updated = await reviewRequest(selected.id, actionName, reason); setSelected(updated); setReason(''); notify(`Request ${actionName.replace('-', ' ')} completed.`); await reload(); } catch (e) { report(errorText(e)); } }
  return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>Transport request queue</h2><p>Review, request more information, approve or reject submitted requests.</p></div><button className="ghost" onClick={() => void reload()}>Refresh</button></div><ListFilters query={query} status={status} statuses={['SUBMITTED','UNDER_REVIEW']} placeholder="Search request number…" onQueryChange={setQuery} onStatusChange={value => { setStatus(value); setPagination(p => ({ ...p, page: 0 })); }} onSearch={() => { setSearch(query.trim()); setPagination(p => ({ ...p, page: 0 })); }} onClear={() => { setQuery(''); setSearch(''); setStatus(''); setPagination(p => ({ ...p, page: 0 })); }} /><div className="table-wrap"><table><thead><tr><th>Request</th><th>Status</th><th>Departure</th><th>Horses</th><th /></tr></thead><tbody>{queue.map(item => <tr key={item.id}><td>{item.requestNo}</td><td><em>{item.status}</em></td><td>{new Date(item.requestedDepartureAt).toLocaleString()}</td><td>{item.horseCount}</td><td><button className="ghost small" onClick={async () => { try { setSelected(await getRequest(item.id, true)); } catch (e) { report(errorText(e)); } }}>Review</button></td></tr>)}{!queue.length && <tr><td colSpan={5}>No requests match the current filters.</td></tr>}</tbody></table></div><Pagination value={pagination} onChange={(page, pageSize) => setPagination(p => ({ ...p, page, pageSize }))} /></section>{selected && <section className="panel"><div className="panel-title"><div><h2>{selected.requestNo}</h2><p>Customer {selected.customerId} · {selected.status}</p></div><button className="ghost" onClick={() => setSelected(null)}>Close</button></div><p>Route: <span className="mono">{selected.originLocationId} → {selected.destinationLocationId}</span></p><p>Horses: {selected.horseIds.join(', ') || 'none'}</p><p>{selected.specialRequirements || selected.notes || 'No additional notes.'}</p><label>Decision reason<textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} /></label><div className="header-actions" style={{ marginTop: 14 }}><button className="ghost" onClick={() => void runReview('start-review')}>Start review</button><button className="ghost" disabled={!reason.trim()} onClick={() => void runReview('request-information')}>Request information</button><button disabled={!reason.trim()} onClick={() => void runReview('approve')}>Approve</button><button className="danger" disabled={!reason.trim()} onClick={() => void runReview('reject')}>Reject</button></div></section>}</div>;
}

function ComplianceView({ section, role, report, notify }: { section: 'documents' | 'readiness' | 'clearance'; role: string; report: (s: string) => void; notify: (s: string) => void }) {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [readiness, setReadiness] = useState<ComplianceReadiness | null>(null);
  const [clearances, setClearances] = useState<ClearanceCase[]>([]);
  const [actionOpen, setActionOpen] = useState<'upload' | 'clearance' | null>(null);
  const [busy, setBusy] = useState(false);
  const reviewer = role === 'COMPLIANCE_OFFICER' || role === 'ADMIN';

  const reloadDocuments = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([getDocumentTypes(), getDocuments()]);
      setTypes(t);
      setDocuments(d);
    } catch (e) {
      report(errorText(e));
    }
  }, [report]);

  useEffect(() => {
    if (section === 'documents') void reloadDocuments();
  }, [section, reloadDocuments]);

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
          <div className="header-actions"><button className="ghost" onClick={() => void reloadDocuments()}>Refresh</button><button onClick={() => setActionOpen('upload')}>+ Upload document</button></div>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Document</th><th>Type</th><th>Scope</th><th>Entity</th><th>Status</th><th>Expiry</th><th /></tr></thead><tbody>
          {documents.map(d => <tr key={d.id}><td>{d.documentNo}<small className="subtle">{d.fileName}</small></td><td>{d.documentTypeName ?? d.documentTypeId}</td><td>{d.horseId ? 'Horse' : d.tripId ? 'Trip' : d.requestId ? 'Request' : '—'}</td><td className="mono">{d.horseId ?? d.tripId ?? d.requestId ?? '—'}</td><td><em>{d.status}</em></td><td>{d.expiryDate ?? '—'}</td><td>{reviewer && <span className="header-actions"><button className="small" onClick={async () => { try { await reviewDocument(d.id, 'APPROVED', ''); notify('Document approved.'); await reloadDocuments(); } catch (e) { report(errorText(e)); } }}>Approve</button><button className="danger small" onClick={async () => { const comment = window.prompt('Reason for rejection:'); if (!comment?.trim()) return; try { await reviewDocument(d.id, 'REJECTED', comment); notify('Document rejected.'); await reloadDocuments(); } catch (e) { report(errorText(e)); } }}>Reject</button></span>}</td></tr>)}
          {!documents.length && <tr><td colSpan={7}>No compliance documents found.</td></tr>}
        </tbody></table></div>
      </section>
      {actionOpen === 'upload' && <ActionModal title="Upload compliance document" description="Attach evidence to a horse, request, or trip." onClose={() => setActionOpen(null)}>
        <form className="form-grid" onSubmit={upload}>
          <label>Document type<select name="documentTypeId" required defaultValue=""><option value="" disabled>Select type</option>{types.map(t => <option key={t.id} value={t.id}>{t.name} · {t.scope}</option>)}</select></label>
          <label>Horse ID<input name="horseId" /></label><label>Request ID<input name="requestId" /></label><label>Trip ID<input name="tripId" /></label>
          <label>Issue date<input name="issueDate" type="date" /></label><label>Expiry date<input name="expiryDate" type="date" /></label>
          <label>Issuing authority<input name="issuingAuthority" /></label><label className="span-2">File<input name="file" type="file" required /></label>
          <div className="modal-actions"><button type="button" className="ghost" onClick={() => setActionOpen(null)}>Cancel</button><button disabled={busy}>{busy ? 'Uploading…' : 'Upload document'}</button></div>
        </form>
      </ActionModal>}
    </div>;
  }

  if (section === 'readiness') {
    return <section className="panel">
      <div className="panel-title"><div><h2>Trip compliance readiness</h2><p>Evaluate required documents for route countries and horses.</p></div></div>
      <form className="form-grid" onSubmit={evaluate}>
        <label>Trip ID<input name="tripId" required /></label><label>Origin country ID<input name="originCountryId" required /></label>
        <label>Destination country ID<input name="destinationCountryId" required /></label><label>Horse IDs (comma-separated)<input name="horseIds" /></label>
        <label>Departure date<input name="plannedDepartureDate" type="date" /></label><button disabled={busy}>{busy ? 'Evaluating…' : 'Evaluate requirements'}</button>
      </form>
      {readiness && <div className="readiness"><div><h3>{readiness.isReady ? 'Ready for departure' : 'Compliance blockers'}</h3><p>{readiness.metRequirements}/{readiness.totalRequirements} requirements met · {readiness.missingRequirements} missing · {readiness.expiredRequirements} expired · {readiness.pendingReviewRequirements} in review</p>{readiness.items.filter(i => !i.isMet).map((item, index) => <p className="blocker" key={index}>{item.documentTypeName}: {item.status}{item.notes ? ' — ' + item.notes : ''}</p>)}</div></div>}
    </section>;
  }

  return <div className="stack">
    <section className="panel">
      <div className="panel-title"><div><h2>Border clearance cases</h2><p>Find and manage country-specific clearance records for a trip.</p></div><button onClick={() => setActionOpen('clearance')}>+ New case</button></div>
      <form className="inline-form" onSubmit={loadClearances}><label>Trip ID<input name="tripId" placeholder="Enter a trip UUID" required /></label><button disabled={busy}>{busy ? 'Loading…' : 'Load cases'}</button></form>
      <div className="table-wrap"><table><thead><tr><th>Case</th><th>Country</th><th>Authority</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {clearances.map(c => <tr key={c.id}><td>{c.caseNo}</td><td className="mono">{c.countryId}</td><td>{c.authorityName}</td><td><em>{c.status}</em></td><td><span className="header-actions"><button className="ghost small" onClick={async () => { try { await submitClearanceCase(c.id); notify('Clearance case submitted.'); setClearances(await getClearanceCases(c.tripId)); } catch (e) { report(errorText(e)); } }}>Submit</button>{reviewer && <button className="small" onClick={async () => { const reason = window.prompt('Review note (optional):') ?? ''; try { await reviewClearanceCase(c.id, 'APPROVED', reason); notify('Clearance case approved.'); setClearances(await getClearanceCases(c.tripId)); } catch (e) { report(errorText(e)); } }}>Approve</button>}</span></td></tr>)}
        {!clearances.length && <tr><td colSpan={5}>Enter a trip ID to load clearance cases.</td></tr>}
      </tbody></table></div>
    </section>
    {actionOpen === 'clearance' && <ActionModal title="New border clearance case" description="Create a country-specific clearance record for a trip." onClose={() => setActionOpen(null)}>
      <form className="form-grid" onSubmit={makeClearance}>
        <label>Trip ID<input name="tripId" required /></label><label>Country ID<input name="countryId" required /></label>
        <label>Authority name<input name="authorityName" required /></label><label>Reference number<input name="referenceNumber" /></label>
        <label className="span-2">Notes<input name="notes" /></label>
        <div className="modal-actions"><button type="button" className="ghost" onClick={() => setActionOpen(null)}>Cancel</button><button disabled={busy}>{busy ? 'Creating…' : 'Create case'}</button></div>
      </form>
    </ActionModal>}
  </div>;
}
function TripsView({ report, notify }: { report: (s: string) => void; notify: (s: string) => void }) {
  const [trip, setTrip] = useState<Trip | null>(null); const [selectedId, setSelectedId] = useState(''); const [tripSearch, setTripSearch] = useState('');
  const [plan, setPlan] = useState<RoutePlan | null>(null); const [versions, setVersions] = useState<RouteVersion[]>([]); const [version, setVersion] = useState<RouteVersion | null>(null);
  const [legs, setLegs] = useState<RecordRow[]>([]); const [readiness, setReadiness] = useState<{ ready: boolean; blockers: string[] } | null>(null);
  const [assignments, setAssignments] = useState<{ resources: RecordRow[]; staff: RecordRow[]; horses: RecordRow[] }>({ resources: [], staff: [], horses: [] });
  const [checkpoints, setCheckpoints] = useState<RecordRow[]>([]);
  const [orderId, setOrderId] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const refreshTrips = useCallback(async () => { if (!selectedId) return; try { setTrip(await getTrip(selectedId)); } catch (e) { report(errorText(e)); } }, [selectedId, report]);
  const loadTrip = useCallback(async () => {
    if (!selectedId) { setPlan(null); setVersions([]); setLegs([]); setReadiness(null); setAssignments({ resources: [], staff: [], horses: [] }); setCheckpoints([]); return; }
    try {
      setPlan(null); setVersions([]); setVersion(null); setTrip(null);
      const t = await getTrip(selectedId); setTrip(t);
      const [r, a] = await Promise.all([getReadiness(selectedId), getAssignments(selectedId)]);
      setAssignments(a);
      setReadiness(r); setVersion(null);
      const active = null as RouteVersion | null;
      setLegs(active ? await getLegs(active.id) : []);
      const firstLeg = active ? (await getLegs(active.id))[0] : null;
      setCheckpoints(firstLeg ? await getCheckpoints(firstLeg.id) : []);
    } catch (e) { if (e instanceof ApiError && e.status === 404) { setTrip(null); setPlan(null); setVersions([]); setLegs([]); } else report(errorText(e)); }
  }, [selectedId, report]);
  useEffect(() => { void loadTrip(); }, [loadTrip]);
  async function run(fn: () => Promise<unknown>, message: string) { setBusy(true); report(''); try { await fn(); notify(message); if (selectedId) await refreshTrips(); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
  async function onCreateTrip(e: FormEvent) { e.preventDefault(); setBusy(true); report(''); try { const created = await createTrip(orderId); setSelectedId(created.id); setTrip(created); setOrderId(''); notify('Trip created.'); } catch (e) { report(errorText(e)); } finally { setBusy(false); } }
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
  return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>Trips</h2><p>Look up a trip by ID; BE currently has no trip-list endpoint.</p></div><button className="ghost" onClick={() => void refreshTrips()} disabled={!selectedId}>Refresh</button></div><form className="inline-form" onSubmit={e => { e.preventDefault(); setSelectedId(tripSearch.trim()); }}><Input label="Trip ID" value={tripSearch} onChange={setTripSearch} required /><button disabled={busy}>Load trip</button></form><form className="inline-form" onSubmit={onCreateTrip}><Input label="Booking Order ID" value={orderId} onChange={setOrderId} required /><button disabled={busy}>Create trip</button></form>{trip && <div className="assignment-row"><b>{trip.tripNo}</b><span>{trip.status} · Order {trip.orderId} · {trip.complianceReady ? 'Compliance ready' : 'Compliance pending'}</span></div>}</section>
  {selectedId && trip && <section className="panel"><div className="panel-title"><div><h2>Route planning</h2><p>Trip {trip.tripNo}. A route plan can only be recovered after reload when BE exposes GET route-plan-by-trip.</p></div><div className="header-actions">{!plan ? <button disabled={busy} onClick={() => void run(async () => { const p = await createPlan(selectedId); setPlan(p); const v = await getVersions(p.id); setVersions(v); setVersion(v.at(-1) ?? null); }, 'Route plan created.')}>Create route plan</button> : <><form className="inline-form compact" onSubmit={e => { e.preventDefault(); void run(async () => { const v = await newVersion(plan.id, reason); setReason(''); setVersion(v); setVersions(await getVersions(plan.id)); }, 'New draft version created.'); }}><input aria-label="Version reason" placeholder="Reason for new version" value={reason} onChange={e => setReason(e.target.value)} /><button className="ghost" disabled={busy}>New version</button></form></>}</div></div>
    {plan && <><div className="version-bar"><span>Route plan v{plan.versionNo}</span><select value={version?.id ?? ''} onChange={e => setVersion(versions.find(v => v.id === e.target.value) ?? null)}>{versions.map(v => <option key={v.id} value={v.id}>Version {v.versionNo} · {v.status}</option>)}</select><div className="header-actions">{version && ['DRAFT','REJECTED'].includes(version.status.toUpperCase()) && <button className="ghost" disabled={busy} onClick={() => void run(() => action(`/api/v1/route-plan-versions/${version.id}/submit`), 'Version submitted for approval.')}>Submit</button>}{version && version.status.toUpperCase() === 'PENDING_APPROVAL' && <button className="ghost" disabled={busy} onClick={() => void run(() => action(`/api/v1/route-plan-versions/${version.id}/approve`), 'Version approved.')}>Approve</button>}{version && version.status.toUpperCase() === 'APPROVED' && <button disabled={busy} onClick={() => void run(() => action(`/api/v1/route-plan-versions/${version.id}/activate`), 'Version activated.')}>Activate</button>}</div></div>
    <div className="table-wrap"><table><thead><tr><th>Leg</th><th>From</th><th>To</th><th>Mode</th><th>Status</th></tr></thead><tbody>{legs.map(l => <tr key={l.id}><td>{l.sequenceNo}</td><td className="mono">{l.originLocationId}</td><td className="mono">{l.destinationLocationId}</td><td>{l.transportMode}</td><td>{l.status}</td></tr>)}{!legs.length && <tr><td colSpan={5}>No route legs in this version yet.</td></tr>}</tbody></table></div>
    {legs.length > 0 && <div className="planning-tools"><section><h3>Route-leg checkpoints</h3><p>For leg {legs[0].sequenceNo} · enter the Location ID.</p>{checkpoints.map(cp => <div className="assignment-row" key={cp.id}><span>#{cp.sequenceNo} · {cp.type}</span><span className="mono">{cp.locationId}</span></div>)}<form className="form-grid" onSubmit={onAddCheckpoint}><label>Location ID<input name="locationId" required /></label><label>Checkpoint type<input name="type" placeholder="REST_STOP" required /></label><label>Arrival<input name="arrivalAt" type="datetime-local" required /></label><label>Departure<input name="departureAt" type="datetime-local" required /></label><button disabled={busy}>Add checkpoint</button></form></section>
      <section><h3>Resource assignment</h3><p>Assign a vehicle or flight booking to leg {legs[0].sequenceNo}.</p>{assignments.resources.map(a => <div className="assignment-row" key={a.id}><span>{a.vehicleId ? 'Vehicle' : 'Flight'}</span><span className="mono">{a.vehicleId ?? a.flightBookingId}</span></div>)}<form className="form-grid" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => assignResource(legs[0].id, { vehicleId: String(f.get('vehicleId') || '') || null, flightBookingId: String(f.get('flightBookingId') || '') || null }), 'Resource assigned.'); e.currentTarget.reset(); }}><label>Vehicle ID<input name="vehicleId" /></label><label>Flight booking ID<input name="flightBookingId" /></label><button disabled={busy}>Assign resource</button></form></section>
      <section><h3>Staff assignment</h3>{assignments.staff.map(a => <div className="assignment-row" key={a.id}><span>{a.role}</span><span className="mono">{a.userId}</span></div>)}<form className="form-grid" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => assignStaff(selectedId, { legId: legs[0].id, userId: f.get('userId'), role: f.get('role') }), 'Staff member assigned.'); e.currentTarget.reset(); }}><label>Staff user ID<input name="userId" required /></label><label>Role<input name="role" placeholder="VETERINARIAN" required /></label><button disabled={busy}>Assign staff</button></form></section>
      <section><h3>Horse assignment</h3>{assignments.horses.map(a => <div className="assignment-row" key={a.id}><span>Horse</span><span className="mono">{a.horseId} · {a.stallId ?? 'no stall'}</span></div>)}<form className="form-grid" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => assignHorse(selectedId, { horseId: f.get('horseId'), legId: legs[0].id, stallId: String(f.get('stallId') || '') || null }), 'Horse assigned.'); e.currentTarget.reset(); }}><label>Horse ID<input name="horseId" required /></label><label>Stall ID<input name="stallId" /></label><button disabled={busy}>Assign horse</button></form></section></div>}
    {version && version.status.toUpperCase() === 'DRAFT' && <form className="form-grid leg-form" onSubmit={onAddLeg}><h3>Add route leg</h3><label>Sequence<input name="sequenceNo" type="number" min="1" defaultValue={legs.length + 1} required /></label><label>Origin location ID<input name="originLocationId" required /></label><label>Destination location ID<input name="destinationLocationId" required /></label><label>Mode<select name="mode"><option>ROAD</option><option>AIR</option><option>SEA</option></select></label><label>Departure<input name="departureAt" type="datetime-local" required /></label><label>Arrival<input name="arrivalAt" type="datetime-local" required /></label><label>Distance km<input name="distanceKm" type="number" min="0" step="0.1" /></label><button disabled={busy}>Add leg</button></form>}
    </>}
    <div className="readiness"><div><h3>Pre-departure readiness</h3><p>{readiness ? readiness.ready ? 'No blockers reported.' : `${readiness.blockers.length} blocker(s) need attention.` : 'Loading readiness…'}</p>{readiness?.blockers.map((b,i) => <p className="blocker" key={i}>• {b}</p>)}</div>{readiness?.ready && <button disabled={busy} onClick={() => void run(() => action(`/api/v1/trips/${selectedId}/confirm-ready`), 'Trip confirmed ready.')}>Confirm READY</button>}</div>
  </section>}</div>;
}

function FleetView({ report, notify }: { report: (s: string) => void; notify: (s: string) => void }) {
  const [resource, setResource] = useState(fleet[0]); const [rows, setRows] = useState<RecordRow[]>([]); const [editing, setEditing] = useState<RecordRow | null>(null); const [values, setValues] = useState<Record<string,string>>({}); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setRows(await getRows(resource.key)); } catch (e) { report(errorText(e)); } }, [resource, report]);
  useEffect(() => { setEditing(null); setValues({}); void load(); }, [load]);
  function edit(row?: RecordRow) { setEditing(row ?? null); setValues(Object.fromEntries(resource.fields.map(field => [field, String(row?.[field] ?? (field === 'active' || field === 'temperatureControlled' ? false : ''))]))); }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    const input: Record<string, unknown> = {};
    for (const f of resource.fields) { const bool = ['active','temperatureControlled'].includes(f); const numeric = ['horseCapacity','stallCapacity','capacity','latitude','longitude'].includes(f); input[f] = bool ? values[f] === 'true' : numeric ? (values[f] === '' ? null : Number(values[f])) : values[f] === '' ? null : values[f]; }
    try { await saveRow(resource.key, editing?.id, input); notify(`${resource.title} record saved.`); edit(); await load(); }
    catch (e) { report(errorText(e)); } finally { setBusy(false); }
  }
  async function remove(row: RecordRow) { if (!window.confirm(`Delete ${row.name ?? row.vehicleCode ?? row.stallCode ?? row.id}?`)) return; try { await deleteRow(resource.key, row.id); notify('Record deleted.'); await load(); } catch (e) { report(errorText(e)); } }
  const columns = resource.fields.slice(0, 5);
  return <div className="stack"><section className="panel"><div className="panel-title"><div><h2>Fleet reference data</h2><p>Manage the master records used when composing routes and assignments.</p></div><button onClick={() => edit()}>+ Add {resource.title.slice(0,-1)}</button></div><div className="tabs">{fleet.map(item => <button key={item.key} className={resource.key === item.key ? 'tab-active' : 'ghost'} onClick={() => setResource(item)}>{item.title}</button>)}</div><div className="table-wrap"><table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(c => <td key={c}>{typeof row[c] === 'boolean' ? row[c] ? 'Yes' : 'No' : row[c] ?? '—'}</td>)}<td><button className="ghost small" onClick={() => edit(row)}>Edit</button> <button className="danger small" onClick={() => void remove(row)}>Delete</button></td></tr>)}{!rows.length && <tr><td colSpan={columns.length+1}>No records found for {resource.title.toLowerCase()}.</td></tr>}</tbody></table></div></section>
    {editing !== null || Object.keys(values).length > 0 ? <section className="panel"><div className="panel-title"><h2>{editing ? 'Edit' : 'Create'} {resource.title}</h2><button className="ghost" onClick={() => { setEditing(null); setValues({}); }}>Cancel</button></div><form className="form-grid" onSubmit={save}>{resource.fields.map(f => <Input key={f} label={f} value={values[f] ?? ''} onChange={v => setValues(old => ({ ...old, [f]: v }))} type={['active','temperatureControlled'].includes(f) ? 'boolean' : ['horseCapacity','stallCapacity','capacity','latitude','longitude'].includes(f) ? 'number' : f.toLowerCase().includes('at') ? 'datetime-local' : 'text'} required={f.endsWith('Code') || ['name','vehicleType','plateNumber','capacity','horseCapacity','bookingReference','airlineId','flightNumber','originAirportId','destinationAirportId','scheduledDepartureAt','scheduledArrivalAt'].includes(f)} />)}<button disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button></form></section> : null}</div>;
}
