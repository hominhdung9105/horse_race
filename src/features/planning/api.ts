import { api, json, pagedApi } from '../../core/api';

export type Trip = { id: string; tripNo: string; orderId: string; status: string; complianceReady: boolean; versionNo: number; plannedDepartureAt?: string; plannedArrivalAt?: string };
export type Location = { id: string; locationCode?: string; name: string; locationType: string; address?: string; city?: string; countryId: string; latitude?: number; longitude?: number; active: boolean };
export type RoutePlan = { id: string; tripId: string; activeVersionId?: string; versionNo: number };
export type RouteVersion = { id: string; routePlanId: string; versionNo: number; status: string; reason?: string; totalDistanceKm?: number };
export type CellValue = string | number | boolean | null | undefined;
export type RecordRow = Record<string, CellValue> & { id: string };
export type AssignmentSummary = { resources: RecordRow[]; staff: RecordRow[]; horses: RecordRow[] };
export type StaffAccount = { id: string; email: string; fullName: string; role: 'DRIVER' | 'ESCORT' | 'DRIVER_ESCORT' };
export type ResourceName = 'countries' | 'locations' | 'vehicles' | 'stalls' | 'airlines' | 'flight-bookings';

export const getTrip = (id: string) => api<Trip>(`/api/v1/trips/${id}`);
export const getTrips = (page = 0, pageSize = 100, search = '', status = '') => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) query.set('search', search.trim());
  if (status) query.set('status', status);
  return pagedApi<Trip[]>(`/api/v1/trips?${query}`);
};
export async function getAllTrips() {
  const first = await getTrips(0, 100);
  const pages = await Promise.all(Array.from({ length: Math.max(first.pagination.totalPages - 1, 0) }, (_, index) => getTrips(index + 1, 100)));
  return [ ...first.data, ...pages.flatMap(page => page.data) ];
}
export const getMyTrips = () => api<Trip[]>('/api/v1/my-trips');
export const getStaffDirectory = () => api<StaffAccount[]>('/api/v1/manager/staff');
export const getBookingLocations = (page = 0, pageSize = 100) => pagedApi<Location[]>(`/api/v1/booking/locations?page=${page}&pageSize=${pageSize}`);
export const createTrip = (orderId: string) => api<Trip>('/api/v1/trips', json('POST', { orderId }));
export const getRoutePlanByTrip = (tripId: string) => api<RoutePlan>(`/api/v1/trips/${tripId}/route-plan`);
export const createPlan = (tripId: string) => api<RoutePlan>(`/api/v1/trips/${tripId}/route-plans`, json('POST'));
export const getVersions = (planId: string) => api<RouteVersion[]>(`/api/v1/route-plans/${planId}/versions`);
export const newVersion = (planId: string, reason: string) => api<RouteVersion>(`/api/v1/route-plans/${planId}/versions`, json('POST', { reason }));
export const getLegs = (versionId: string) => api<RecordRow[]>(`/api/v1/route-plan-versions/${versionId}/legs`);
export const addLeg = (versionId: string, input: unknown) => api<RecordRow>(`/api/v1/route-plan-versions/${versionId}/legs`, json('POST', input));
export const getCheckpoints = (legId: string) => api<RecordRow[]>(`/api/v1/route-legs/${legId}/checkpoints`);
export const addCheckpoint = (legId: string, input: unknown) => api<RecordRow>(`/api/v1/route-legs/${legId}/checkpoints`, json('POST', input));
export const getAssignments = (tripId: string) => api<AssignmentSummary>(`/api/v1/trips/${tripId}/assignments`);
export const assignResource = (legId: string, input: unknown) => api<RecordRow>(`/api/v1/route-legs/${legId}/assignments/resource`, json('POST', input));
export const assignStaff = (tripId: string, input: unknown) => api<RecordRow>(`/api/v1/trips/${tripId}/staff-assignments`, json('POST', input));
export const assignHorse = (tripId: string, input: unknown) => api<RecordRow>(`/api/v1/trips/${tripId}/horse-assignments`, json('POST', input));
export const getReadiness = (tripId: string) => api<{ ready: boolean; blockers: string[] }>(`/api/v1/trips/${tripId}/readiness`);
export const action = (path: string) => api(path, json('POST'));
export const getRows = (resource: ResourceName) => api<RecordRow[]>(`/api/v1/${resource}?page=0&pageSize=100`);
export const saveRow = (resource: ResourceName, id: string | undefined, input: unknown) => api<RecordRow>(`/api/v1/${resource}${id ? `/${id}` : ''}`, json(id ? 'PUT' : 'POST', input));
export const deleteRow = (resource: ResourceName, id: string) => api<void>(`/api/v1/${resource}/${id}`, json('DELETE'));
