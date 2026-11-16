import { useEffect, useState, type FormEvent } from 'react';
import { createPricingRule, disablePricingRule, getPricingRules, type PricingRule } from './api';
import { getAdminOrderPayment, recordManualOrderSettlement, type PaymentInvoice } from '../booking/api';

type Props = { report: (message: string) => void; notify: (message: string) => void };

export default function PricingRulesView({ report, notify }: Props) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [settlement, setSettlement] = useState({ paymentMethod: 'BANK_TRANSFER' as 'BANK_TRANSFER' | 'CASH' | 'OTHER', referenceNumber: '', evidenceReference: '', notes: '' });
  const [form, setForm] = useState({ name: '', transportMode: '', deliveryPriority: '', baseAmount: '', perHorseAmount: '', perKmAmount: '', currencyCode: 'VND' });

  const load = () => {
    setLoading(true);
    getPricingRules().then(setRules).catch(error => report(error instanceof Error ? error.message : 'Could not load pricing rules.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await createPricingRule({
        name: form.name,
        transportMode: form.transportMode || undefined,
        deliveryPriority: form.deliveryPriority || undefined,
        baseAmount: Number(form.baseAmount),
        perHorseAmount: Number(form.perHorseAmount || 0),
        perKmAmount: Number(form.perKmAmount || 0),
        currencyCode: form.currencyCode.toUpperCase(),
        isActive: true,
      });
      setRules(current => [created, ...current]);
      setForm({ name: '', transportMode: '', deliveryPriority: '', baseAmount: '', perHorseAmount: '', perKmAmount: '', currencyCode: 'VND' });
      notify('Pricing rule created. New approved requests will receive a quote automatically.');
    } catch (error) { report(error instanceof Error ? error.message : 'Could not create pricing rule.'); }
    finally { setSaving(false); }
  };

  const findInvoice = async (event: FormEvent) => {
    event.preventDefault();
    setInvoiceLoading(true);
    setInvoice(null);
    try { setInvoice(await getAdminOrderPayment(orderId.trim())); }
    catch (error) { report(error instanceof Error ? error.message : 'Could not load this order invoice.'); }
    finally { setInvoiceLoading(false); }
  };

  const settleInvoice = async (event: FormEvent) => {
    event.preventDefault();
    if (!invoice || invoice.status !== 'PENDING_PAYMENT') return;
    setSettlementSaving(true);
    try {
      const updated = await recordManualOrderSettlement(invoice.orderId, {
        paymentMethod: settlement.paymentMethod,
        referenceNumber: settlement.referenceNumber.trim(),
        evidenceReference: settlement.evidenceReference.trim() || undefined,
        notes: settlement.notes.trim() || undefined,
      });
      setInvoice(updated);
      notify(`Invoice ${updated.invoiceNo} recorded as paid.`);
    } catch (error) { report(error instanceof Error ? error.message : 'Could not record manual settlement.'); }
    finally { setSettlementSaving(false); }
  };

  return <section className="panel">
    <div className="panel-title"><div><h2>Pricing & billing</h2><p>Configure the quote used when a manager approves a transport request. Leave mode or priority blank to create a fallback rule.</p></div><button className="ghost" onClick={load} disabled={loading}>Refresh</button></div>
    <form className="form-grid" onSubmit={submit}>
      <label>Rule name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Standard domestic transport" required /></label>
      <label>Transport mode<select value={form.transportMode} onChange={e => setForm({ ...form, transportMode: e.target.value })}><option value="">All modes</option><option value="ROAD">Road</option><option value="AIR">Air</option><option value="MIXED">Mixed</option></select></label>
      <label>Delivery priority<select value={form.deliveryPriority} onChange={e => setForm({ ...form, deliveryPriority: e.target.value })}><option value="">All priorities</option><option value="STANDARD">Standard</option><option value="EXPRESS">Express</option></select></label>
      <label>Base amount<input type="number" min="0" step="1" value={form.baseAmount} onChange={e => setForm({ ...form, baseAmount: e.target.value })} required /></label>
      <label>Per horse<input type="number" min="0" step="1" value={form.perHorseAmount} onChange={e => setForm({ ...form, perHorseAmount: e.target.value })} /></label>
      <label>Per kilometre<input type="number" min="0" step="1" value={form.perKmAmount} onChange={e => setForm({ ...form, perKmAmount: e.target.value })} placeholder="Price per km" /><small>Calculated from the origin and destination coordinates.</small></label>
      <label>Currency<input value={form.currencyCode} maxLength={10} onChange={e => setForm({ ...form, currencyCode: e.target.value })} required /></label>
      <div className="modal-actions span-2"><button disabled={saving}>{saving ? 'Saving…' : 'Add pricing rule'}</button></div>
    </form>
    <div className="table-wrap"><table><thead><tr><th>Rule</th><th>Applies to</th><th>Base</th><th>Per horse</th><th>Per km</th><th>Status</th><th /></tr></thead><tbody>{rules.map(rule => <tr key={rule.id}><td><b>{rule.name}</b><small className="mono">{rule.id}</small></td><td>{rule.transportMode || 'All modes'} · {rule.deliveryPriority || 'All priorities'}</td><td>{rule.baseAmount.toLocaleString()} {rule.currencyCode}</td><td>{rule.perHorseAmount.toLocaleString()} {rule.currencyCode}</td><td>{rule.perKmAmount.toLocaleString()} {rule.currencyCode}</td><td><em>{rule.isActive ? 'ACTIVE' : 'DISABLED'}</em></td><td>{rule.isActive && <button type="button" className="ghost small" onClick={async () => { try { await disablePricingRule(rule.id); setRules(items => items.map(item => item.id === rule.id ? { ...item, isActive: false } : item)); notify('Pricing rule disabled.'); } catch (error) { report(error instanceof Error ? error.message : 'Could not disable pricing rule.'); } }}>Disable</button>}</td></tr>)}{!rules.length && <tr><td colSpan={7}>{loading ? 'Loading pricing rules…' : 'No pricing rules configured yet.'}</td></tr>}</tbody></table></div>
    <div className="manual-settlement-panel">
      <div className="panel-title"><div><h3>Record offline payment</h3><p>Use after verifying the full invoice amount was received. This records an operational settlement with an audit trail.</p></div></div>
      <form className="form-grid" onSubmit={findInvoice}>
        <label className="span-2">Transport order ID<input value={orderId} onChange={event => setOrderId(event.target.value)} placeholder="Paste the order UUID" required /></label>
        <div className="modal-actions span-2"><button type="submit" className="ghost" disabled={invoiceLoading}>{invoiceLoading ? 'Loading invoice…' : 'Find invoice'}</button></div>
      </form>
      {invoice && <div className="payment-summary manual-invoice-summary"><div><small>{invoice.invoiceNo} · {invoice.orderNo}</small><strong>{invoice.amount.toLocaleString()} {invoice.currencyCode}</strong><span>{invoice.status.replaceAll('_', ' ')}{invoice.settlementMethod ? ` · ${invoice.settlementMethod}` : ''}{invoice.settlementReference ? ` · ${invoice.settlementReference}` : ''}</span></div></div>}
      {invoice?.status === 'PENDING_PAYMENT' && <form className="form-grid" onSubmit={settleInvoice}>
        <label>Method<select value={settlement.paymentMethod} onChange={event => setSettlement({ ...settlement, paymentMethod: event.target.value as typeof settlement.paymentMethod })}><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>
        <label>Reference number<input value={settlement.referenceNumber} onChange={event => setSettlement({ ...settlement, referenceNumber: event.target.value })} maxLength={150} required /></label>
        <label>Evidence reference<input value={settlement.evidenceReference} onChange={event => setSettlement({ ...settlement, evidenceReference: event.target.value })} maxLength={500} placeholder="Receipt or document reference" /></label>
        <label>Notes<input value={settlement.notes} onChange={event => setSettlement({ ...settlement, notes: event.target.value })} maxLength={1000} /></label>
        <div className="modal-actions span-2"><button disabled={settlementSaving}>{settlementSaving ? 'Recording…' : 'Record full payment'}</button></div>
      </form>}
      {invoice && invoice.status !== 'PENDING_PAYMENT' && <p className="field-help">This invoice is no longer awaiting payment. No further settlement can be recorded.</p>}
    </div>
  </section>;
}
