import { useEffect, useState } from 'react';
import { 
  LayoutDashboard, FolderOpen, Users, FilePlus2, Settings, ShieldCheck, 
  LogOut, Menu, X, ArrowRight, ClipboardList, Clock3, UserRound, Plus, 
  LockKeyhole, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { AuthGate, Brand, MfaForm } from './Auth';
import { displayDate, errorMessage, rpc, supabase } from './lib';
import { canAdmin, canRecord, ROLE_NAMES, type Bootstrap, type CaseDetail, type CaseSummary, type Member } from './types';
import { Alert, Empty, Loading, Modal, PageHeading, useLoad } from './ui';
import { CaseRecord, CaseTable, CasesList } from './Cases';
import CaseForm from './CaseForm';
import { StudentRecord, StudentSearch } from './Students';
import Admin from './Admin';

type View = { page: 'overview' | 'cases' | 'students' | 'new' | 'admin' | 'security' | 'case' | 'student' | 'edit'; id?: string; record?: CaseDetail };

export default function App() {
  return <AuthGate>{member => <Portal member={member} />}</AuthGate>;
}

function Portal({ member }: { member: Member }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>({ page: 'overview' });
  const [mobile, setMobile] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  // Retractable / Expandable Navbar with localStorage memory
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cstr_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cstr_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  async function refresh() {
    try {
      setBoot(await rpc<Bootstrap>('portal_bootstrap'));
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let lastActivity = Date.now();
    const activity = () => { lastActivity = Date.now(); };
    const online = () => setOffline(!navigator.onLine);
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    window.addEventListener('beforeunload', unload);

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity > 15 * 60 * 1000) {
        void supabase!.auth.signOut({ scope: 'local' });
      }
    }, 15000);

    const accessCheck = window.setInterval(() => {
      rpc<{ state: string }>('my_access').then(r => {
        if (r.state !== 'member') void supabase!.auth.signOut({ scope: 'local' });
      }).catch(() => {});
    }, 60000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(accessCheck);
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      window.removeEventListener('beforeunload', unload);
    };
  }, [dirty]);

  function navigate(next: View, force = false) {
    if (dirty && !force && !confirm('Leave this form? Unsaved changes will be lost.')) return;
    setDirty(false);
    setMobile(false);
    setView(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function logout() {
    if (dirty && !confirm('Sign out and discard unsaved changes?')) return;
    await supabase!.auth.signOut({ scope: 'local' });
  }

  const items = [
    { key: 'overview', label: 'Office overview', icon: LayoutDashboard },
    { key: 'cases', label: 'Case records', icon: FolderOpen },
    { key: 'students', label: 'Student search', icon: Users },
    ...(canRecord(member.role) ? [{ key: 'new', label: 'Record incident', icon: FilePlus2 }] : []),
    ...(canAdmin(member.role) ? [{ key: 'admin', label: 'Administration', icon: Settings }] : []),
    { key: 'security', label: 'Account security', icon: ShieldCheck }
  ];

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {mobile && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobile(false)} />}
      
      <aside className={'sidebar ' + (mobile ? 'visible ' : '') + (collapsed ? 'collapsed ' : '')}>
        <div className="sidebar-brand">
          <Brand compact collapsed={collapsed} />
          <button 
            type="button" 
            className="icon-button sidebar-collapse-btn desktop-only" 
            title={collapsed ? "Expand navigation bar" : "Retract navigation bar"} 
            aria-label={collapsed ? "Expand navigation bar" : "Retract navigation bar"} 
            onClick={toggleCollapse}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button 
            type="button" 
            className="icon-button mobile-close" 
            aria-label="Close navigation" 
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>

        <p className="sidebar-school">Colegio de Sto. Tomas –<br />Recoletos, Inc.</p>
        <span className="nav-label">OFFICE WORKSPACE</span>

        <nav>
          {items.map(({ key, label, icon: Icon }) => {
            const isActive = (view.page === key || (key === 'cases' && ['case', 'edit'].includes(view.page)) || (key === 'students' && view.page === 'student'));
            return (
              <button
                key={key}
                type="button"
                className={isActive ? 'active' : ''}
                title={collapsed ? label : undefined}
                onClick={() => navigate({ page: key as View['page'] })}
              >
                <Icon size={19} />
                <span className="nav-text">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <LockKeyhole size={16} />
          <p>Confidential student records<br /><span>Authorized school use only</span></p>
        </div>

        <div className="staff-card" title={collapsed ? `${member.full_name} (${ROLE_NAMES[member.role]})` : undefined}>
          <div className="avatar">{member.full_name.charAt(0)}</div>
          <div>
            <strong>{member.full_name}</strong>
            <span>{ROLE_NAMES[member.role]}</span>
          </div>
        </div>

        <button 
          type="button" 
          className="sidebar-signout" 
          title={collapsed ? "Sign out" : undefined} 
          onClick={logout}
        >
          <LogOut size={17} />
          <span>Sign out</span>
        </button>
      </aside>

      <div className={'workspace ' + (collapsed ? 'sidebar-collapsed' : '')}>
        <header className="topbar">
          <div className="topbar-left">
            <button 
              type="button" 
              className="icon-button mobile-toggle" 
              aria-label="Open navigation" 
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="topbar-title">Prefect of Discipline</span>
          </div>

          <div className="topbar-right">
            <span className="division-label">JHS + SHS</span>
            <span className="top-date">{displayDate(new Date().toISOString())}</span>
          </div>
        </header>

        <main id="main-content" className="main-content">
          {offline && <Alert>You are offline. Changes cannot be saved until your connection returns.</Alert>}
          {error && <Alert>{error}<button className="text-button" onClick={refresh}>Retry connection</button></Alert>}

          {!boot ? <Loading /> : (
            <div key={view.page + (view.id || '')} className="page-transition">
              {view.page === 'overview' ? (
                <Overview 
                  boot={boot} 
                  onCase={id => navigate({ page: 'case', id })} 
                  onCreate={() => navigate({ page: 'new' })} 
                  onCases={() => navigate({ page: 'cases' })} 
                  onAdmin={() => navigate({ page: 'admin' })} 
                />
              ) : view.page === 'cases' ? (
                <CasesList 
                  boot={boot} 
                  onOpen={id => navigate({ page: 'case', id })} 
                  onCreate={() => navigate({ page: 'new' })} 
                />
              ) : view.page === 'students' ? (
                <StudentSearch onOpen={id => navigate({ page: 'student', id })} />
              ) : view.page === 'student' ? (
                <StudentRecord 
                  key={view.id} 
                  id={view.id!} 
                  boot={boot} 
                  onBack={() => navigate({ page: 'students' })} 
                  onCase={id => navigate({ page: 'case', id })} 
                />
              ) : view.page === 'case' ? (
                <CaseRecord 
                  key={view.id} 
                  id={view.id!} 
                  boot={boot} 
                  onBack={() => navigate({ page: 'cases' })} 
                  onEdit={record => navigate({ page: 'edit', record })} 
                  onStudent={id => navigate({ page: 'student', id })} 
                  onChanged={refresh} 
                />
              ) : ['new', 'edit'].includes(view.page) ? (
                <CaseForm 
                  key={view.page + (view.record?.id || '')} 
                  boot={boot} 
                  existing={view.page === 'edit' ? view.record : undefined} 
                  onSaved={id => { void refresh(); navigate({ page: 'case', id }, true); }} 
                  onCancel={() => navigate(view.record ? { page: 'case', id: view.record.id } : { page: 'cases' })} 
                  onDirty={setDirty} 
                />
              ) : view.page === 'admin' && canAdmin(member.role) ? (
                <Admin boot={boot} onChanged={refresh} />
              ) : (
                <Security member={member} />
              )}
            </div>
          )}
        </main>

        <footer className="workspace-footer">
          <span>Colegio de Sto. Tomas – Recoletos · Prefect of Discipline</span>
          <span>Philippine Standard Time · Asia/Manila</span>
        </footer>
      </div>
    </div>
  );
}

function Overview({ boot, onCase, onCreate, onCases, onAdmin }: {
  boot: Bootstrap;
  onCase: (id:string) => void;
  onCreate: () => void;
  onCases: () => void;
  onAdmin: () => void;
}) {
  const recent = useLoad(() => rpc<{ items: CaseSummary[]; total: number }>('list_cases'), [boot.counts.total]);
  const stats = [
    { label: 'Recorded cases', value: boot.counts.total, icon: FolderOpen, note: 'Across all school years' },
    { label: 'Open cases', value: boot.counts.open, icon: ClipboardList, note: 'Awaiting review or completion' },
    { label: 'Approved active actions', value: boot.counts.active_actions, icon: Clock3, note: 'Includes scheduled actions' },
    { label: 'Students on record', value: boot.counts.students, icon: UserRound, note: 'All participant roles' }
  ];

  return (
    <>
      <PageHeading 
        eyebrow="OFFICE OF THE PREFECT OF DISCIPLINE" 
        title="Office overview" 
        description="Official incident records, pending reviews, student follow-ups, and authorized disciplinary actions." 
        actions={canRecord(boot.member.role) && (
          <button type="button" className="button" onClick={onCreate}>
            <Plus size={18} />Record incident
          </button>
        )}
      />

      {(!boot.years.length || !boot.behaviors.length) && (
        <div className="setup-banner">
          <div>
            <strong>Complete the school’s initial setup</strong>
            <p>Add the actual school year dates and handbook categories before recording the first incident.</p>
          </div>
          {canAdmin(boot.member.role) && (
            <button type="button" className="button secondary" onClick={onAdmin}>
              Open administration<ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, note }) => (
          <section className="stat" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value.toLocaleString()}</strong>
            <p>{note}</p>
          </section>
        ))}
      </div>

      <div className="overview-grid">
        <section className="panel no-pad">
          <div className="panel-header">
            <h2>Recent case records</h2>
            <button type="button" className="text-button" onClick={onCases}>
              View all<ArrowRight size={16} />
            </button>
          </div>
          {recent.loading ? <Loading /> : recent.error ? (
            <div className="panel-body"><Alert>{recent.error}</Alert></div>
          ) : recent.data?.items.length ? (
            <CaseTable items={recent.data.items.slice(0, 6)} onOpen={onCase} />
          ) : (
            <Empty 
              title="The records start here" 
              action={canRecord(boot.member.role) && (
                <button type="button" className="button secondary" onClick={onCreate}>
                  <Plus size={16} />Record first incident
                </button>
              )}
            >
              No student or incident data has been preloaded.
            </Empty>
          )}
        </section>

        <section className="panel followups">
          <div className="section-header">
            <h2>Follow-ups</h2>
            <Clock3 size={19} className="subtle" />
          </div>
          {boot.followups.length ? boot.followups.map((f, i) => (
            <button type="button" className="followup-item" key={f.case_id + i} onClick={() => onCase(f.case_id)}>
              <time>{displayDate(f.follow_up_on)}</time>
              <strong>{f.title}</strong>
              <span>{f.case_no}<ArrowRight size={15} /></span>
            </button>
          )) : (
            <Empty title="No scheduled follow-ups">Add a follow-up date when recording an office meeting or note.</Empty>
          )}
        </section>
      </div>

      <div className="office-principle">
        <ShieldCheck size={22} />
        <p><strong>Every decision has a record.</strong> Statements, findings, actions, and changes stay connected to the incident that they concern.</p>
      </div>
    </>
  );
}

function Security({ member }: { member: Member }) {
  const [backup, setBackup] = useState(false);
  const [success, setSuccess] = useState(false);

  return (
    <>
      <PageHeading 
        eyebrow="ACCOUNT SECURITY" 
        title="Your school access" 
        description="Protect the Google account and authenticator used to access student records." 
      />
      <section className="panel security-panel">
        <ShieldCheck size={36} className="burgundy" />
        <h2>{member.full_name}</h2>
        <p>{member.email}</p>
        <p className="subtle">{ROLE_NAMES[member.role]}</p>

        <div className="security-facts">
          <p>
            <strong>Google account + authenticator</strong>
            <span>Both factors are verified before the database returns student records.</span>
          </p>
          <p>
            <strong>Automatic sign-out</strong>
            <span>This tab signs out after 15 minutes of inactivity. Closing the tab clears its saved session.</span>
          </p>
          <p>
            <strong>School access control</strong>
            <span>Revoking or disabling a staff account blocks its next database operation immediately.</span>
          </p>
        </div>

        {success && <Alert success>Your backup authenticator has been verified.</Alert>}
        
        <button type="button" className="button secondary" onClick={() => setBackup(true)}>
          Add a backup authenticator
        </button>
        <p className="small subtle" style={{ marginTop: '14px' }}>
          Keep the backup on a secondary device or in an approved school password manager.
        </p>
      </section>

      {backup && (
        <Modal title="Backup authenticator" onClose={() => setBackup(false)}>
          <MfaForm backup onSuccess={() => { setBackup(false); setSuccess(true); }} />
        </Modal>
      )}
    </>
  );
}
