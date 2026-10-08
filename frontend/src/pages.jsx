import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { useUI, Field, PasswordInput, useAsync, PW, PWMSG } from './ui.jsx';
import { useAuth } from './auth.jsx';
import { pc, ratio, GH, gRow, analyticsSections, downloadPDF, downloadCSV } from './export.js';

const Card = ({ title, sub, children }) => (
  <main className="auth"><div className="card"><div className="logo">◈ Faculty Portal</div><h1>{title}</h1><p className="muted">{sub}</p>{children}</div></main>
);
const Alert = ({ msg }) => msg ? <p className="alert" role="alert">{msg}</p> : null;

export function AdminLogin() {
  const { setUser } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ username: '', password: '' });
  const { busy, err, run } = useAsync();
  const go = run(async () => { const r = await api('/admin/login', { method: 'POST', body: f }); setUser(r.data); nav('/admin/dashboard'); });
  return (
    <Card title="Admin sign in" sub="Administrators only.">
      <form onSubmit={go}>
        <Field label="Username"><input required autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Alert msg={err} />
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </Card>
  );
}

export function EmployeeLogin() {
  const { setUser } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ employee_id: '', password: '' });
  const { busy, err, run } = useAsync();
  const go = run(async () => { const r = await api('/employee/login', { method: 'POST', body: f }); setUser(r.data); nav('/employee/dashboard'); });
  return (
    <Card title="Employee login" sub="Sign in with your Employee ID.">
      <form onSubmit={go}>
        <Field label="Employee ID"><input required value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })} /></Field>
        <Field label="Password"><PasswordInput required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Alert msg={err} />
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
      </form>
      <p className="muted center-t">First time here? <Link to="/employee/register">Register your account</Link></p>
    </Card>
  );
}

export function EmployeeRegister() {
  const nav = useNavigate(); const { toast } = useUI();
  const [step, setStep] = useState(1);
  const [id, setId] = useState(''); const [name, setName] = useState('');
  const [pw, setPw] = useState(''); const [cpw, setCpw] = useState('');
  const { busy, err, run } = useAsync();
  const check = run(async () => { const r = await api('/employee/check-id', { method: 'POST', body: { employee_id: id } }); setName(r.data.name); setStep(2); });
  const reg = run(async () => {
    if (pw !== cpw) throw new Error('Passwords do not match.');
    if (!PW.test(pw)) throw new Error(PWMSG);
    await api('/employee/register', { method: 'POST', body: { employee_id: id, password: pw, confirm_password: cpw } });
    toast('Registration successful.'); nav('/employee/login');
  });
  return (
    <Card title="Register" sub={step === 1 ? 'Enter the Employee ID given by your administrator.' : `Welcome${name ? ', ' + name : ''}. Create your password.`}>
      {step === 1 ? (
        <form onSubmit={check}>
          <Field label="Employee ID"><input required value={id} onChange={(e) => setId(e.target.value)} /></Field>
          <Alert msg={err} />
          <button className="btn primary block" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
        </form>
      ) : (
        <form onSubmit={reg}>
          <Field label="Password"><PasswordInput required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Confirm password"><PasswordInput required autoComplete="new-password" value={cpw} onChange={(e) => setCpw(e.target.value)} /></Field>
          <p className="muted small">{PWMSG}</p>
          <Alert msg={err} />
          <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : 'Create account'}</button>
        </form>
      )}
      <p className="muted center-t">Already registered? <Link to="/employee/login">Login</Link></p>
    </Card>
  );
}

const Stat = ({ label, value }) => <div className="stat"><span>{label}</span><strong>{value ?? <i className="skel" />}</strong></div>;

const Sec = ({ title, children }) => <section className="sec"><h3>{title}</h3>{children}</section>;
const Tbl = ({ head, rows }) => (
  <div className="scroll"><table><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <td key={j}><strong>{c}</strong></td> : <td key={j}>{c}</td>))}</tr>)}</tbody></table></div>
);

export function AdminDashboard() {
  const [s, setS] = useState(null); const [a, setA] = useState(null); const { toast } = useUI();
  useEffect(() => {
    api('/admin/stats').then((r) => setS(r.data)).catch((e) => toast(e.message, 'err'));
    api('/admin/analytics').then((r) => setA(r.data)).catch((e) => toast(e.message, 'err'));
  }, [toast]);
  const N = a?.submitted;
  const dl = async (kind) => {
    const f = 'faculty-analytics-' + new Date().toISOString().slice(0, 10), sec = analyticsSections(a, s);
    try { if (kind === 'pdf') await downloadPDF(f, 'Faculty Analytics Report', sec); else downloadCSV(f, sec); } catch { toast('Could not generate the file', 'err'); }
  };
  return (
    <>
      <h2>Dashboard</h2>
      <div className="stats">
        <Stat label="Employee IDs" value={s?.total} /><Stat label="Active" value={s?.active} /><Stat label="Inactive" value={s?.inactive} />
        <Stat label="Registered accounts" value={s?.registered} /><Stat label="Profiles submitted" value={s?.profiles} />
      </div>
      <p><Link className="btn primary" to="/admin/employees">Manage employee IDs</Link></p>
      {!a ? <i className="skel wide" /> : N === 0 ? <p className="muted">Faculty statistics will appear once employees submit their profiles.</p> : (
        <>
          <div className="bar"><p className="muted" style={{ flex: 1, margin: 0 }}>Statistics are based on {N} submitted profile{N > 1 ? 's' : ''}.</p>
            <button className="btn ghost" onClick={() => dl('pdf')}>Download PDF</button>
            <button className="btn ghost" onClick={() => dl('csv')}>Download CSV</button></div>
          <Sec title="Gender">
            <div className="stats"><Stat label="Men" value={a.gender.male} /><Stat label="Women" value={a.gender.female} />
              <Stat label="Other" value={a.gender.other} /><Stat label="Women : Men ratio" value={ratio(a.gender.female, a.gender.male)} /></div>
          </Sec>
          <Sec title="Publications by all faculty">
            <div className="stats"><Stat label="Journals" value={a.pubs?.journals} /><Stat label="Conferences" value={a.pubs?.conferences} />
              <Stat label="Journals + Conferences" value={a.pubs ? a.pubs.journals + a.pubs.conferences : undefined} />
              <Stat label="Book chapters" value={a.pubs?.chapters} /><Stat label="Textbooks" value={a.pubs?.textbooks} />
              <Stat label="Total publications" value={a.pubs?.total} /></div>
          </Sec>
          <Sec title="PhD vs non-PhD (with gender)">
            <Tbl head={GH} rows={[gRow('PhD', a.phd), gRow('Non-PhD', a.nonPhd)]} />
            <p className="muted">PhD : Non-PhD ratio = <b>{ratio(a.phd.total, a.nonPhd.total)}</b></p>
          </Sec>
          <Sec title="Average age (years)">
            <div className="stats"><Stat label="All faculty" value={a.age.all ?? '—'} /><Stat label="Men" value={a.age.male ?? '—'} /><Stat label="Women" value={a.age.female ?? '—'} /></div>
          </Sec>
          <Sec title="Category-wise (with gender)">
            <Tbl head={GH} rows={Object.entries(a.category).map(([k, t]) => gRow(k, t))} />
          </Sec>
          <Sec title="Local vs non-local">
            <Tbl head={GH} rows={[gRow('Local (Andhra Pradesh)', a.local), gRow('Non-local', a.nonLocal)]} />
            <p className="muted">Local : Non-local ratio = <b>{ratio(a.local.total, a.nonLocal.total)}</b></p>
          </Sec>
          <Sec title="Experience (faculty with at least)">
            <Tbl head={['Experience', 'At KL University', 'Total (KLU + previous + industry)']}
              rows={[2, 3, 5, 10].map((n) => [`${n}+ years`, `${a.exp.kl[n]}${pc(a.exp.kl[n], N)}`, `${a.exp.total[n]}${pc(a.exp.total[n], N)}`])} />
          </Sec>
        </>
      )}
    </>
  );
}

const blankEmp = { employee_ids: '' };

export function AdminEmployees() {
  const { toast, confirm } = useUI();
  const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  const [res, setRes] = useState(null); const [form, setForm] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => api(`/admin/employees?search=${encodeURIComponent(q)}&page=${page}`).then((r) => setRes(r.data)).catch((e) => toast(e.message, 'err'));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, page]); // eslint-disable-line
  const act = (p, ok) => p.then((r) => { toast(r.message); ok?.(); load(); }).catch((e) => toast(e.message, 'err'));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    await act(form.id ? api('/admin/employees/' + form.id, { method: 'PUT', body: form }) : api('/admin/employees', { method: 'POST', body: form }), () => setForm(null));
    setBusy(false);
  };
  const del = async (x) => { if (await confirm(`Delete ${x.name} (${x.employee_id})? Their account and profile will also be removed.`)) act(api('/admin/employees/' + x.id, { method: 'DELETE' })); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
      <div className="bar"><h2>Employees</h2>
        <input className="search" placeholder="Search ID, name or department" aria-label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <button className="btn primary" onClick={() => setForm(blankEmp)}>Add employee ID</button></div>
      <div className="scroll"><table>
        <thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Status</th><th>Account</th><th>Profile</th><th /></tr></thead>
        <tbody>
          {!res && [1, 2, 3].map((i) => <tr key={i}><td colSpan="7"><i className="skel wide" /></td></tr>)}
          {res?.items.length === 0 && <tr><td colSpan="7" className="muted">{q ? 'No employees match your search.' : 'No employee IDs yet. Add the first one.'}</td></tr>}
          {res?.items.map((x) => (
            <tr key={x.id}>
              <td><strong>{x.employee_id}</strong></td><td>{x.name || '—'}</td><td>{x.department || '—'}</td>
              <td><span className={'badge ' + (x.is_active ? 'on' : 'off')}>{x.is_active ? 'Active' : 'Inactive'}</span></td>
              <td>{x.registered ? 'Registered' : 'Pending'}</td><td>{x.profile ? 'Submitted' : '—'}</td>
              <td className="rowact">
                <button className="link" onClick={() => setForm(x)}>Edit</button>
                <button className="link" onClick={() => act(api(`/admin/employees/${x.id}/status`, { method: 'PATCH', body: { is_active: !x.is_active } }))}>{x.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="link err" onClick={() => del(x)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody></table></div>
      {res && <div className="pager"><button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {res.page} of {res.pages} · {res.total} total</span>
        <button className="btn ghost" disabled={page >= res.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
      {form && (
        <div className="overlay"><form className="dialog" onSubmit={save}>
          <h3>{form.id ? 'Edit Employee ID' : 'Add Employee IDs'}</h3>
          {form.id
            ? <Field label="Employee ID"><input required value={form.employee_id} onChange={set('employee_id')} /></Field>
            : <Field label="Employee ID(s)"><textarea required rows="4" placeholder="E101&#10;E102, E103" value={form.employee_ids} onChange={set('employee_ids')} />
              <small>Add one or many, separated by commas or new lines.</small></Field>}
          <div className="actions"><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
        </form></div>
      )}
    </>
  );
}

const jcPubs = (r = {}) => (+r.journals || 0) + (+r.conferences || 0);

export function EmployeeDashboard() {
  const { user } = useAuth(); const [p, setP] = useState(undefined);
  useEffect(() => { api('/employee/profile').then((r) => setP(r.data)).catch(() => setP(null)); }, []);
  const pp = p?.data?.p || {}; const nm = user.name || pp.fullName;
  return (
    <>
      <h2>Welcome{nm ? `, ${nm}` : ''}</h2>
      <div className="stats">
        <Stat label="Employee ID" value={user.employee_id} /><Stat label="Employee name" value={p === undefined ? undefined : nm || '—'} />
        <Stat label="Publications (Journals + Conferences)" value={p === undefined ? undefined : p ? jcPubs(p.data?.r) : '—'} />
        <Stat label="Department" value={p === undefined ? undefined : user.department || pp.currentDept || '—'} /><Stat label="Designation" value={p === undefined ? undefined : user.designation || pp.designation || '—'} />
      </div>
      <div className="card wide">
        <h3>My profile</h3>
        {p === undefined ? <i className="skel wide" /> : <p className="muted">{p ? `Profile submitted. Last updated ${p.updated_at} UTC.` : 'You have not submitted your details yet.'}</p>}
        <Link className="btn primary" to="/employee/profile">{p ? 'View or update details' : 'Fill in my details'}</Link>
      </div>
    </>
  );
}

const REPORT_LIST = [['highest-degree', 'Highest degree and date obtained'], ['nit-iit', 'UG / PG / PhD from NITs or IITs'], ['phd-country', 'PhD university and country'], ['pdf-country', 'Post-Doctoral (PDF) university and country']];

export function AdminReports() {
  const { toast } = useUI();
  const [type, setType] = useState('highest-degree'); const [all, setAll] = useState(false); const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    api(`/admin/reports/${type}${all && type === 'nit-iit' ? '?mode=all' : ''}`).then((r) => setData(r.data)).catch((e) => toast(e.message, 'err'));
  }, [type, all, toast]);
  const dl = async (kind) => {
    const f = `report-${type}-${new Date().toISOString().slice(0, 10)}`, sec = [{ title: data.title, head: data.head, rows: data.rows }];
    try { if (kind === 'pdf') await downloadPDF(f, 'Faculty Report', sec, null, true); else downloadCSV(f, sec); } catch { toast('Could not generate the file', 'err'); }
  };
  return (
    <>
      <div className="bar"><h2>Reports</h2>
        <select style={{ width: 320 }} aria-label="Report" value={type} onChange={(e) => setType(e.target.value)}>{REPORT_LIST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn ghost" disabled={!data?.rows.length} onClick={() => dl('pdf')}>Download PDF</button>
        <button className="btn ghost" disabled={!data?.rows.length} onClick={() => dl('csv')}>Download CSV</button></div>
      {type === 'nit-iit' && <label className="chk"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Only faculty with all of UG, PG and PhD from NITs/IITs</label>}
      <div className="scroll"><table>
        <thead><tr>{(data?.head || ['Employee ID', 'Name', 'Department', 'Designation']).map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {!data && [1, 2, 3].map((i) => <tr key={i}><td colSpan="8"><i className="skel wide" /></td></tr>)}
          {data?.rows.length === 0 && <tr><td colSpan={data.head.length} className="muted">No faculty match this report yet. Results appear as employees submit their profiles.</td></tr>}
          {data?.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        </tbody></table></div>
      {data && <p className="muted">{data.rows.length} faculty</p>}
    </>
  );
}

const OPT = (a) => a.map((x) => [x, x]);
const YRS = [['2', '2+ years'], ['3', '3+ years'], ['5', '5+ years'], ['10', '10+ years']];
const FILTERS = [
  ['gender', 'Gender', OPT(['Male', 'Female', 'Other'])], ['category', 'Category', OPT(['OC', 'OBC', 'SC', 'ST'])],
  ['designation', 'Designation', OPT(['Professor', 'Associate Professor', 'Assistant Professor', 'Others'])],
  ['phd', 'PhD', [['yes', 'PhD holders'], ['no', 'Non-PhD']]], ['local', 'Local / non-local', [['yes', 'Local (Andhra Pradesh)'], ['no', 'Non-local']]],
  ['research', 'Research level', OPT(['LN (New Faculty)', 'L0', 'L1', 'L2', 'L3', 'L4'])],
  ['minKl', 'Experience at KLU', YRS], ['minTotal', 'Total experience', YRS],
];
const PRESETS = [['SC faculty', { category: 'SC' }], ['ST faculty', { category: 'ST' }], ['OBC faculty', { category: 'OBC' }], ['OC faculty', { category: 'OC' }],
  ['Male faculty', { gender: 'Male' }], ['Female faculty', { gender: 'Female' }], ['Professors', { designation: 'Professor' }],
  ['Associate Professors', { designation: 'Associate Professor' }], ['Assistant Professors', { designation: 'Assistant Professor' }],
  ['PhD faculty', { phd: 'yes' }], ['Non-PhD faculty', { phd: 'no' }], ['Local faculty', { local: 'yes' }], ['Non-local faculty', { local: 'no' }]];
const COLS = ['Employee ID', 'Name', 'Gender', 'Category', 'Department', 'Designation', 'Research level', 'PhD', 'Local', 'Exp. at KLU (yrs)', 'Total exp. (yrs)', 'Publications (J+C)'];

export function FacultyLists() {
  const { toast } = useUI();
  const [all, setAll] = useState(null); const [f, setF] = useState({});
  useEffect(() => { api('/admin/faculty').then((r) => setAll(r.data)).catch((e) => toast(e.message, 'err')); }, [toast]);
  const depts = [...new Set((all || []).map((r) => r.department).filter(Boolean))].sort();
  const match = (r) => (!f.gender || r.gender === f.gender) && (!f.category || r.category === f.category) && (!f.designation || r.designation === f.designation)
    && (!f.phd || (f.phd === 'yes') === r.phd) && (!f.local || (f.local === 'yes') === r.local) && (!f.department || r.department === f.department)
    && (!f.research || r.research === f.research) && (!f.minKl || r.klYears >= +f.minKl) && (!f.minTotal || r.totalYears >= +f.minTotal);
  const rows = (all || []).filter(match);
  const title = [...FILTERS.filter(([k]) => f[k]).map(([k, l, o]) => `${l}: ${o.find((x) => x[0] === f[k])[1]}`), ...(f.department ? [`Department: ${f.department}`] : [])].join('; ') || 'All faculty';
  const table = rows.map((r) => [r.employee_id, r.name, r.gender, r.category, r.department, r.designation, r.research, r.phd ? 'Yes' : 'No', r.local ? 'Yes' : 'No', r.klYears, r.totalYears, r.pubs]);
  const dl = async (kind) => {
    const file = 'faculty-list-' + new Date().toISOString().slice(0, 10), sec = [{ title: `${title} (${rows.length} faculty)`, head: COLS, rows: table }];
    try { if (kind === 'pdf') await downloadPDF(file, 'Faculty List', sec, null, true); else downloadCSV(file, sec); } catch { toast('Could not generate the file', 'err'); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <h2>Faculty lists</h2>
      <p className="muted">Pick a ready-made list or combine filters. Only active employees who have submitted their profile are included.</p>
      <div className="presets">{PRESETS.map(([l, v]) => <button key={l} className="btn ghost" onClick={() => setF(v)}>{l}</button>)}
        <button className="link" onClick={() => setF({})}>Clear filters</button></div>
      <div className="grid filters">
        {FILTERS.map(([k, l, o]) => <Field key={k} label={l}><select value={f[k] || ''} onChange={set(k)}><option value="">All</option>{o.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>)}
        <Field label="Department"><select value={f.department || ''} onChange={set('department')}><option value="">All</option>{depts.map((d) => <option key={d}>{d}</option>)}</select></Field>
      </div>
      <div className="bar"><p className="muted" style={{ flex: 1, margin: 0 }}><b>{all ? rows.length : '…'}</b> faculty · {title}</p>
        <button className="btn ghost" disabled={!rows.length} onClick={() => dl('pdf')}>Download PDF</button>
        <button className="btn ghost" disabled={!rows.length} onClick={() => dl('csv')}>Download CSV</button></div>
      <div className="scroll"><table>
        <thead><tr>{COLS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {!all && [1, 2, 3].map((i) => <tr key={i}><td colSpan={COLS.length}><i className="skel wide" /></td></tr>)}
          {all && rows.length === 0 && <tr><td colSpan={COLS.length} className="muted">No faculty match these filters.</td></tr>}
          {table.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        </tbody></table></div>
    </>
  );
}

export function ChangePassword() {
  const { user } = useAuth(); const { toast } = useUI();
  const empty = { current_password: '', new_password: '', confirm_password: '' };
  const [f, setF] = useState(empty);
  const { busy, err, run } = useAsync();
  const go = run(async () => {
    if (f.new_password !== f.confirm_password) throw new Error('New passwords do not match.');
    if (!PW.test(f.new_password)) throw new Error(PWMSG);
    const r = await api(`/${user.role}/change-password`, { method: 'POST', body: f });
    toast(r.message); setF(empty);
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <h2>Change password</h2>
      <form className="card" onSubmit={go}>
        <Field label="Current password"><PasswordInput required autoComplete="current-password" value={f.current_password} onChange={set('current_password')} /></Field>
        <Field label="New password"><PasswordInput required autoComplete="new-password" value={f.new_password} onChange={set('new_password')} /></Field>
        <Field label="Confirm new password"><PasswordInput required autoComplete="new-password" value={f.confirm_password} onChange={set('confirm_password')} /></Field>
        <p className="muted small">{PWMSG}</p>
        {err && <p className="alert" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </>
  );
}

export const NotFound = () => <Card title="404 – Page not found" sub="The page you are looking for does not exist."><Link className="btn primary block" to="/">Go to home</Link></Card>;
export function Forbidden() {
  const { user } = useAuth();
  return <Card title="Access denied" sub="You do not have permission to view this page."><Link className="btn primary block" to={user ? (user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard') : '/employee/login'}>Back</Link></Card>;
}
