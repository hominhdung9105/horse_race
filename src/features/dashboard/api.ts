import { api } from '../../core/api';

export type BookingDashboardSummary = {
  totalCustomers: number;
  totalHorses: number;
  activeHorses: number;
  totalRequests: number;
  pendingReviewRequests: number;
  approvedRequests: number;
  totalOrders: number;
};

export type IdentityDashboardSummary = {
  activeUsers: number;
  customerAccounts: number;
  sessionsLast30Days: number;
  activeUsersLast30Days: number;
};

export const getBookingDashboard = () => api<BookingDashboardSummary>('/api/v1/manager/dashboard/booking');
export const getIdentityDashboard = () => api<IdentityDashboardSummary>('/api/v1/manager/dashboard/identity');
