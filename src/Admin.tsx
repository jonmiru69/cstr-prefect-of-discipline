import { useState } from 'react';
import { Copy, Plus, Download, Check } from 'lucide-react';
import { displayDate, downloadBlob, errorMessage, rpc } from './lib';
import { ROLE_NAMES, type AuditRow, type Behavior, type Bootstrap, type Member, type SchoolYear } from './types';
import { Alert, Badge, Empty, Field, Loading, Modal, PageHeading, useLoad } from './ui';

type Invitation = {
  id: string;
  email: string;
  full_name: string;
  role: keyof typeof ROLE_NAMES;
  expires_at: string;
  used_at: string | null;
  revoked: boolean;
};

export default function Admin({ boot, onChanged }: { boot: Bootstrap; onChanged: () => void }) {
  const [tab, setTab] = useState('staff');

  return (
    <>
      <PageHeading 
        eyebrow="SCHOOL ADMINISTRATION" 
        title="Access and configuration" 
        description="Manage approved school personnel, school year calendars, handbook offense categories, and the immutable audit trail." 
      />

      <div className="tabs" role="tablist">
        {[
          ['staff', 'People & invitations'],
          ['years', 'School years'],
          ['behaviors', 'Behavior categories'],
          ['audit', 'Audit & archive']
        ].map(([key, label]) => (
          <button 
            type="button"
            role="tab" 
            aria-selected={tab === key} 
            className={tab === key ? 'active' : ''} 
            key={key} 
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'staff' ? (
        <StaffManager me={boot.member} />
      ) : tab === 'years' ? (
        <YearManager years={boot.years} onChanged={onChanged} />
      ) : tab === 'behaviors' ? (
        <BehaviorManager behaviors={boot.behaviors} onChanged={onChanged} />
      ) : (
        <AuditManager principal={boot.member.role === 'principal'} />
      )}
    </>
  );
}

function StaffManager({ me }: { me: Member }) {
  const load = useLoad(() => rpc<{ members: Member[]; invitations: Invitation[] }>('admin_list_staff'), []);
  const [show, setShow] = useState(false);
  const [issued, setIssued] = useState<{ code: string; email: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  return (
    <>
      <section className="panel">
        <div className="section-header">
          <h2>Authorized staff members</h2>
          <button type="button" className="button" onClick={() => { setIssued(null); setError(''); setShow(true); }}>
            <Plus size={17} />Invite staff member
          </button>
        </div>
        <p className="subtle">All approved staff can view both JHS and SHS records. Their assigned role determines which actions they can perform.</p>

        {error && <Alert>{error}</Alert>}

        {load.loading ? <Loading /> : load.error ? (
          <Alert>{load.error}</Alert>
        ) : (
          <div className="table-scroll">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Name / Google Account</th>
                  <th>Assigned Role</th>
                  <th>Access Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {load.data?.members.map(m => (
                  <tr key={m.user_id}>
                    <td>
                      <strong>{m.full_name}</strong>
                      <span className="table-secondary">{m.email}</span>
                    </td>
                    <td>{ROLE_NAMES[m.role]}</td>
                    <td><Badge value={m.active ? 'active' : 'disabled'} /></td>
                    <td>
                      {m.user_id !== me.user_id && (
                        <button 
                          type="button"
                          disabled={busy} 
                          className="button secondary small" 
                          onClick={async () => {
                            if (!confirm((m.active ? 'Disable' : 'Enable') + ' access for ' + m.full_name + '?')) return;
                            setBusy(true);
                            setError('');
                            try {
                              await rpc('admin_set_member', { p_user_id: m.user_id, p_active: !m.active });
                              load.reload();
                            } catch (e) {
                              setError(errorMessage(e));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {m.active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Recent invitations</h2>
        {!load.data?.invitations.length ? (
          <p className="subtle" style={{ marginTop: '14px' }}>No invitations issued.</p>
        ) : (
          load.data.invitations.map(i => (
            <div className="invitation-row" key={i.id}>
              <div>
                <strong>{i.full_name}</strong>
                <p className="small subtle">{i.email} · {ROLE_NAMES[i.role]}</p>
                <p className="small">Expires {displayDate(i.expires_at, true)}</p>
              </div>
              <div>
                {i.used_at ? (
                  <Badge value="used" />
                ) : i.revoked ? (
                  <Badge value="revoked" />
                ) : new Date(i.expires_at) < new Date() ? (
                  <Badge value="expired" />
                ) : (
                  <button 
                    type="button"
                    className="button secondary small" 
                    disabled={busy} 
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await rpc('admin_revoke_invite', { p_id: i.id });
                        load.reload();
                      } catch (e) {
                        setError(errorMessage(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Revoke invitation
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {show && (
        <Modal title={issued ? 'Personal invitation created' : 'Invite an approved staff member'} onClose={() => { if (!busy) setShow(false); }}>
          {issued ? (
            <>
              <Alert success>This code works once, for {issued.email} only.</Alert>
              <p>Share it privately with that person. It expires {displayDate(issued.expires_at, true)}. This full code will not be shown again after you close this dialog.</p>
              <code className="invitation-code">{issued.code}</code>
              <button 
                type="button" 
                className="button secondary" 
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issued.code);
                    setCopied(true);
                  } catch {
                    setError('Please copy the displayed code manually.');
                  }
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied to clipboard' : 'Copy code'}
              </button>
              <div className="form-actions">
                <button type="button" className="button" onClick={() => setShow(false)}>Done</button>
              </div>
            </>
          ) : (
            <form onSubmit={async e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError('');
              try {
                const r = await rpc<{ code: string; email: string; expires_at: string }>('admin_invite', {
                  p_email: f.get('email'),
                  p_name: f.get('name'),
                  p_role: f.get('role'),
                  p_days: 7
                });
                setIssued(r);
                setCopied(false);
                load.reload();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}>
              <Field label="Full name">
                <input name="name" required minLength={2} maxLength={160} placeholder="e.g. Maria Santos" />
              </Field>
              <Field label="Approved Google account email">
                <input name="email" type="email" required maxLength={254} autoComplete="off" placeholder="user@cstr.edu.ph" />
              </Field>
              <Field label="School role">
                <select name="role">
                  {Object.entries(ROLE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <p className="small subtle">Use a school-controlled Google account where available. Each staff member requires their own access invitation.</p>
              {error && <Alert>{error}</Alert>}
              <div className="form-actions">
                <button type="button" className="button secondary" onClick={() => setShow(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="button" disabled={busy}>{busy ? 'Creating…' : 'Create 7-day invitation'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

function YearManager({ years, onChanged }: { years: SchoolYear[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<SchoolYear | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const y = editing && editing !== 'new' ? editing : null;

  return (
    <section className="panel">
      <div className="section-header">
        <h2>School years</h2>
        <button type="button" className="button" onClick={() => { setError(''); setEditing('new'); }}>
          <Plus size={17} />Add school year
        </button>
      </div>
      <p className="subtle">Use the official academic year dates approved by CSTR administration. Closing a year prevents new incident reports; existing cases can still be resolved and monitored.</p>

      {!years.length ? (
        <Empty title="Add the first school year">The incident form requires an open school year before it can save records.</Empty>
      ) : (
        years.map(item => (
          <div key={item.id} className="config-row">
            <div>
              <strong>{item.label}</strong>
              <p className="small subtle">{displayDate(item.starts_on)} – {displayDate(item.ends_on)}</p>
            </div>
            <Badge value={item.active ? 'open' : 'closed'} />
            <button type="button" className="button secondary small" onClick={() => { setError(''); setEditing(item); }}>
              Edit
            </button>
          </div>
        ))
      )}

      {editing && (
        <Modal title={y ? 'Update school year' : 'Add school year'} onClose={() => { if (!busy) setEditing(null); }}>
          <form onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            try {
              await rpc('admin_save_year', {
                p_id: y?.id || null,
                p_label: f.get('label'),
                p_start: f.get('start'),
                p_end: f.get('end'),
                p_active: f.get('active') === 'on'
              });
              onChanged();
              setEditing(null);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}>
            <Field label="School year label">
              <input name="label" required minLength={4} maxLength={30} defaultValue={y?.label} placeholder="e.g. 2026–2027" />
            </Field>
            <div className="form-grid">
              <Field label="Start date">
                <input name="start" type="date" required defaultValue={y?.starts_on} />
              </Field>
              <Field label="End date">
                <input name="end" type="date" required defaultValue={y?.ends_on} />
              </Field>
            </div>
            <label className="checkbox">
              <input type="checkbox" name="active" defaultChecked={y?.active ?? true} />
              Open for new incident records
            </label>
            {error && <Alert>{error}</Alert>}
            <div className="form-actions">
              <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Save school year'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function BehaviorManager({ behaviors, onChanged }: { behaviors: Behavior[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Behavior | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const b = editing && editing !== 'new' ? editing : null;

  return (
    <section className="panel">
      <div className="section-header">
        <h2>Handbook behavior categories</h2>
        <button type="button" className="button" onClick={() => { setError(''); setEditing('new'); }}>
          <Plus size={17} />Add category
        </button>
      </div>
      <p className="subtle">Enter CSTR’s official student handbook offense categories. When policy updates, deactivate outdated categories and add new ones to preserve historical integrity.</p>

      {!behaviors.length ? (
        <Empty title="Add the school’s categories">No offense categories have been configured yet.</Empty>
      ) : (
        behaviors.map(item => (
          <div key={item.id} className="config-row">
            <div>
              <strong>{item.name}</strong>
              <p className="small subtle">{item.policy_reference || 'No policy reference entered'}</p>
            </div>
            <Badge value={item.active ? 'active' : 'inactive'} />
            <button type="button" className="button secondary small" onClick={() => { setError(''); setEditing(item); }}>
              Edit
            </button>
          </div>
        ))
      )}

      {editing && (
        <Modal title={b ? 'Update behavior category' : 'Add behavior category'} onClose={() => { if (!busy) setEditing(null); }}>
          <form onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            try {
              await rpc('admin_save_behavior', {
                p_id: b?.id || null,
                p_name: f.get('name'),
                p_reference: f.get('reference'),
                p_active: f.get('active') === 'on'
              });
              onChanged();
              setEditing(null);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}>
            <Field label="Behavior category name">
              <input name="name" required minLength={2} maxLength={160} defaultValue={b?.name} placeholder="e.g. Bullying or Harassment" />
            </Field>
            <Field label="Handbook section / policy reference">
              <textarea name="reference" maxLength={500} rows={3} defaultValue={b?.policy_reference} placeholder="e.g., CSTR Student Handbook 2024 Rev., Section 4.2" />
            </Field>
            <label className="checkbox">
              <input name="active" type="checkbox" defaultChecked={b?.active ?? true} />
              Available for new incident records
            </label>
            {error && <Alert>{error}</Alert>}
            <div className="form-actions">
              <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Save category'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function AuditManager({ principal }: { principal: boolean }) {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useLoad(() => rpc<{ items: AuditRow[]; total: number }>('list_audit', { p_page: page }), [page]);

  return (
    <>
      <section className="panel">
        <div className="section-header">
          <h2>Audit trail & archives</h2>
          {principal && (
            <button 
              type="button"
              className="button secondary" 
              disabled={busy} 
              onClick={async () => {
                if (!confirm('Download a confidential archive of all school records? Save it only in encrypted, school-controlled storage.')) return;
                setBusy(true);
                setError('');
                try {
                  const data = await rpc('export_school_archive');
                  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'CSTR-CONFIDENTIAL-records-archive-' + new Date().toISOString().slice(0, 10) + '.json');
                  load.reload();
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download size={17} />{busy ? 'Preparing…' : 'Download records archive'}
            </button>
          )}
        </div>
        <p className="small subtle">The immutable audit log records all database events, modifications, author identities, and previous values.</p>

        {error && <Alert>{error}</Alert>}

        {load.loading ? <Loading /> : load.error ? (
          <Alert>{load.error}</Alert>
        ) : (
          <>
            <div className="audit-list">
              {load.data?.items.map(a => (
                <details key={a.id}>
                  <summary>
                    <span>{a.action.replaceAll('.', ' · ').replaceAll('_', ' ')}</span>
                    <span>{a.actor_name}</span>
                    <time>{displayDate(a.occurred_at, true)}</time>
                  </summary>
                  <dl>
                    {Object.entries(a.details).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replaceAll('_', ' ')}</dt>
                        <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                      </div>
                    ))}
                    {a.entity_id && (
                      <div>
                        <dt>Record reference ID</dt>
                        <dd>{a.entity_id}</dd>
                      </div>
                    )}
                  </dl>
                </details>
              ))}
            </div>

            <div className="pagination">
              <span>{load.data?.total} audit entries recorded</span>
              <div>
                <button 
                  type="button"
                  className="button secondary small" 
                  disabled={!page} 
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <button 
                  type="button"
                  className="button secondary small" 
                  disabled={(page + 1) * 50 >= (load.data?.total || 0)} 
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
