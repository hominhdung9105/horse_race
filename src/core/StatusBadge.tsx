import './status.css';

type Props = { value?: string | null; label?: string };

const tone = (value?: string | null) => {
  const status = (value ?? '').trim().toUpperCase();
  if (['APPROVED', 'ACTIVE', 'COMPLETED', 'CONFIRMED', 'RESOLVED', 'ARRIVED', 'HEALTHY', 'READY', 'ACCEPTED', 'READ'].includes(status)) return 'success';
  if (['REJECTED', 'CANCELLED', 'CRITICAL', 'FAILED', 'DISPUTED', 'INACTIVE', 'RETIRED', 'EXPIRED'].includes(status)) return 'danger';
  if (['HIGH', 'WARNING', 'NEED_INFORMATION', 'NEED_ADDITIONAL_INFO', 'PENDING_ACCEPTANCE'].includes(status)) return 'warning';
  if (['SUBMITTED', 'PENDING', 'DRAFT'].includes(status)) return 'pending';
  if (['UNDER_REVIEW', 'INVESTIGATING', 'IN_PROGRESS', 'DEPARTED', 'OPEN'].includes(status)) return 'info';
  return 'neutral';
};

export default function StatusBadge({ value, label }: Props) {
  return <span className={`status-badge status-${tone(value)}`}>{label ?? value?.replaceAll('_', ' ') ?? '—'}</span>;
}
