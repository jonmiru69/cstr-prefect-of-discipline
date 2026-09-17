import { useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle, X } from 'lucide-react';
import { errorMessage } from './lib';
import { STATUS_NAMES, FINDING_NAMES } from './types';

export function useLoad<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    setData(null);

    loader()
      .then(v => { if (live) setData(v); })
      .catch(e => { if (live) setError(errorMessage(e)); })
      .finally(() => { if (live) setLoading(false); });

    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);

  return { data, error, loading, reload: () => setRevision(v => v + 1) };
}

export function Alert({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return (
    <div role={success ? 'status' : 'alert'} className={'notice ' + (success ? 'success' : 'error')}>
      {success ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
      <div>{children}</div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>Loading…</span>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Inbox size={36} strokeWidth={1.4} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Badge({ value }: { value: string }) {
  const label = STATUS_NAMES[value] || 
    FINDING_NAMES[value] || 
    ({ respondent: 'Respondent', affected: 'Affected student', witness: 'Witness' } as Record<string, string>)[value] || 
    value.replaceAll('_', ' ');

  return (
    <span className={'badge badge-' + value}>
      {label}
    </span>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog 
      ref={ref} 
      className="modal" 
      aria-label={title} 
      onCancel={e => { e.preventDefault(); onClose(); }} 
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function PageHeading({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="subtle">{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

export function ReasonDialog({ title, description, onClose, onSubmit, children }: {
  title: string;
  description: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <Modal title={title} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await onSubmit(reason);
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}>
        <p>{description}</p>
        {children}
        <Field label="Reason / decision note">
          <textarea 
            required 
            minLength={10} 
            maxLength={10000} 
            rows={4} 
            value={reason} 
            onChange={e => setReason(e.target.value)} 
            placeholder="State the official basis or justification for this action."
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <div className="form-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Confirm and record'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
