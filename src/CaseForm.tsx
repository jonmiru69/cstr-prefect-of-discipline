import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Save, ArrowLeft } from 'lucide-react';
import { errorMessage, fromManilaInput, manilaInput, rpc } from './lib';
import { Alert, Field, PageHeading } from './ui';
import type { Bootstrap, CaseDetail, Participant, Student } from './types';

const blankParticipant = (): Participant => ({
  school_id: '',
  full_name: '',
  role: 'respondent',
  age: 13,
  grade: 7,
  section: '',
  strand: '',
  statement: '',
  statement_status: 'not_yet_taken',
  statement_at: null
});

export default function CaseForm({ boot, existing, onSaved, onCancel, onDirty }: {
  boot: Bootstrap;
  existing?: CaseDetail;
  onSaved: (id: string) => void;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [year, setYear] = useState(existing?.school_year_id || boot.years.find(y => y.active)?.id || '');
  const [behavior, setBehavior] = useState(existing?.behavior_id || '');
  const [when, setWhen] = useState(manilaInput(existing?.happened_at));
  const [location, setLocation] = useState(existing?.location || '');
  const [summary, setSummary] = useState(existing?.summary || '');
  const [students, setStudents] = useState<Participant[]>(existing?.participants || [blankParticipant()]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => onDirty(false), [onDirty]);

  function changeStudent(index: number, p: Participant) {
    setStudents(all => all.map((v, i) => i === index ? p : v));
    onDirty(true);
  }

  return (
    <div>
      <button type="button" className="back-button" onClick={onCancel}>
        <ArrowLeft size={16} />Back
      </button>

      <PageHeading 
        eyebrow={existing?.case_no || 'INCIDENT RECORDING'} 
        title={existing ? 'Update case record' : 'Record an incident'} 
        description="Record what happened, who was involved, and the initial student statements available to the office."
      />

      {!boot.years.some(y => y.active) || !boot.behaviors.some(b => b.active) ? (
        <Alert>A principal or system administrator must add an open school year and the school’s handbook behavior categories in Administration first.</Alert>
      ) : null}

      <form 
        className="case-form" 
        onChange={() => onDirty(true)} 
        onSubmit={async e => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const id = await rpc<string>('save_case', {
              p_id: existing?.id || null,
              p_version: existing?.version || null,
              p_reason: reason,
              p_payload: {
                school_year_id: year,
                behavior_id: behavior,
                happened_at: fromManilaInput(when),
                location,
                summary,
                participants: students.map(p => ({
                  ...p,
                  school_id: p.school_id.trim().toUpperCase(),
                  full_name: p.full_name.trim(),
                  statement_at: p.statement_status === 'recorded' ? (p.statement_at || new Date().toISOString()) : null
                }))
              }
            });
            onDirty(false);
            onSaved(id);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="panel">
          <div className="section-title">
            <span className="step-number">01</span>
            <div>
              <h2>Incident details</h2>
              <p>Dates and times are recorded in Philippine Standard Time.</p>
            </div>
          </div>

          <div className="form-grid">
            <Field label="School year">
              <select required value={year} onChange={e => setYear(e.target.value)}>
                <option value="">Select school year</option>
                {boot.years.filter(y => y.active || y.id === existing?.school_year_id).map(y => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Incident date and time">
              <input type="datetime-local" required value={when} max={manilaInput()} onChange={e => setWhen(e.target.value)} />
            </Field>

            <Field label="Behavior / handbook category">
              <select required value={behavior} onChange={e => setBehavior(e.target.value)}>
                <option value="">Select a category</option>
                {boot.behaviors.filter(b => b.active || b.id === existing?.behavior_id).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Location">
              <input required minLength={2} maxLength={200} value={location} onChange={e => setLocation(e.target.value)} placeholder="Building, room number, campus area" />
            </Field>
          </div>

          {behavior && (
            <p className="policy-note">
              <strong>Handbook Policy Reference:</strong> {boot.behaviors.find(b => b.id === behavior)?.policy_reference}
            </p>
          )}

          <Field label="Factual account of the incident" hint="Describe the reported behavior and circumstances. Official findings are recorded separately after review.">
            <textarea required minLength={10} maxLength={12000} rows={5} value={summary} onChange={e => setSummary(e.target.value)} placeholder="Record the factual details available at the time of reporting." />
          </Field>
        </section>

        <section className="panel">
          <div className="section-title">
            <span className="step-number">02</span>
            <div>
              <h2>Students and statements</h2>
              <p>Add each student once. Include affected students and witnesses when applicable.</p>
            </div>
          </div>

          {students.map((p, index) => (
            <ParticipantFields 
              key={index} 
              participant={p} 
              index={index} 
              onChange={next => changeStudent(index, next)} 
              onRemove={() => {
                setStudents(s => s.filter((_, i) => i !== index));
                onDirty(true);
              }}
            />
          ))}

          <button 
            type="button" 
            className="button secondary" 
            disabled={students.length >= 20} 
            onClick={() => {
              setStudents(s => [...s, { ...blankParticipant(), role: 'affected' }]);
              onDirty(true);
            }}
          >
            <Plus size={16} />Add another student
          </button>
        </section>

        <section className="panel">
          <div className="section-title">
            <span className="step-number">03</span>
            <div>
              <h2>Review and save</h2>
              <p>The official logging timestamp and your credentials are saved automatically.</p>
            </div>
          </div>

          <p className="subtle" style={{ marginBottom: '18px' }}>
            Repeat counts are calculated from earlier substantiated incidents of the same behavior in the same school year. A new report does not create a finding or sanction.
          </p>

          {existing && (
            <Field label="Reason for this update" hint="The previous record is preserved in the case history log.">
              <textarea 
                required={existing.status !== 'draft'} 
                minLength={existing.status !== 'draft' ? 10 : 0} 
                maxLength={10000} 
                rows={3} 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                placeholder="State why this record was updated."
              />
            </Field>
          )}

          {error && <Alert>{error}</Alert>}

          <div className="form-actions">
            <button type="button" className="button secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={busy || !year || !behavior}>
              <Save size={17} />{busy ? 'Saving…' : existing ? 'Save update' : 'Save incident draft'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

function ParticipantFields({ participant: p, index, onChange, onRemove }: {
  participant: Participant;
  index: number;
  onChange: (p: Participant) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key: keyof Participant, value: unknown) => onChange({ ...p, [key]: value });

  return (
    <fieldset className="participant-form">
      <legend>Student {index + 1}</legend>
      <div className="row between">
        <span className="subtle small">Age, grade, and section at the time of the incident</span>
        {index > 0 && (
          <button type="button" className="text-button danger" onClick={onRemove}>
            <Trash2 size={15} />Remove student
          </button>
        )}
      </div>

      <div className="student-lookup">
        <Field label="Find a previously recorded student">
          <input 
            value={query} 
            maxLength={160} 
            onChange={e => setQuery(e.target.value)} 
            placeholder="Search by student name or ID" 
          />
        </Field>
        <button 
          type="button" 
          className="button secondary" 
          disabled={busy || query.trim().length < 2} 
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const r = await rpc<Student[]>('search_students', { p_query: query });
              setResults(r);
              if (!r.length) setError('No matching student is stored. Enter student details manually below.');
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Search size={17} />{busy ? 'Searching…' : 'Find'}
        </button>
      </div>

      {error && <p className="subtle small" role="status" style={{ marginBottom: '16px' }}>{error}</p>}

      {results.length > 0 && (
        <div className="lookup-results">
          {results.map(s => (
            <button 
              type="button" 
              key={s.id} 
              onClick={() => {
                onChange({ ...p, student_id: s.id, school_id: s.school_id, full_name: s.full_name });
                setResults([]);
                setQuery('');
              }}
            >
              <strong>{s.full_name}</strong>
              <span>ID: {s.school_id}</span>
            </button>
          ))}
        </div>
      )}

      <div className="form-grid">
        <Field label="School student ID">
          <input 
            required 
            maxLength={80} 
            value={p.school_id} 
            readOnly={!!p.student_id} 
            onChange={e => update('school_id', e.target.value)} 
            placeholder="e.g. 2024-00123" 
          />
        </Field>

        <Field label="Full name">
          <input 
            required 
            minLength={2} 
            maxLength={160} 
            value={p.full_name} 
            readOnly={!!p.student_id} 
            onChange={e => update('full_name', e.target.value)} 
            placeholder="Last name, First name, Middle name" 
          />
        </Field>

        <Field label="Role in this incident">
          <select value={p.role} onChange={e => update('role', e.target.value)}>
            <option value="respondent">Respondent / reported student</option>
            <option value="affected">Affected student / victim</option>
            <option value="witness">Witness</option>
          </select>
        </Field>

        <Field label="Age at incident">
          <input type="number" required min={5} max={100} value={p.age} onChange={e => update('age', Number(e.target.value))} />
        </Field>

        <Field label="Grade level">
          <select value={p.grade} onChange={e => update('grade', Number(e.target.value))}>
            {[7, 8, 9, 10, 11, 12].map(g => (
              <option key={g} value={g}>Grade {g} · {g <= 10 ? 'Junior High School' : 'Senior High School'}</option>
            ))}
          </select>
        </Field>

        <Field label="Section">
          <input required maxLength={100} value={p.section} onChange={e => update('section', e.target.value)} placeholder="e.g., St. Augustine" />
        </Field>

        {p.grade >= 11 && (
          <Field label="SHS strand / track (if applicable)">
            <input maxLength={100} value={p.strand} onChange={e => update('strand', e.target.value)} placeholder="e.g., STEM, ABM, HUMSS" />
          </Field>
        )}

        <Field label="Statement availability">
          <select 
            value={p.statement_status} 
            onChange={e => onChange({
              ...p,
              statement_status: e.target.value as Participant['statement_status'],
              statement: e.target.value === 'recorded' ? p.statement : '',
              statement_at: e.target.value === 'recorded' ? (p.statement_at || new Date().toISOString()) : null
            })}
          >
            <option value="not_yet_taken">Not yet taken</option>
            <option value="recorded">Statement recorded</option>
            <option value="not_applicable">Not applicable</option>
            <option value="declined">Student declined to give a statement</option>
          </select>
        </Field>
      </div>

      {p.student_id && !p.id && (
        <button type="button" className="text-button" onClick={() => onChange({ ...p, student_id: undefined, school_id: '', full_name: '' })}>
          Choose a different student
        </button>
      )}

      {p.student_id && p.id && (
        <p className="subtle small">To correct this student’s name or school ID, open their student record.</p>
      )}

      {p.statement_status === 'recorded' && (
        <>
          <Field label="Date and time statement was taken">
            <input 
              type="datetime-local" 
              required 
              max={manilaInput()} 
              value={manilaInput(p.statement_at || undefined)} 
              onChange={e => update('statement_at', e.target.value ? fromManilaInput(e.target.value) : null)} 
            />
          </Field>

          <Field label={p.role === 'affected' ? 'Affected student’s statement' : p.role === 'witness' ? 'Witness statement' : 'Respondent student’s statement'}>
            <textarea 
              required 
              maxLength={20000} 
              rows={4} 
              value={p.statement} 
              onChange={e => update('statement', e.target.value)} 
              placeholder="Record the student’s own account accurately and completely." 
            />
          </Field>
        </>
      )}
    </fieldset>
  );
}
