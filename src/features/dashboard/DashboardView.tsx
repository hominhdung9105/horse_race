import { useCallback, useEffect, useMemo, useState } from 'react';
import { getManagerQueue, type RequestSummary } from '../booking/api';
import { getIncidents, getOperationsKpis, type Incident, type OperationsKpis } from '../operations/api';
import { getBookingDashboard, getIdentityDashboard, type BookingDashboardSummary, type IdentityDashboardSummary } from './api';

type Props = { userName: string; report: (message: string) => void };

const integer = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export default function DashboardView({ userName, report }: Props) {
  const [booking, setBooking] = useState<BookingDashboardSummary | null>(null);
  const [identity, setIdentity] = useState<IdentityDashboardSummary | null>(null);
  const [finance, setFinance] = useState<OperationsKpis | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [queue, setQueue] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setWarning('');
    const results = await Promise.allSettled([
      getBookingDashboard(), getIdentityDashboard(), getOperationsKpis(), getIncidents(1), getManagerQueue(0, 5),
    ]);
    if (results[0].status === 'fulfilled') setBooking(results[0].value);
    if (results[1].status === 'fulfilled') setIdentity(results[1].value);
    if (results[2].status === 'fulfilled') setFinance(results[2].value);
    if (results[3].status === 'fulfilled') setIncidents(results[3].value);
    if (results[4].status === 'fulfilled') setQueue(results[4].value.data);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length === results.length) report('Dashboard data is temporarily unavailable.');
    else if (failures.length) setWarning('Some live metrics are temporarily unavailable; available sections are still shown.');
    setLoading(false);
  }, [report]);

  useEffect(() => { void load(); }, [load]);

  const openIncidents = incidents.filter(item => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(item.status.toUpperCase())).length;
  const financialRows = useMemo(() => {
    const currencies = new Set([...(finance?.revenue ?? []).map(item => item.currencyCode), ...(finance?.costs ?? []).map(item => item.currencyCode)]);
    return [...currencies].sort().map(currencyCode => {
      const revenue = finance?.revenue.find(item => item.currencyCode === currencyCode)?.amount ?? 0;
      const cost = finance?.costs.find(item => item.currencyCode === currencyCode)?.amount ?? 0;
      return { currencyCode, revenue, cost, profit: revenue - cost };
    });
  }, [finance]);
  const primaryRevenue = financialRows[0];

  return <div className="stack manager-dashboard">
    <section className="dashboard-hero">
      <div><p>MANAGEMENT OVERVIEW</p><h2>Welcome back, {userName}</h2><span>Live operational and financial signals from the last 30 days.</span></div>
      <button className="ghost" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh dashboard'}</button>
    </section>
    {warning && <div className="dashboard-warning">{warning}</div>}
    <section className="dashboard-metrics" aria-label="Management metrics">
      <article className="metric-card accent"><span className="metric-icon">$</span><small>Recognized revenue{primaryRevenue ? ' · ' + primaryRevenue.currencyCode : ''}</small><strong>{primaryRevenue ? money.format(primaryRevenue.revenue) : '0'}</strong><p>Confirmed in the current reporting period</p></article>
      <article className="metric-card"><span className="metric-icon">♞</span><small>Total horses</small><strong>{integer.format(booking?.totalHorses ?? 0)}</strong><p>{integer.format(booking?.activeHorses ?? 0)} currently active</p></article>
      <article className="metric-card"><span className="metric-icon">↗</span><small>Access sessions · 30 days</small><strong>{integer.format(identity?.sessionsLast30Days ?? 0)}</strong><p>{integer.format(identity?.activeUsersLast30Days ?? 0)} unique active users</p></article>
      <article className="metric-card"><span className="metric-icon">⌛</span><small>Awaiting review</small><strong>{integer.format(booking?.pendingReviewRequests ?? 0)}</strong><p>{integer.format(booking?.totalRequests ?? 0)} requests overall</p></article>
      <article className="metric-card"><span className="metric-icon">✓</span><small>Completed handovers</small><strong>{integer.format(finance?.completedHandovers ?? 0)}</strong><p>{integer.format(booking?.totalOrders ?? 0)} transport orders</p></article>
      <article className="metric-card warning"><span className="metric-icon">!</span><small>Open incidents</small><strong>{integer.format(openIncidents)}</strong><p>{integer.format(incidents.length)} incidents loaded</p></article>
    </section>
    <div className="dashboard-columns">
      <section className="panel finance-overview">
        <div className="panel-title"><div><h2>Financial performance</h2><p>Recognized revenue against confirmed operating costs.</p></div><span className="period-label">Last 30 days</span></div>
        {financialRows.length ? financialRows.map(row => {
          const scale = Math.max(row.revenue, row.cost, 1);
          return <article className="finance-row" key={row.currencyCode}><div className="finance-row-title"><b>{row.currencyCode}</b><strong className={row.profit < 0 ? 'negative' : ''}>{money.format(row.profit)} net</strong></div><div className="finance-values"><span>Revenue {money.format(row.revenue)}</span><span>Cost {money.format(row.cost)}</span></div><div className="finance-bars"><i style={{ width: (row.revenue / scale * 100) + '%' }} /><i className="cost" style={{ width: (row.cost / scale * 100) + '%' }} /></div></article>;
        }) : <div className="empty-state">No recognized revenue or confirmed cost in this period.</div>}
      </section>
      <section className="panel business-overview">
        <div className="panel-title"><div><h2>Business snapshot</h2><p>Current booking and account footprint.</p></div></div>
        <div className="snapshot-list"><div><span>Customers</span><b>{integer.format(booking?.totalCustomers ?? 0)}</b></div><div><span>Active user accounts</span><b>{integer.format(identity?.activeUsers ?? 0)}</b></div><div><span>Approved requests</span><b>{integer.format(booking?.approvedRequests ?? 0)}</b></div><div><span>Customer accounts</span><b>{integer.format(identity?.customerAccounts ?? 0)}</b></div></div>
      </section>
    </div>
    <section className="panel">
      <div className="panel-title"><div><h2>Requests requiring attention</h2><p>The newest submitted and under-review transport requests.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Request</th><th>Status</th><th>Departure</th><th>Horses</th></tr></thead><tbody>{queue.map(item => <tr key={item.id}><td>{item.requestNo}</td><td><em>{item.status}</em></td><td>{new Date(item.requestedDepartureAt).toLocaleString()}</td><td>{item.horseCount}</td></tr>)}{!queue.length && <tr><td colSpan={4}>No requests currently require attention.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
