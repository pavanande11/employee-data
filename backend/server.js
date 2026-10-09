const express = require('express'), cors = require('cors');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), crypto = require('crypto');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set. Copy .env.example to .env and edit it.'); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined });
const q = (text, params) => pool.query(text, params);
const one = async (text, params) => (await q(text, params)).rows[0];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS employees(id SERIAL PRIMARY KEY, employee_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '', department TEXT DEFAULT '', designation TEXT DEFAULT '', is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_id_uq ON employees (lower(employee_id));
CREATE TABLE IF NOT EXISTS employee_auth(id SERIAL PRIMARY KEY, employee_ref INTEGER UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL, is_registered BOOLEAN NOT NULL DEFAULT true, last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS profiles(id SERIAL PRIMARY KEY, employee_ref INTEGER UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data JSONB NOT NULL, photo TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());`;

const SECRET = process.env.JWT_SECRET || (console.warn('JWT_SECRET not set: using a temporary secret (sessions reset on restart)'), crypto.randomBytes(32).toString('hex'));
const DUMMY = bcrypt.hashSync('dummy-password', 10);
const PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,64}$/;
const PWMSG = 'Password must be 8-64 characters with uppercase, lowercase, a number and a special character.';
const send = (res, code, message, data) => res.status(code).json({ success: code < 400, message, ...(data !== undefined && { data }) });
const clean = (v, n = 100) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const rid = (req) => (/^\d+$/.test(req.params.id) ? +req.params.id : 0);
const isDup = (e) => e && e.code === '23505';

const shape = async (role, x) => {
  if (role === 'admin') return { role, username: x.username };
  const p = (await one('SELECT data FROM profiles WHERE employee_ref=$1', [x.id]))?.data?.p || {};
  return { role, employee_id: x.employee_id, name: x.name || p.fullName || '', email: x.email || '',
    department: x.department || p.currentDept || '', designation: x.designation || p.designation || '' };
};
// The token lives in the browser's sessionStorage, so it disappears when the tab/window is closed.
const sign = (sub, role) => jwt.sign({ sub, role }, SECRET, { expiresIn: '8h' });
const tokenOf = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');

const auth = (role) => async (req, res, next) => {
  let p;
  try { p = jwt.verify(tokenOf(req), SECRET); } catch { return send(res, 401, 'Session expired. Please sign in again.'); }
  if (p.role !== role) return send(res, 403, 'Access denied');
  try {
    if (role === 'admin') {
      req.user = await one('SELECT id, username FROM users WHERE id=$1', [p.sub]);
      if (!req.user) return send(res, 401, 'Session expired. Please sign in again.');
    } else {
      req.emp = await one('SELECT * FROM employees WHERE id=$1', [p.sub]);
      if (!req.emp || !req.emp.is_active) return send(res, 401, 'Account unavailable. Please sign in again.');
    }
    next();
  } catch (e) { next(e); }
};
const admin = auth('admin'), emp = auth('employee');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));
const R = express.Router();
app.use('/api', R);

// ---------- test check ----------
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Employee Data API is running",
    status: "OK"
  });
});

app.get("/api/test", (req, res) => {
  res.status(200).json({
    message: "API route is working",
    status: "OK"
  });
});

// ---------- shared ----------
R.get('/auth/me', (req, res, next) => {
  let p;
  try { p = jwt.verify(tokenOf(req), SECRET); } catch { return send(res, 401, 'Not signed in'); }
  auth(p.role === 'admin' ? 'admin' : 'employee')(req, res, async () => {
    try { send(res, 200, 'OK', await shape(p.role, req.user || req.emp)); } catch (e) { next(e); }
  });
});
R.post('/auth/logout', (req, res) => send(res, 200, 'Logged out'));

// ---------- admin ----------
R.post('/admin/login', h(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE username=$1', [clean(req.body.username)]);
  const ok = bcrypt.compareSync(String(req.body.password || ''), u ? u.password_hash : DUMMY);
  if (!u || !ok) return send(res, 401, 'Invalid username or password.');
  send(res, 200, 'Login successful', { ...(await shape('admin', u)), token: sign(u.id, 'admin') });
}));
R.get('/admin/me', admin, h(async (req, res) => send(res, 200, 'OK', await shape('admin', req.user))));
R.get('/admin/stats', admin, h(async (req, res) => send(res, 200, 'OK', await one(`SELECT COUNT(*)::int total,
  COUNT(*) FILTER (WHERE is_active)::int active, COUNT(*) FILTER (WHERE NOT is_active)::int inactive,
  (SELECT COUNT(*)::int FROM employee_auth) registered, (SELECT COUNT(*)::int FROM profiles) profiles FROM employees`))));

const empInput = (b) => {
  const e = { employee_id: clean(b.employee_id, 20), name: clean(b.name), email: clean(b.email, 120), department: clean(b.department), designation: clean(b.designation) };
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(e.employee_id)) return ['Employee ID must be 2-20 letters, numbers, - or _'];
  if (e.email && !/^\S+@\S+\.\S+$/.test(e.email)) return ['Invalid email address'];
  return [null, e];
};

R.get('/admin/employees', admin, h(async (req, res) => {
  const s = `%${clean(req.query.search, 50)}%`, lim = 10, page = Math.max(1, +req.query.page || 1);
  const from = `FROM employees e LEFT JOIN profiles p ON p.employee_ref=e.id
    WHERE e.employee_id ILIKE $1 OR e.name ILIKE $1 OR p.data->'p'->>'fullName' ILIKE $1 OR p.data->'p'->>'currentDept' ILIKE $1`;
  const total = (await one(`SELECT COUNT(*)::int c ${from}`, [s])).c;
  const items = (await q(`SELECT e.id, e.employee_id,
    COALESCE(NULLIF(e.name,''), p.data->'p'->>'fullName', '') AS name,
    COALESCE(NULLIF(e.department,''), p.data->'p'->>'currentDept', '') AS department,
    e.is_active, (p.id IS NOT NULL) AS profile,
    EXISTS(SELECT 1 FROM employee_auth a WHERE a.employee_ref=e.id) AS registered
    ${from} ORDER BY e.id DESC LIMIT ${lim} OFFSET ${(page - 1) * lim}`, [s])).rows;
  send(res, 200, 'OK', { items, total, page, pages: Math.ceil(total / lim) || 1 });
}));
R.get('/admin/employees/:id', admin, h(async (req, res) => {
  const e = await one('SELECT * FROM employees WHERE id=$1', [rid(req)]);
  e ? send(res, 200, 'OK', e) : send(res, 404, 'Employee not found');
}));
R.post('/admin/employees', admin, h(async (req, res) => {
  const ids = [...new Set(String(req.body.employee_ids ?? req.body.employee_id ?? '').split(/[\s,;]+/).map((s) => clean(s, 20)).filter(Boolean))];
  if (!ids.length) return send(res, 400, 'Enter at least one Employee ID');
  const bad = ids.find((i) => !/^[A-Za-z0-9_-]{2,20}$/.test(i));
  if (bad) return send(res, 400, `Invalid Employee ID "${bad}". Use 2-20 letters, numbers, - or _`);
  let added = 0;
  for (const i of ids) added += (await q('INSERT INTO employees(employee_id) VALUES($1) ON CONFLICT DO NOTHING', [i])).rowCount;
  const skipped = ids.length - added;
  if (!added) return send(res, 409, ids.length > 1 ? 'All these Employee IDs already exist' : 'Employee ID already exists');
  send(res, 201, `${added} Employee ID${added > 1 ? 's' : ''} added${skipped ? `, ${skipped} already existed` : ''}. Employees can now register.`);
}));
R.put('/admin/employees/:id', admin, h(async (req, res) => {
  const [err, e] = empInput(req.body); if (err) return send(res, 400, err);
  try {
    const r = await q('UPDATE employees SET employee_id=$1, name=$2, email=$3, department=$4, designation=$5, updated_at=now() WHERE id=$6',
      [e.employee_id, e.name, e.email, e.department, e.designation, rid(req)]);
    r.rowCount ? send(res, 200, 'Employee updated') : send(res, 404, 'Employee not found');
  } catch (x) { if (isDup(x)) return send(res, 409, 'Employee ID already exists'); throw x; }
}));
R.patch('/admin/employees/:id/status', admin, h(async (req, res) => {
  const on = !!req.body.is_active;
  const r = await q('UPDATE employees SET is_active=$1, updated_at=now() WHERE id=$2', [on, rid(req)]);
  r.rowCount ? send(res, 200, on ? 'Employee activated' : 'Employee deactivated') : send(res, 404, 'Employee not found');
}));
R.delete('/admin/employees/:id', admin, h(async (req, res) => {
  const r = await q('DELETE FROM employees WHERE id=$1', [rid(req)]);
  r.rowCount ? send(res, 200, 'Employee deleted') : send(res, 404, 'Employee not found');
}));

// ---------- employee ----------
const find = (id) => one('SELECT e.*, EXISTS(SELECT 1 FROM employee_auth a WHERE a.employee_ref=e.id) AS registered FROM employees e WHERE lower(e.employee_id)=lower($1)', [id]);
const eligible = async (id) => {
  const e = await find(id);
  if (!e) return [404, 'Employee ID does not exist. Please contact your administrator.'];
  if (!e.is_active) return [403, 'This Employee ID is inactive. Please contact your administrator.'];
  if (e.registered) return [409, 'This Employee ID is already registered. Please log in.'];
  return [200, 'Employee ID verified', e];
};
R.post('/employee/check-id', h(async (req, res) => {
  const [c, m, e] = await eligible(clean(req.body.employee_id, 20));
  send(res, c, m, c === 200 ? { name: e.name } : undefined);
}));
R.post('/employee/register', h(async (req, res) => {
  const [c, m, e] = await eligible(clean(req.body.employee_id, 20));
  if (c !== 200) return send(res, c, m);
  const { password, confirm_password } = req.body;
  if (password !== confirm_password) return send(res, 400, 'Passwords do not match.');
  if (!PW.test(String(password))) return send(res, 400, PWMSG);
  try { await q('INSERT INTO employee_auth(employee_ref, password_hash) VALUES($1,$2)', [e.id, bcrypt.hashSync(password, 12)]); }
  catch (x) { if (isDup(x)) return send(res, 409, 'This Employee ID is already registered. Please log in.'); throw x; }
  send(res, 201, 'Registration successful.');
}));
R.post('/employee/login', h(async (req, res) => {
  const r = await one('SELECT e.*, a.password_hash FROM employees e JOIN employee_auth a ON a.employee_ref=e.id WHERE lower(e.employee_id)=lower($1)', [clean(req.body.employee_id, 20)]);
  const ok = bcrypt.compareSync(String(req.body.password || ''), r ? r.password_hash : DUMMY);
  if (!r || !ok || !r.is_active) return send(res, 401, 'Invalid Employee ID or password.');
  await q('UPDATE employee_auth SET last_login=now() WHERE employee_ref=$1', [r.id]);
  send(res, 200, 'Login successful', { ...(await shape('employee', r)), token: sign(r.id, 'employee') });
}));
R.get('/employee/me', emp, h(async (req, res) => send(res, 200, 'OK', await shape('employee', req.emp))));
R.get('/employee/profile', emp, h(async (req, res) => {
  const p = await one('SELECT data, photo, updated_at FROM profiles WHERE employee_ref=$1', [req.emp.id]);
  send(res, 200, 'OK', p || null);
}));
R.put('/employee/profile', emp, h(async (req, res) => {
  const { data, photo } = req.body;
  const ok = data && data.p && data.e && data.x && data.r && ['journals', 'conferences', 'chapters', 'textbooks'].every((k) => /^\d{1,5}$/.test(String(data.r[k]))) && /^\d{10}$/.test(String(data.p.mobile)) && /^\d{12}$/.test(String(data.p.aadhaar)) && /^[A-Z]{5}\d{4}[A-Z]$/.test(String(data.p.pan)) &&
    clean(data.p.fullName) && typeof photo === 'string' && /^data:image\/(png|jpeg);base64,/.test(photo) && photo.length <= 1.45e6;
  if (!ok) return send(res, 400, 'Invalid profile data. Check required fields and that the photo is a PNG/JPEG under 1 MB.');
  await q(`INSERT INTO profiles(employee_ref, data, photo) VALUES($1, $2::jsonb, $3)
    ON CONFLICT (employee_ref) DO UPDATE SET data=EXCLUDED.data, photo=EXCLUDED.photo, updated_at=now()`, [req.emp.id, JSON.stringify(data), photo]);
  send(res, 200, 'Profile saved');
}));

const changePassword = (sel, upd, idOf) => h(async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const row = await one(sel, [idOf(req)]);
  if (!bcrypt.compareSync(String(current_password || ''), row.password_hash)) return send(res, 400, 'Current password is incorrect.');
  if (new_password !== confirm_password) return send(res, 400, 'New passwords do not match.');
  if (!PW.test(String(new_password))) return send(res, 400, PWMSG);
  if (new_password === current_password) return send(res, 400, 'New password must be different from the current password.');
  await q(upd, [bcrypt.hashSync(new_password, 12), idOf(req)]);
  send(res, 200, 'Password changed successfully.');
});
R.post('/admin/change-password', admin, changePassword('SELECT password_hash FROM users WHERE id=$1',
  'UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2', (r) => r.user.id));
R.post('/employee/change-password', emp, changePassword('SELECT password_hash FROM employee_auth WHERE employee_ref=$1',
  'UPDATE employee_auth SET password_hash=$1, updated_at=now() WHERE employee_ref=$2', (r) => r.emp.id));

// ---------- analytics ----------
R.get('/admin/analytics', admin, h(async (req, res) => {
  const rows = (await q('SELECT data FROM profiles')).rows.map((r) => r.data).filter((d) => d && d.p);
  const now = Date.now(), YR = 864e5 * 365.25;
  const yrs = (a, b) => (a && b && new Date(b) >= new Date(a) ? (new Date(b) - new Date(a)) / YR : 0);
  const tally = () => ({ male: 0, female: 0, other: 0, total: 0 });
  const A = { submitted: rows.length, gender: tally(), phd: tally(), nonPhd: tally(), local: tally(), nonLocal: tally(),
    category: { OC: tally(), OBC: tally(), SC: tally(), ST: tally() }, age: { all: [0, 0], male: [0, 0], female: [0, 0] },
    exp: { kl: { 2: 0, 3: 0, 5: 0, 10: 0 }, total: { 2: 0, 3: 0, 5: 0, 10: 0 } },
    pubs: { journals: 0, conferences: 0, chapters: 0, textbooks: 0, total: 0 } };
  const add = (t, k) => { t[k]++; t.total++; };
  for (const d of rows) {
    const p = d.p, e = d.e || {}, x = d.x || {}, rs = d.r || {};
    for (const k of ['journals', 'conferences', 'chapters', 'textbooks']) { const v = Number(rs[k]) || 0; A.pubs[k] += v; A.pubs.total += v; }
    const g = p.gender === 'Male' ? 'male' : p.gender === 'Female' ? 'female' : 'other';
    add(A.gender, g); add(e.phd ? A.phd : A.nonPhd, g);
    if (A.category[p.category]) add(A.category[p.category], g);
    add(p.country === 'India' && p.state === 'Andhra Pradesh' ? A.local : A.nonLocal, g);
    const age = p.dob ? (now - new Date(p.dob)) / YR : 0;
    if (age > 0) for (const k of ['all', g]) if (A.age[k]) { A.age[k][0] += age; A.age[k][1]++; }
    const kl = x.kl ? Math.max(0, (now - new Date(x.kl)) / YR) : 0;
    const tot = kl + [...(x.prev || []), ...(x.ind || [])].reduce((s, r) => s + yrs(r.from, r.to), 0);
    for (const n of [2, 3, 5, 10]) { if (kl >= n) A.exp.kl[n]++; if (tot >= n) A.exp.total[n]++; }
  }
  A.age = Object.fromEntries(Object.entries(A.age).map(([k, [s, n]]) => [k, n ? +(s / n).toFixed(1) : null]));
  send(res, 200, 'OK', A);
}));

// ---------- reports ----------
const NI = ['NITs', 'IITs'];
const countryReport = (key, title) => ({ title, head: ['Institution type', 'University', 'Country'],
  row: (d) => {
    const v = d.e?.[key]; if (!v) return null;
    return [v.instType || '-', v.university || '-', v.country === 'Outside India' ? `Outside India - ${v.countryName || ''}` : v.country || 'Not specified'];
  } });
const REPORTS = {
  'highest-degree': { title: 'Highest degree and date obtained', head: ['Highest degree', 'Stream', 'Date obtained'],
    row: (d) => { const hd = d.e?.highest || {}; return [hd.degree || '-', hd.stream || '-', hd.date || '-']; } },
  'nit-iit': { title: 'UG, PG and PhD from NITs / IITs', head: ['UG', 'PG', 'PhD', 'All three from NITs/IITs'],
    row: (d, mode) => {
      const cell = (v) => (v && NI.includes(v.instType) ? `${v.instType} - ${v.university || ''}` : '-');
      const c = [cell(d.e?.ug), cell(d.e?.pg), cell(d.e?.phd)], n = c.filter((x) => x !== '-').length;
      return n === 0 || (mode === 'all' && n < 3) ? null : [...c, n === 3 ? 'Yes' : 'No'];
    } },
  'phd-country': countryReport('phd', 'PhD university and country'),
  'pdf-country': countryReport('pdf', 'Post-Doctoral Fellowship (PDF) university and country'),
};
R.get('/admin/reports/:type', admin, h(async (req, res) => {
  const rep = REPORTS[req.params.type];
  if (!rep) return send(res, 404, 'Unknown report');
  const rows = [];
  for (const r of (await q('SELECT e.employee_id, e.name, e.department, e.designation, p.data FROM employees e JOIN profiles p ON p.employee_ref=e.id ORDER BY e.employee_id')).rows) {
    const d = r.data;
    const x = rep.row(d, req.query.mode);
    if (x) rows.push([r.employee_id, r.name || d.p?.fullName || '', r.department || d.p?.currentDept || '', r.designation || d.p?.designation || '', ...x]);
  }
  send(res, 200, 'OK', { title: rep.title, head: ['Employee ID', 'Name', 'Department', 'Designation', ...rep.head], rows });
}));

// ---------- faculty list (flattened rows; the admin page filters them) ----------
const flat = (r, d) => {
  const p = d.p || {}, x = d.x || {}, rs = d.r || {}, YR = 864e5 * 365.25;
  const kl = x.kl ? Math.max(0, (Date.now() - new Date(x.kl)) / YR) : 0;
  const span = (a) => (a.from && a.to && new Date(a.to) >= new Date(a.from) ? (new Date(a.to) - new Date(a.from)) / YR : 0);
  const total = kl + [...(x.prev || []), ...(x.ind || [])].reduce((s, a) => s + span(a), 0);
  return { employee_id: r.employee_id, name: r.name || p.fullName || '', gender: p.gender || '', category: p.category || '',
    department: r.department || p.currentDept || '', designation: r.designation || p.designation || '', research: p.research || '',
    phd: !!d.e?.phd, local: p.country === 'India' && p.state === 'Andhra Pradesh', klYears: +kl.toFixed(1), totalYears: +total.toFixed(1),
    pubs: (+rs.journals || 0) + (+rs.conferences || 0) };
};
R.get('/admin/faculty', admin, h(async (req, res) => {
  const rows = (await q('SELECT e.employee_id, e.name, e.department, e.designation, p.data FROM employees e JOIN profiles p ON p.employee_ref=e.id WHERE e.is_active ORDER BY e.employee_id')).rows;
  send(res, 200, 'OK', rows.map((r) => flat(r, r.data)));
}));

R.use((req, res) => send(res, 404, 'Not found'));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return send(res, 413, 'Request too large');
  console.error(err);
  send(res, 500, 'Server error');
});

(async () => {
  await q(SCHEMA);
  const { ADMIN_USERNAME: AU, ADMIN_PASSWORD: AP } = process.env;
  if (!AU || !AP) console.warn('Set ADMIN_USERNAME and ADMIN_PASSWORD in .env to create the first admin');
  else if (!(await one('SELECT 1 FROM users WHERE username=$1', [AU])))
    await q("INSERT INTO users(username, password_hash, role) VALUES($1,$2,'admin')", [AU, bcrypt.hashSync(AP, 12)]);
  app.listen(process.env.PORT || 5000, () => console.log('API running on port ' + (process.env.PORT || 5000)));
})().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
