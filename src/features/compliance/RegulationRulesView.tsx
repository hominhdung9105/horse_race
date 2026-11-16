import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, api, json } from '../../core/api';
import ModalDialog from '../../core/ModalDialog';
import { getCustomerCountries, CountryReference } from '../planning/api';
import { DocumentType, getDocumentTypes } from '../booking/api';

type Requirement = {
  documentTypeId: string;
  required: boolean;
  minValidityDays: string;
  authorityName: string;
  notes: string;
};

type RegulationRequirement = {
  id: string;
  regulationRuleId: string;
  documentTypeId: string;
  documentTypeCode?: string;
  documentTypeName?: string;
  required: boolean;
  minValidityDays?: number;
  authorityName?: string;
  notes?: string;
};

type RegulationRule = {
  id: string;
  ruleCode: string;
  originCountryId: string;
  destinationCountryId: string;
  borderPointId?: string;
  title: string;
  description?: string;
  quarantineRequired: boolean;
  customsRequired: boolean;
  inspectionRequired: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
  requirements: RegulationRequirement[];
};

type RuleInput = {
  ruleCode: string;
  originCountryId: string;
  destinationCountryId: string;
  borderPointId: null;
  title: string;
  description: string | null;
  quarantineRequired: boolean;
  customsRequired: boolean;
  inspectionRequired: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  requirements: { documentTypeId: string; required: boolean; minValidityDays: number | null; authorityName: string | null; notes: string | null }[];
};

function asName(row: CountryReference) {
  return String(row.name ?? row.isoCode ?? row.id);
}

function errorFields(error: unknown): { message: string; fields: Record<string, string> } {
  if (!(error instanceof ApiError)) return { message: error instanceof Error ? error.message : 'Could not save this rule.', fields: {} };
  return {
    message: error.message,
    fields: Object.fromEntries(error.errors.filter(item => item.field).map(item => [item.field!.toLowerCase(), item.message])),
  };
}

function emptyRequirement(): Requirement {
  return { documentTypeId: '', required: true, minValidityDays: '', authorityName: '', notes: '' };
}

export default function RegulationRulesView() {
  const [countries, setCountries] = useState<CountryReference[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [rules, setRules] = useState<RegulationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [queryOrigin, setQueryOrigin] = useState('');
  const [queryDestination, setQueryDestination] = useState('');
  const [queryStatus, setQueryStatus] = useState('');
  const [queryText, setQueryText] = useState('');
  const [ruleSort, setRuleSort] = useState('title');
  const [ruleSortDirection, setRuleSortDirection] = useState<'asc' | 'desc'>('asc');

  const today = new Date().toISOString().slice(0, 10);
  const [ruleCode, setRuleCode] = useState('');
  const [originCountryId, setOriginCountryId] = useState('');
  const [destinationCountryId, setDestinationCountryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [active, setActive] = useState(true);
  const [quarantineRequired, setQuarantineRequired] = useState(false);
  const [customsRequired, setCustomsRequired] = useState(false);
  const [inspectionRequired, setInspectionRequired] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [countryRows, types, ruleRows] = await Promise.all([
        getCustomerCountries(),
        getDocumentTypes(),
        api<RegulationRule[]>('/api/v1/compliance/regulations'),
      ]);
      setCountries(countryRows.filter(row => row.active !== false));
      setDocumentTypes(types.filter(type => type.active));
      setRules(ruleRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load regulation rules.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const countryName = (id: string) => countries.find(country => country.id === id)?.name?.toString() ?? 'Unavailable country';
  const visibleRules = useMemo(() => {
    const query = queryText.trim().toLocaleLowerCase();
    const filtered = rules.filter(rule => {
      const text = [rule.ruleCode, rule.title, rule.description, countryName(rule.originCountryId), countryName(rule.destinationCountryId), ...rule.requirements.map(item => item.documentTypeName ?? item.documentTypeCode)].filter(Boolean).join(' ').toLocaleLowerCase();
      return (!query || text.includes(query)) && (!queryOrigin || rule.originCountryId === queryOrigin) &&
        (!queryDestination || rule.destinationCountryId === queryDestination) &&
        (!queryStatus || rule.active === (queryStatus === 'active'));
    });
    return filtered.sort((a, b) => {
      const left = ruleSort === 'route' ? `${countryName(a.originCountryId)} ${countryName(a.destinationCountryId)}` : ruleSort === 'effective' ? a.effectiveFrom : a.title;
      const right = ruleSort === 'route' ? `${countryName(b.originCountryId)} ${countryName(b.destinationCountryId)}` : ruleSort === 'effective' ? b.effectiveFrom : b.title;
      const comparison = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      return ruleSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rules, countries, queryText, queryOrigin, queryDestination, queryStatus, ruleSort, ruleSortDirection]);

  function resetForm() {
    setEditing(null); setFormOpen(false);
    setRuleCode(''); setOriginCountryId(''); setDestinationCountryId(''); setTitle(''); setDescription('');
    setEffectiveFrom(new Date().toISOString().slice(0, 10)); setEffectiveTo(''); setActive(true);
    setQuarantineRequired(false); setCustomsRequired(false); setInspectionRequired(false); setRequirements([]);
    setFieldErrors({}); setError('');
  }

  function editRule(rule: RegulationRule) {
    setEditing(rule.id); setFormOpen(true); setRuleCode(rule.ruleCode); setOriginCountryId(rule.originCountryId); setDestinationCountryId(rule.destinationCountryId);
    setTitle(rule.title); setDescription(rule.description ?? ''); setEffectiveFrom(rule.effectiveFrom); setEffectiveTo(rule.effectiveTo ?? '');
    setActive(rule.active); setQuarantineRequired(rule.quarantineRequired); setCustomsRequired(rule.customsRequired); setInspectionRequired(rule.inspectionRequired);
    setRequirements(rule.requirements.map(item => ({
      documentTypeId: item.documentTypeId, required: item.required,
      minValidityDays: item.minValidityDays == null ? '' : String(item.minValidityDays),
      authorityName: item.authorityName ?? '', notes: item.notes ?? '',
    })));
    setFieldErrors({}); setError(''); setNotice('');

  }

  function startNewRule() { resetForm(); setFormOpen(true); }

  function validate(): string {
    if (!editing && !ruleCode.trim()) return 'Enter a unique rule code.';
    if (!originCountryId || !destinationCountryId) return 'Choose both route countries.';
    if (originCountryId === destinationCountryId) return 'Origin and destination countries must differ.';
    if (!title.trim()) return 'Enter a rule title.';
    if (!effectiveFrom) return 'Choose the date this rule becomes effective.';
    if (effectiveTo && effectiveTo < effectiveFrom) return 'The end date must be on or after the start date.';
    if (requirements.some(item => !item.documentTypeId)) return 'Choose a document type for each requirement row.';
    if (new Set(requirements.map(item => item.documentTypeId)).size !== requirements.length) return 'Each document type can appear only once in a rule.';
    if (requirements.some(item => item.minValidityDays && (!Number.isInteger(Number(item.minValidityDays)) || Number(item.minValidityDays) < 0))) return 'Minimum validity must be a whole number of days at least zero.';
    return '';
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setFieldErrors({});
    const validation = validate();
    if (validation) { setError(validation); return; }
    const body: RuleInput = {
      ruleCode: ruleCode.trim(), originCountryId, destinationCountryId, borderPointId: null,
      title: title.trim(), description: description.trim() || null,
      quarantineRequired, customsRequired, inspectionRequired, effectiveFrom, effectiveTo: effectiveTo || null,
      requirements: requirements.map(item => ({
        documentTypeId: item.documentTypeId, required: item.required,
        minValidityDays: item.minValidityDays ? Number(item.minValidityDays) : null,
        authorityName: item.authorityName.trim() || null, notes: item.notes.trim() || null,
      })),
    };
    setSaving(true);
    try {
      if (editing) {
        await api<RegulationRule>(`/api/v1/compliance/regulations/${editing}`, json('PUT', {
          title: body.title, description: body.description, quarantineRequired, customsRequired, inspectionRequired,
          effectiveFrom, effectiveTo: body.effectiveTo, active, requirements: body.requirements,
        }));
        setNotice('Regulation rule updated.');
      } else {
        await api<RegulationRule>('/api/v1/compliance/regulations', json('POST', body));
        setNotice('Regulation rule created.');
      }
      resetForm();
      await load();
    } catch (cause) {
      const parsed = errorFields(cause); setError(parsed.message); setFieldErrors(parsed.fields);
    } finally { setSaving(false); }
  }

  async function toggleActive(rule: RegulationRule) {
    setError(''); setNotice('');
    try {
      await api<RegulationRule>(`/api/v1/compliance/regulations/${rule.id}`, json('PUT', {
        title: rule.title, description: rule.description ?? null, quarantineRequired: rule.quarantineRequired,
        customsRequired: rule.customsRequired, inspectionRequired: rule.inspectionRequired,
        effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo ?? null, active: !rule.active,
        requirements: rule.requirements.map(item => ({
          documentTypeId: item.documentTypeId, required: item.required, minValidityDays: item.minValidityDays ?? null,
          authorityName: item.authorityName ?? null, notes: item.notes ?? null,
        })),
      }));
      setNotice(`Rule ${rule.active ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update rule status.'); }
  }

  function updateRequirement(index: number, update: Partial<Requirement>) {
    setRequirements(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item));
  }

  return <div className="stack">
    {formOpen && <ModalDialog title={editing ? `Edit ${ruleCode}` : 'Create a country route rule'} description="Set required checks and horse documents before requests are reviewed. Rules apply to the selected direction and effective dates." onClose={resetForm}>
      <div className="header-actions">{editing && <button type="button" className="ghost" onClick={startNewRule}>New rule</button>}</div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="notice-card" role="status">{notice}</p>}
      {!countries.length && <p className="field-help">No supported countries are available. Configure countries before creating a route rule.</p>}
      <form className="form-grid" onSubmit={save} noValidate>
        {!editing && <label>Rule code<input value={ruleCode} onChange={event => setRuleCode(event.target.value)} maxLength={50} required aria-invalid={!!fieldErrors.rulecode} />{fieldErrors.rulecode && <small className="auth-error">{fieldErrors.rulecode}</small>}</label>}
        <label>Origin country<select value={originCountryId} onChange={event => setOriginCountryId(event.target.value)} required disabled={!!editing} aria-invalid={!!fieldErrors.origincountryid}><option value="">Choose origin country</option>{countries.map(country => <option key={country.id} value={country.id}>{asName(country)}{country.isoCode ? ` · ${country.isoCode}` : ''}</option>)}</select>{fieldErrors.origincountryid && <small className="auth-error">{fieldErrors.origincountryid}</small>}</label>
        <label>Destination country<select value={destinationCountryId} onChange={event => setDestinationCountryId(event.target.value)} required disabled={!!editing} aria-invalid={!!fieldErrors.destinationcountryid}><option value="">Choose destination country</option>{countries.filter(country => country.id !== originCountryId).map(country => <option key={country.id} value={country.id}>{asName(country)}{country.isoCode ? ` · ${country.isoCode}` : ''}</option>)}</select>{fieldErrors.destinationcountryid && <small className="auth-error">{fieldErrors.destinationcountryid}</small>}</label>
        {editing && <p className="field-help span-2">The route pair is fixed after creation. Create a separate rule to configure another country direction.</p>}
        <label className="span-2">Rule title<input value={title} onChange={event => setTitle(event.target.value)} maxLength={255} required aria-invalid={!!fieldErrors.title} />{fieldErrors.title && <small className="auth-error">{fieldErrors.title}</small>}</label>
        <label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} maxLength={2000} /></label>
        <label>Effective from<input type="date" value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} required /></label>
        <label>Effective to (optional)<input type="date" value={effectiveTo} min={effectiveFrom} onChange={event => setEffectiveTo(event.target.value)} /></label>
        <label className="checkbox-field"><input type="checkbox" checked={quarantineRequired} onChange={event => setQuarantineRequired(event.target.checked)} />Quarantine required</label>
        <label className="checkbox-field"><input type="checkbox" checked={customsRequired} onChange={event => setCustomsRequired(event.target.checked)} />Customs clearance required</label>
        <label className="checkbox-field"><input type="checkbox" checked={inspectionRequired} onChange={event => setInspectionRequired(event.target.checked)} />Inspection required</label>
        {editing && <label className="checkbox-field"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />Rule active</label>}
        <div className="span-2">
          <div className="panel-title"><div><h3>Required documents</h3><p>Choose horse document types and any minimum validity period.</p></div><button type="button" className="ghost small" onClick={() => setRequirements(current => [...current, emptyRequirement()])}>Add document</button></div>
          {requirements.length === 0 && <p className="field-help">No document requirements added. Add one when this route requires customer documents beyond the baseline.</p>}
          {requirements.map((requirement, index) => <div className="notice-card" key={`${index}:${requirement.documentTypeId}`} style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
            <div className="form-grid">
              <label>Document type<select value={requirement.documentTypeId} onChange={event => updateRequirement(index, { documentTypeId: event.target.value })}><option value="">Choose a document</option>{documentTypes.filter(type => type.scope.toUpperCase() === 'HORSE' && (!requirements.some((other, otherIndex) => otherIndex !== index && other.documentTypeId === type.id))).map(type => <option key={type.id} value={type.id}>{type.name} · {type.code}</option>)}</select></label>
              <label className="checkbox-field"><input type="checkbox" checked={requirement.required} onChange={event => updateRequirement(index, { required: event.target.checked })} />Required</label>
              <label>Minimum validity days<input type="number" min="0" step="1" inputMode="numeric" value={requirement.minValidityDays} onChange={event => updateRequirement(index, { minValidityDays: event.target.value })} placeholder="No extra validity" /></label>
              <label>Issuing authority<input value={requirement.authorityName} onChange={event => updateRequirement(index, { authorityName: event.target.value })} maxLength={255} /></label>
              <label className="span-2">Notes<input value={requirement.notes} onChange={event => updateRequirement(index, { notes: event.target.value })} maxLength={1000} /></label>
            </div>
            <button type="button" className="danger small" onClick={() => setRequirements(current => current.filter((_, itemIndex) => itemIndex !== index))}>Remove requirement</button>
          </div>)}
        </div>
        <div className="modal-actions span-2"><button type="submit" disabled={saving || !countries.length}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create rule'}</button></div>
      </form>
    </ModalDialog>}

    <section className="panel">
      <div className="panel-title"><div><h2>Country route rules</h2><p>Inactive rules remain available for audit but are not used to build an active document checklist.</p></div><div className="header-actions"><button className="ghost" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button><button type="button" onClick={startNewRule}>+ Add route rule</button></div></div>
      <div className="form-grid">
        <label>Search rules<input value={queryText} onChange={event => setQueryText(event.target.value)} placeholder="Code, title, country or document…" /></label>
        <label>Origin country<select value={queryOrigin} onChange={event => setQueryOrigin(event.target.value)}><option value="">All origins</option>{countries.map(country => <option key={country.id} value={country.id}>{asName(country)}</option>)}</select></label>
        <label>Destination country<select value={queryDestination} onChange={event => setQueryDestination(event.target.value)}><option value="">All destinations</option>{countries.map(country => <option key={country.id} value={country.id}>{asName(country)}</option>)}</select></label>
        <label>Status<select value={queryStatus} onChange={event => setQueryStatus(event.target.value)}><option value="">All rules</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label>Sort by<select value={ruleSort} onChange={event => setRuleSort(event.target.value)}><option value="title">Rule title</option><option value="route">Route</option><option value="effective">Effective date</option></select></label>
        <label>Direction<select value={ruleSortDirection} onChange={event => setRuleSortDirection(event.target.value as 'asc' | 'desc')}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      </div>
      <small className="field-help">Showing {visibleRules.length} of {rules.length} rules.</small>
      {loading ? <p className="field-help">Loading rules…</p> : <div className="table-wrap"><table><thead><tr><th>Rule</th><th>Route</th><th>Effective dates</th><th>Requirements</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visibleRules.map(rule => <tr key={rule.id}><td><b>{rule.title}</b><small className="field-help">{rule.ruleCode}</small></td><td>{countryName(rule.originCountryId)} → {countryName(rule.destinationCountryId)}</td><td>{rule.effectiveFrom}{rule.effectiveTo ? ` – ${rule.effectiveTo}` : ' onward'}</td><td>{rule.requirements.length ? rule.requirements.map(item => `${item.required ? '' : 'Optional: '}${item.documentTypeName ?? item.documentTypeCode ?? 'Document'}`).join(', ') : 'No route-specific documents'}<small className="field-help">{[rule.quarantineRequired && 'Quarantine', rule.customsRequired && 'Customs', rule.inspectionRequired && 'Inspection'].filter(Boolean).join(' · ') || 'No additional checks'}</small></td><td><em>{rule.active ? 'ACTIVE' : 'INACTIVE'}</em></td><td><div className="header-actions"><button type="button" className="ghost small" onClick={() => editRule(rule)}>Edit</button><button type="button" className="ghost small" onClick={() => void toggleActive(rule)}>{rule.active ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}
        {!visibleRules.length && <tr><td colSpan={6}>{rules.length ? 'No rules match these filters.' : 'No route rules configured yet.'}</td></tr>}
      </tbody></table></div>}
    </section>
  </div>;
}
