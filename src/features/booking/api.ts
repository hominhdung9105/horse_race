import { api, json, pagedApi } from '../../core/api';

export type Horse = { id: string; horseCode: string; horseName: string; registrationNumber?: string; passportNumber?: string; breed?: string; sex?: string; dateOfBirth?: string; color?: string; countryOfOriginId?: string; countryOfOriginName?: string; specialRequirements?: string; status: string; versionNo: number };
export type CustomerProfile = { id: string; customerCode: string; name: string; customerType: string; contactPerson?: string; phone?: string; email?: string; address?: string; countryId?: string; versionNo: number };
export type RequestSummary = { id: string; requestNo: string; status: string; requestedDepartureAt: string; createdAt: string; horseCount: number; horseNames: string; versionNo: number };
export type TransportRequest = RequestSummary & { customerId: string; createdByUserId: string; originLocationId?: string; destinationLocationId?: string; customPickupLatitude?: number; customPickupLongitude?: number; customPickupLabel?: string; requestedArrivalAt?: string; preferredTransportMode?: string; deliveryPriority?: 'STANDARD' | 'EXPRESS'; specialRequirements?: string; notes?: string; recipientIsRequester?: boolean; recipientName?: string; recipientPhone?: string; recipientEmail?: string; horseIds: string[]; horses?: { id: string; horseName: string; horseCode: string; breed?: string; sex?: string; dateOfBirth?: string; color?: string; countryOfOriginId?: string; specialRequirements?: string; status?: string }[]; orderId?: string; orderNo?: string; reviewReason?: string };
export type TransportRequestHistoryEntry = { id: string; action: string; oldState?: string; newState?: string; actorUserId: string; reason?: string; occurredAt: string };
export type StaffDisplayName = { id: string; fullName: string };
export type BookingLeadTimeInfo = { minimumLeadTimeDays: number; earliestDepartureAt: string };
export type NearestReceivingLocation = { location: { id: string; name: string; locationType: string; address?: string; city?: string; latitude?: number; longitude?: number }; distanceKm: number };
export type RequestDocumentChecklist = { ready: boolean; items: { horseId: string; documentTypeCode: string; documentTypeName: string; uploaded: boolean; met: boolean; status: string; documentNo?: string; expiryDate?: string }[] };
export type RequestDocumentReviewResult = { documentId: string; status: string };
export type HorseAvailability = { horseId: string; eligible: boolean; horseStatus: string; blocker?: string }[];

export const getProfile = () => api<CustomerProfile>('/api/v1/customers/me');
export const saveProfile = (value: Partial<CustomerProfile>) => api<CustomerProfile>('/api/v1/customers/me', json('PUT', value));
function pageQuery(page: number, pageSize: number, search = '', status = '', sortBy = '', sortDirection = '') {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) query.set('search', search.trim());
  if (status) query.set('status', status);
  if (sortBy) query.set('sortBy', sortBy);
  if (sortDirection) query.set('sortDirection', sortDirection);
  return query.toString();
}
export const getHorses = (page = 0, pageSize = 10, search = '', status = '', sortBy = 'name', sortDirection = 'asc') => pagedApi<Horse[]>(`/api/v1/horses?${pageQuery(page, pageSize, search, status, sortBy, sortDirection)}`);
export const getHorse = (id: string) => api<Horse>(`/api/v1/horses/${id}`);
export const saveHorse = (value: Partial<Horse>, id?: string) => api<Horse>(`/api/v1/horses${id ? `/${id}` : ''}`, json(id ? 'PUT' : 'POST', value));
export const deleteHorse = (id: string) => api<void>(`/api/v1/horses/${id}`, json('DELETE'));
export const getRequests = (page = 0, pageSize = 10, search = '', status = '', sortBy = 'created', sortDirection = 'desc') => pagedApi<RequestSummary[]>(`/api/v1/transport-requests?${pageQuery(page, pageSize, search, status, sortBy, sortDirection)}`);
export const getManagerQueue = (page = 0, pageSize = 10, search = '', status = '', sortBy = 'submitted', sortDirection = 'asc') => pagedApi<RequestSummary[]>(`/api/v1/manager/transport-requests?${pageQuery(page, pageSize, search, status, sortBy, sortDirection)}`);
export const getRequest = (id: string, manager = false) => api<TransportRequest>(`${manager ? '/api/v1/manager/transport-requests' : '/api/v1/transport-requests'}/${id}`);
export const getRequestHistory = (id: string) => api<TransportRequestHistoryEntry[]>(`/api/v1/transport-requests/${id}/history`);
export const getStaffDisplayNames = (ids: string[]) => {
  const query = new URLSearchParams();
  ids.forEach(id => query.append('ids', id));
  return ids.length ? api<StaffDisplayName[]>(`/api/v1/staff/display-names?${query}`) : Promise.resolve([] as StaffDisplayName[]);
};
export const getBookingLeadTime = (originLocationId: string, destinationLocationId: string) => {
  const query = new URLSearchParams({ originLocationId, destinationLocationId });
  return api<BookingLeadTimeInfo>(`/api/v1/transport-requests/lead-time?${query}`);
};
export const getNearestReceivingLocation = (latitude: number, longitude: number) => api<NearestReceivingLocation>(`/api/v1/booking/locations/nearest-receiving?${new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })}`);
export const getRequestDocumentChecklist = (id: string) => api<RequestDocumentChecklist>(`/api/v1/transport-requests/${id}/document-checklist`);
export const getManagerRequestDocumentChecklist = (id: string) => api<RequestDocumentChecklist>(`/api/v1/manager/transport-requests/${id}/document-checklist`);
export const approveRequestHorseDocument = (requestId: string, horseId: string, documentId: string, comment = '') => api<RequestDocumentReviewResult>(`/api/v1/manager/transport-requests/${requestId}/horses/${horseId}/documents/${documentId}/approve`, json('POST', { comment }));
export const getHorseAvailability = (horseIds: string[], requestId?: string) => { const query = new URLSearchParams(); horseIds.forEach(id => query.append('horseIds', id)); if (requestId) query.set('requestId', requestId); return api<HorseAvailability>(`/api/v1/transport-requests/horse-availability?${query}`); };
export const saveRequest = (value: Partial<TransportRequest>, id?: string, idempotencyKey?: string) => api<TransportRequest>(
  `/api/v1/transport-requests${id ? `/${id}` : ''}`,
  { ...json(id ? 'PUT' : 'POST', value), ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}) },
);
export const submitRequest = (id: string) => api<TransportRequest>(`/api/v1/transport-requests/${id}/submit`, json('POST'));
export const cancelRequest = (id: string, reason: string) => api<TransportRequest>(`/api/v1/transport-requests/${id}/cancel`, json('POST', { reason }));
export const cancelOrder = (id: string, reason: string) => api<{ status: string }>(`/api/v1/orders/${id}/cancel`, json('POST', { reason }));
export type PaymentInvoice = { id: string; orderId: string; orderNo: string; requestId: string; invoiceNo: string; amount: number; currencyCode: string; status: string; providerTransactionId?: string; settlementMethod?: string; settlementReference?: string; settlementEvidenceReference?: string; settledByUserId?: string; settlementNotes?: string; payOsOrderCode?: number; checkoutUrl?: string; qrCode?: string; payOsPaymentLinkId?: string; checkoutCreatedAt?: string; paidAt?: string; createdAt: string; updatedAt: string };
export type PaymentCheckoutLink = { checkoutUrl: string; qrCode?: string; orderCode: number; paymentLinkId?: string };
export type ManualOrderSettlementInput = { paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'OTHER'; referenceNumber: string; evidenceReference?: string; notes?: string };
export const getOrderPayment = (orderId: string) => api<PaymentInvoice>(`/api/v1/orders/${orderId}/payment`);
export const createOrderPaymentCheckout = (orderId: string) => api<PaymentCheckoutLink>(`/api/v1/orders/${orderId}/payment/checkout`, json('POST'));
export const getAdminOrderPayment = (orderId: string) => api<PaymentInvoice>(`/api/v1/admin/orders/${orderId}/payment`);
export const recordManualOrderSettlement = (orderId: string, input: ManualOrderSettlementInput) => api<PaymentInvoice>(`/api/v1/admin/orders/${orderId}/payment/manual-settlement`, json('POST', input));
export const reviewRequest = (id: string, action: 'start-review' | 'request-information' | 'approve' | 'reject', reason = '') => api<TransportRequest>(`/api/v1/manager/transport-requests/${id}/${action}`, json('POST', action === 'start-review' ? undefined : { reason }));
export type DocumentType = { id: string; code: string; name: string; scope: string; description?: string; defaultValidityDays?: number; active: boolean };
export type ComplianceDocument = { id: string; documentNo: string; documentTypeId: string; documentTypeName?: string; horseId?: string; requestId?: string; tripId?: string; fileName: string; status: string; expiryDate?: string; currentReviewNote?: string };
export const getDocumentTypes = () => api<DocumentType[]>('/api/v1/compliance/document-types?active=true');
export const getDocuments = (filter: { requestId?: string; horseId?: string } = {}) => { const query = new URLSearchParams(); if (filter.requestId) query.set('requestId', filter.requestId); if (filter.horseId) query.set('horseId', filter.horseId); return api<ComplianceDocument[]>(`/api/v1/compliance/documents${query.size ? `?${query}` : ''}`); };
export const uploadDocumentFile = (form: FormData) => api<ComplianceDocument>('/api/v1/compliance/documents/upload-file', { method: 'POST', body: form });
export const reviewDocument = (id: string, status: 'APPROVED' | 'REJECTED' | 'NEED_ADDITIONAL_INFO', comment: string) => api<ComplianceDocument>(`/api/v1/compliance/documents/${id}/review`, json('POST', { status, comment }));
export type ComplianceRouteLeg = { routeLegId: string; originCountryId: string; destinationCountryId: string; plannedDepartureAt: string; plannedArrivalAt?: string | null };
export type ComplianceReadiness = { tripId: string; isReady: boolean; blockers: string[]; requirements: { routeLegId: string; ruleCode: string; documentTypeCode: string; targetScope: string; targetEntityId?: string | null; isMet: boolean; status: string; notes?: string | null }[]; clearances: { routeLegId: string; countryId: string; clearanceType: string; caseId?: string | null; isRequired: boolean; isMet: boolean; status: string; notes?: string | null }[]; evaluatedAt: string };
export const evaluateCompliance = (value: { tripId: string; requestIds: string[]; horseIds: string[]; routeLegs: ComplianceRouteLeg[] }) => api<ComplianceReadiness>('/api/v1/compliance/readiness/evaluate', json('POST', value));
export type ClearanceType = 'CUSTOMS' | 'QUARANTINE' | 'INSPECTION';
export type ClearanceCase = { id: string; caseNo: string; tripId: string; routeLegId?: string; clearanceType: ClearanceType; countryId: string; borderPointId?: string; authorityName: string; referenceNumber?: string; status: string; submittedAt?: string; reviewedAt?: string; completedAt?: string; rejectionReason?: string; notes?: string; createdAt?: string; updatedAt?: string; versionNo?: number; documents?: { id: string; clearanceCaseId: string; documentId: string; documentNo?: string; documentTypeName?: string; required: boolean; submittedAt?: string; status: string }[] };
export const getAllClearanceCases = (filter: { search?: string; status?: string; countryId?: string; sortBy?: string; sortDirection?: 'asc' | 'desc' } = {}) => {
  const query = new URLSearchParams();
  if (filter.search?.trim()) query.set('search', filter.search.trim());
  if (filter.status) query.set('status', filter.status);
  if (filter.countryId) query.set('countryId', filter.countryId);
  if (filter.sortBy) query.set('sortBy', filter.sortBy);
  if (filter.sortDirection) query.set('sortDirection', filter.sortDirection);
  return api<ClearanceCase[]>(`/api/v1/compliance/clearance/cases${query.size ? `?${query}` : ''}`);
};
export const getClearanceCases = (tripId: string) => api<ClearanceCase[]>(`/api/v1/compliance/clearance/cases/trip/${tripId}`);
export const createClearanceCase = (value: { tripId: string; routeLegId: string; countryId: string; clearanceType: ClearanceType; authorityName: string; referenceNumber?: string; notes?: string }) => api<ClearanceCase>('/api/v1/compliance/clearance/cases', json('POST', value));
export const submitClearanceCase = (id: string) => api<ClearanceCase>(`/api/v1/compliance/clearance/cases/${id}/submit`, json('POST'));
export const reviewClearanceCase = (id: string, status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEED_ADDITIONAL_INFO' | 'COMPLETED', reason: string) => api<ClearanceCase>(`/api/v1/compliance/clearance/cases/${id}/review`, json('POST', { status, reason }));
