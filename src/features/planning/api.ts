import { api, json, pagedApi } from '../../core/api';

export type Trip = { id: string; tripNo: string; orderId?: string; status: string; complianceReady: boolean; versionNo: number; plannedDepartureAt?: string; plannedArrivalAt?: string; originLocationId?: string; destinationLocationId?: string; customPickupLatitude?: number; customPickupLongitude?: number; customPickupLabel?: string; orderCount?: number; mergedIntoTripId?: string; customerNames?: string[]; horseNames?: string[] };
export type TripOrder = { orderId: string; orderNo?: string; requestNo?: string; requestId?: string; customerId?: string; customerName?: string; horseNames?: Record<string, string>; originLocationId?: string; destinationLocationId?: string; requestedDepartureAt?: string; requestedArrivalAt?: string; preferredTransportMode?: string; horseIds: string[]; receiverName?: string; receiverPhone?: string; receiverEmail?: string; completedAt?: string; paymentStatus?: string };
export type DispatchCalendarDay = { date: string; orderCount: number; tripCount: number; unassignedOrderCount: number };
export type RouteTemplate = { id: string; name: string; originLocationId: string; destinationLocationId: string; transportMode: string; points: { latitude: number; longitude: number }[]; createdAt: string; customPickupLatitude?: number | null; customPickupLongitude?: number | null };
export type RouteTemplateInput = { name: string; originLocationId: string; destinationLocationId: string; transportMode: string; points: { latitude: number; longitude: number }[]; customPickupLatitude?: number | null; customPickupLongitude?: number | null };
export type Location = { id: string; locationCode?: string; name: string; locationType: string; address?: string; city?: string; countryId: string; latitude?: number; longitude?: number; active: boolean };
export type CountryReference = { id: string; isoCode: string; name: string; active: boolean };
export type EstimatedRouteDuration = { mode: string; minDurationMinutes: number; maxDurationMinutes: number; minExpressDurationMinutes?: number; maxExpressDurationMinutes?: number };
export type RouteCapabilities = { originLocationId: string; destinationLocationId: string; configured: boolean; allowedModes: string[]; estimatedDurations: EstimatedRouteDuration[] };
export type RoutePlan = { id: string; tripId: string; activeVersionId?: string; versionNo: number };
export type RouteVersion = { id: string; routePlanId: string; versionNo: number; status: string; reason?: string; totalDistanceKm?: number };
export type CellValue = string | number | boolean | null | undefined;
export type RecordRow = Record<string, CellValue> & { id: string };
export type AssignmentSummary = { resources: RecordRow[]; staff: RecordRow[]; horses: RecordRow[] };
export type StaffAccount = { id: string; email: string; fullName: string; role: 'DRIVER' | 'ESCORT' | 'DRIVER_ESCORT' };
export type StaffRouteCountry = { countryId: string; countryName: string; validUntil?: string };
export type StaffOperatingArea = { id: string; userId: string; locationId: string; locationName: string; city: string; countryName: string; latitude: number; longitude: number; radiusKm: number; updatedAt: string };
export type NearestDriver = { userId: string; distanceKm: number; operatingAreaName: string; areaUpdatedAt: string };
export type ResourceName = 'countries' | 'locations' | 'vehicles' | 'stalls' | 'airlines' | 'flight-bookings';

export const getTrip = (id: string) => api<Trip>(`/api/v1/trips/${id}`);
export const getTripOrders = (id: string) => api<TripOrder[]>(`/api/v1/trips/${id}/orders`);
export const getDispatchCalendar = (year: number, month: number) => api<DispatchCalendarDay[]>(`/api/v1/dispatch-calendar?year=${year}&month=${month}`);
export const getDispatchOrders = (date: string) => api<TripOrder[]>(`/api/v1/dispatch-orders?date=${date}`);
export const searchDispatchOrders = (search: string) => api<TripOrder[]>(`/api/v1/dispatch-orders?${new URLSearchParams({ search })}`);
export const createDispatchTrip = (orderIds: string[]) => api<{ trip: Trip; orders: TripOrder[] }>('/api/v1/dispatch-trips', json('POST', { orderIds }));
export const getCustomerCountry = (id: string) => api<CountryReference>(`/api/v1/customer/countries/${id}`);
export const getCustomerCountries = () => api<CountryReference[]>('/api/v1/customer/countries?page=0&pageSize=100');
export const getRouteCapabilities = (originLocationId: string, destinationLocationId: string) => api<RouteCapabilities>(`/api/v1/route-capabilities?${new URLSearchParams({ originLocationId, destinationLocationId })}`);
export const getRouteCapabilityCatalog = () => api<RouteCapabilities[]>('/api/v1/route-capabilities/catalog');
export const saveRouteCapability = (value: { originLocationId: string; destinationLocationId: string; allowedModes: string[]; estimatedDurations: EstimatedRouteDuration[] }) => api<RouteCapabilities>('/api/v1/route-capabilities', json('PUT', value));
export const setCountrySupport = (id: string, active: boolean) => api<CountryReference>(`/api/v1/countries/${id}/support`, json('PUT', { active }));
export const getTrips = (page = 0, pageSize = 100, search = '', status = '', sortBy = 'departure', sortDirection = 'desc', date = '') => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) query.set('search', search.trim());
  if (status) query.set('status', status);
  if (sortBy) query.set('sortBy', sortBy);
  if (sortDirection) query.set('sortDirection', sortDirection);
  if (date) query.set('date', date);
  return pagedApi<Trip[]>(`/api/v1/trips?${query}`);
};
export async function getAllTrips() {
  const first = await getTrips(0, 100);
  const pages = await Promise.all(Array.from({ length: Math.max(first.pagination.totalPages - 1, 0) }, (_, index) => getTrips(index + 1, 100)));
  return [ ...first.data, ...pages.flatMap(page => page.data) ];
}
export const getMyTrips = (page = 0, pageSize = 10, search = '', status = '', sortBy = 'departure', sortDirection = 'desc') => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) query.set('search', search.trim());
  if (status) query.set('status', status);
  if (sortBy) query.set('sortBy', sortBy);
  if (sortDirection) query.set('sortDirection', sortDirection);
  return pagedApi<Trip[]>(`/api/v1/my-trips?${query}`);
};
export const getMyTripOrders = (tripId: string) => api<TripOrder[]>(`/api/v1/my-trips/${tripId}/orders`);
export async function getAllMyTrips() {
  const first = await getMyTrips(0, 100);
  const pages = await Promise.all(Array.from({ length: Math.max(first.pagination.totalPages - 1, 0) }, (_, index) => getMyTrips(index + 1, 100)));
  return [...first.data, ...pages.flatMap(page => page.data)];
}
export const getStaffDirectory = () => api<StaffAccount[]>('/api/v1/manager/staff');
export const getStaffRouteCountries = (userId: string) => api<StaffRouteCountry[]>(`/api/v1/staff/${userId}/route-countries`);
export const saveStaffRouteCountries = (userId: string, input: { countryIds: string[]; validUntil?: string | null }) => api<StaffRouteCountry[]>(`/api/v1/staff/${userId}/route-countries`, json('PUT', input));
export const getStaffOperatingAreas = (userId: string) => api<StaffOperatingArea[]>(`/api/v1/staff/${userId}/operating-areas`);
export const saveStaffOperatingAreas = (userId: string, areas: { locationId: string; radiusKm: number }[]) => api<StaffOperatingArea[]>(`/api/v1/staff/${userId}/operating-areas`, json('PUT', { areas }));
export const getNearestDrivers = (routeLegId: string) => api<NearestDriver[]>(`/api/v1/route-legs/${routeLegId}/nearest-drivers`);
export const getBookingLocations = (page = 0, pageSize = 100) => pagedApi<Location[]>(`/api/v1/booking/locations?page=${page}&pageSize=${pageSize}`);
export const createTrip = (input: { orderId: string; requestId?: string; originLocationId?: string; destinationLocationId?: string; requestedDepartureAt?: string; requestedArrivalAt?: string; preferredTransportMode?: string }) => api<Trip>('/api/v1/trips', json('POST', input));
export const getRoutePlanByTrip = (tripId: string) => api<RoutePlan>(`/api/v1/trips/${tripId}/route-plan`);
export const createPlan = (tripId: string) => api<RoutePlan>(`/api/v1/trips/${tripId}/route-plans`, json('POST'));
export const getVersions = (planId: string) => api<RouteVersion[]>(`/api/v1/route-plans/${planId}/versions`);
export const newVersion = (planId: string, reason: string) => api<RouteVersion>(`/api/v1/route-plans/${planId}/versions`, json('POST', { reason }));
export const getLegs = (versionId: string) => api<RecordRow[]>(`/api/v1/route-plan-versions/${versionId}/legs`);
export const addLeg = (versionId: string, input: unknown) => api<RecordRow>(`/api/v1/route-plan-versions/${versionId}/legs`, json('POST', input));
export const updateLeg = (legId: string, input: unknown) => api<RecordRow>(`/api/v1/route-legs/${legId}`, json('PUT', input));
export const saveRouteShape = (legId: string, points: { latitude: number; longitude: number }[]) => api<RecordRow>(`/api/v1/route-legs/${legId}/shape`, json('PUT', { points }));
export const getRouteTemplates = (originLocationId?: string, destinationLocationId?: string, mode?: string, pickupLatitude?: number | null, pickupLongitude?: number | null) => {
  const query = new URLSearchParams();
  if (originLocationId) query.set('originLocationId', originLocationId);
  if (destinationLocationId) query.set('destinationLocationId', destinationLocationId);
  if (mode) query.set('mode', mode);
  if (pickupLatitude != null && pickupLongitude != null) { query.set('pickupLatitude', String(pickupLatitude)); query.set('pickupLongitude', String(pickupLongitude)); }
  return api<RouteTemplate[]>(`/api/v1/route-legs/templates?${query}`);
};
export const createRouteTemplate = (input: RouteTemplateInput) => api<RouteTemplate>('/api/v1/route-legs/templates', json('POST', input));
export const getCheckpoints = (legId: string) => api<RecordRow[]>(`/api/v1/route-legs/${legId}/checkpoints`);
export const addCheckpoint = (legId: string, input: unknown) => api<RecordRow>(`/api/v1/route-legs/${legId}/checkpoints`, json('POST', input));
export const getAssignments = (tripId: string) => api<AssignmentSummary>(`/api/v1/trips/${tripId}/assignments`);
export const assignResource = (legId: string, input: unknown) => api<RecordRow>(`/api/v1/route-legs/${legId}/assignments/resource`, json('POST', input));
export const assignStaff = (tripId: string, input: unknown) => api<RecordRow>(`/api/v1/trips/${tripId}/staff-assignments`, json('POST', input));
export const assignHorse = (tripId: string, input: unknown) => api<RecordRow>(`/api/v1/trips/${tripId}/horse-assignments`, json('POST', input));
export const getReadiness = (tripId: string) => api<{ ready: boolean; blockers: string[] }>(`/api/v1/trips/${tripId}/readiness`);
export const action = (path: string) => api(path, json('POST'));
export async function getRows(resource: ResourceName) {
  if (resource !== 'flight-bookings') return api<RecordRow[]>(`/api/v1/${resource}?page=0&pageSize=100`);
  const first = await pagedApi<RecordRow[]>('/api/v1/flight-bookings?page=0&pageSize=100');
  const rest = await Promise.all(Array.from({ length: Math.max(first.pagination.totalPages - 1, 0) }, (_, index) => pagedApi<RecordRow[]>(`/api/v1/flight-bookings?page=${index + 1}&pageSize=100`)));
  return [...first.data, ...rest.flatMap(page => page.data)];
}
export const saveRow = (resource: ResourceName, id: string | undefined, input: unknown) => api<RecordRow>(`/api/v1/${resource}${id ? `/${id}` : ''}`, json(id ? 'PUT' : 'POST', input));
export const deleteRow = (resource: ResourceName, id: string) => api<void>(`/api/v1/${resource}/${id}`, json('DELETE'));
export const confirmFlightBooking = (id: string) => api<RecordRow>(`/api/v1/flight-bookings/${id}/confirm`, json('POST'));
export const cancelFlightBooking = (id: string) => api<RecordRow>(`/api/v1/flight-bookings/${id}/cancel`, json('POST'));
