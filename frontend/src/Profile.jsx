import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useUI, Field } from './ui.jsx';
import { useAuth } from './auth.jsx';
import { downloadCSV, downloadPDF } from './export.js';

const DEPTS = ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Mathematics', 'Physics', 'Chemistry', 'English', 'Management', 'Other'];
const INST = ['NITs', 'IITs', 'State University'];
const MARKS = [['obtained', 'Marks obtained', 'number'], ['total', 'Total marks', 'number'], ['date', 'Date obtained', 'date']];
const deg = (o) => [['degree', 'Degree', 'select', o], ['stream', 'Stream / specialization'], ['instType', 'Institution type', 'select', INST], ['university', 'University name']];
const P = [
  ['fullName', 'Full name (as per SSC)'], ['gender', 'Gender', 'select', ['Male', 'Female', 'Other']], ['dob', 'Date of birth', 'date'],
  ['mobile', 'Mobile number', 'tel'], ['marital', 'Marital status', 'select', ['Single', 'Married', 'Divorced', 'Widowed']],
  ['parentDept', 'Parent department', 'select', DEPTS], ['currentDept', 'Current department', 'select', DEPTS],
  ['designation', 'Designation', 'select', ['Professor', 'Associate Professor', 'Assistant Professor', 'Others']],
  ['research', 'Research level', 'select', ['LN (New Faculty)', 'L0', 'L1', 'L2', 'L3', 'L4']],
  ['category', 'Category', 'select', ['OC', 'OBC', 'SC', 'ST']],
  ['country', 'Country', 'select', ['India', 'Other country']],
  ['aadhaar', 'Aadhaar number'], ['pan', 'PAN number'],
  ['bloodGroup', 'Blood group', 'select', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']],
  ['permAddress', 'Permanent address', 'area'], ['corrAddress', 'Correspondence address', 'area'],
];
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
const geo = (p) => (p.country === 'India' ? [['state', 'State of Domicile', 'select', STATES]] : p.country ? [['otherCountry', 'Enter country name']] : []);
const fieldsP = (p) => P.flatMap((f) => (f[0] === 'country' ? [f, ...geo(p)] : [f]));
const EDU = {
  ssc: { t: 'State board (SSC)', f: [['board', 'State board name'], ...MARKS], m: 1 },
  inter: { t: 'Intermediate / Diploma', f: [['board', 'Board / institution'], ...MARKS], m: 1 },
  ug: { t: 'Bachelor degree (UG)', f: [...deg(['B.Tech', 'BCA', 'B.Sc', 'BA']), ...MARKS], m: 1 },
  pg: { t: 'Postgraduate degree', f: [...deg(['M.Tech', 'MCA', 'M.Sc', 'MS']), ...MARKS], m: 1 },
  pg2: { t: 'Additional postgraduate degree', f: [...deg(['M.Tech', 'M.Phil', 'MS']), ...MARKS], m: 1, opt: 'I have an additional PG degree' },
  highest: { t: 'Highest degree obtained', f: [['degree', 'Degree', 'select', ['M.Tech', 'MCA', 'MS', 'M.Phil']], ['stream', 'Stream / specialization'], ['date', 'Date obtained', 'date']] },
  phd: { t: 'PhD', f: [['instType', 'Institution type', 'select', [...INST, 'Other / foreign university']], ['university', 'University name'], ['country', 'Country of study', 'select', ['India', 'Outside India']], ['date', 'Date obtained', 'date']], opt: 'I have a PhD' },
};
const STEPS = ['Personal', 'Education', 'Experience', 'Research', 'Photo', 'Review'];
const RES = [['scopus', 'Scopus ID'], ['wos', 'Web of Science ID'], ['scholar', 'Google Scholar ID'], ['orcid', 'ORCID ID'],
  ['journals', 'Publications in journals', 'number'], ['conferences', 'Publications in conferences', 'number'],
  ['chapters', 'Book chapters', 'number'], ['textbooks', 'Textbooks', 'number']];
const PUBS = ['journals', 'conferences', 'chapters', 'textbooks'];
const jc = (r = {}) => (+r.journals || 0) + (+r.conferences || 0);
EDU.pdf = { ...EDU.phd, t: 'Post-Doctoral Fellowship (PDF)', opt: 'I have done a Post-Doctoral Fellowship (PDF)' };
const ef = (k, v) => (v?.country === 'Outside India' ? [...EDU[k].f, ['countryName', 'Country name']] : EDU[k].f);
const blank = () => ({ p: {}, e: { ssc: {}, inter: {}, ug: {}, pg: {}, pg2: null, highest: {}, phd: null, pdf: null }, x: { kl: '', prev: [], ind: [] }, r: {} });

const pct = (o, t) => (+t > 0 && +o >= 0 && +o <= +t ? (o / t * 100).toFixed(2) + '%' : '—');
const today = () => new Date().toISOString().slice(0, 10);
const days = (a, b) => (a && b && b >= a ? (new Date(b) - new Date(a)) / 864e5 : 0);
const fmt = (d) => `${Math.floor(d / 365.25)} yr ${Math.floor((d % 365.25) / 30.44)} mo`;
const sum = (rows) => rows.reduce((s, r) => s + days(r.from, r.to), 0);
const need = (o, fs) => fs.every(([k]) => String(o?.[k] ?? '').trim());

function check(step, d, photo) {
  if (step === 0) {
    if (!need(d.p, fieldsP(d.p))) return 'Please fill all personal details.';
    if (!/^\d{10}$/.test(d.p.mobile)) return 'Mobile number must be 10 digits.';
    if (!/^\d{12}$/.test(d.p.aadhaar)) return 'Aadhaar number must be 12 digits.';
    if (!/^[A-Z]{5}\d{4}[A-Z]$/i.test(d.p.pan)) return 'PAN must look like ABCDE1234F.';
  }
  if (step === 1) {
    for (const [k, c] of Object.entries(EDU)) {
      const v = d.e[k]; if (!v) continue;
      if (!need(v, ef(k, v))) return `Please complete: ${c.t}.`;
      if (c.m && +v.obtained > +v.total) return `${c.t}: obtained marks exceed total marks.`;
    }
  }
  if (step === 2) {
    if (!d.x.kl) return 'Enter your date of joining at KL University.';
    for (const r of [...d.x.prev, ...d.x.ind]) if (!r.name || !r.from || !r.to || r.to < r.from) return 'Check experience rows: name and valid dates are required.';
  }
  if (step === 3) {
    const r = d.r || {};
    if (r.orcid && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(r.orcid)) return 'ORCID ID must look like 0000-0002-1825-0097.';
    if (!PUBS.every((k) => /^\d{1,5}$/.test(String(r[k] ?? '')))) return 'Enter the number of publications in each category (0 if none).';
  }
  if (step === 4 && !photo) return 'Please upload a photo.';
  return '';
}

function Inputs({ fields, val, onChange }) {
  const set = (k) => (e) => onChange({ ...val, [k]: e.target.value });
  return (
    <div className="grid">
      {fields.map(([k, l, ty, o]) => (
        <Field key={k} label={l}>
          {ty === 'select' ? <select value={val[k] || ''} onChange={set(k)}><option value="">Select</option>{o.map((x) => <option key={x}>{x}</option>)}</select>
            : ty === 'area' ? <textarea rows="3" value={val[k] || ''} onChange={set(k)} />
              : <input type={ty || 'text'} value={val[k] || ''} onChange={set(k)} />}
        </Field>
      ))}
    </div>
  );
}

function Rows({ rows, onChange, label, add }) {
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <>
      {rows.map((r, i) => (
        <div className="row" key={i}>
          <div className="grid">
            <Field label={label}><input value={r.name} onChange={(e) => set(i, 'name', e.target.value)} /></Field>
            <Field label="Joining date"><input type="date" value={r.from} onChange={(e) => set(i, 'from', e.target.value)} /></Field>
            <Field label="Relieving date"><input type="date" min={r.from} value={r.to} onChange={(e) => set(i, 'to', e.target.value)} /></Field>
          </div>
          <button type="button" className="link err" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => onChange([...rows, { name: '', from: '', to: '' }])}>{add}</button>
    </>
  );
}

function profileSections(d) {
  const { p, e, x } = d;
  const kl = days(x.kl, today()), tot = kl + sum(x.prev) + sum(x.ind);
  const kv = (title, rows) => ({ title, head: ['Field', 'Value'], rows });
  return [
    kv('Personal details', fieldsP(p).map(([k, l]) => [l, p[k] || ''])),
    ...Object.entries(EDU).filter(([k]) => e[k]).map(([k, c]) =>
      kv(c.t, [...ef(k, e[k]).map(([f, l]) => [l, e[k][f] || '']), ...(c.m ? [['Percentage', pct(e[k].obtained, e[k].total)]] : [])])),
    kv('Research', [...RES.map(([k, l]) => [l, (d.r || {})[k] ?? '']), ['Publications (Journals + Conferences)', jc(d.r)]]),
    kv('Experience', [['Joined KL University', x.kl], ['Experience at KL University', fmt(kl)],
      ...x.prev.map((r) => [`Previous: ${r.name}`, `${r.from} to ${r.to} (${fmt(days(r.from, r.to))})`]),
      ...x.ind.map((r) => [`Industry: ${r.name}`, `${r.from} to ${r.to} (${fmt(days(r.from, r.to))})`]),
      ['Total experience', fmt(tot)]]),
  ];
}

function Review({ d, photo }) {
  const { p, e, x } = d;
  const r = d.r || {};
  const kl = days(x.kl, today()), tot = kl + sum(x.prev) + sum(x.ind);
  return (
    <>
      <section className="rev"><h3>Personal details</h3><img className="photo" src={photo} alt="Employee" />
        <dl className="grid">{fieldsP(p).map(([k, l]) => <div key={k}><dt>{l}</dt><dd>{p[k]}</dd></div>)}</dl></section>
      <section className="rev"><h3>Education</h3>
        {Object.entries(EDU).filter(([k]) => e[k]).map(([k, c]) => (
          <div key={k}><h4>{c.t}</h4><dl className="grid">{ef(k, e[k]).map(([f, l]) => <div key={f}><dt>{l}</dt><dd>{e[k][f]}</dd></div>)}
            {c.m && <div><dt>Percentage</dt><dd>{pct(e[k].obtained, e[k].total)}</dd></div>}</dl></div>
        ))}</section>
      <section className="rev"><h3>Experience</h3>
        <p>KL University since {x.kl}: <b>{fmt(kl)}</b></p>
        {x.prev.map((r, i) => <p key={i}>Previous: {r.name} ({r.from} to {r.to}) – {fmt(days(r.from, r.to))}</p>)}
        {x.ind.map((r, i) => <p key={i}>Industry: {r.name} ({r.from} to {r.to}) – {fmt(days(r.from, r.to))}</p>)}
        <p className="total">Total experience: <b>{fmt(tot)}</b></p></section>
      <section className="rev"><h3>Research</h3>
        <dl className="grid">{RES.map(([k, l]) => <div key={k}><dt>{l}</dt><dd>{r[k] || '-'}</dd></div>)}</dl>
        <p className="total">Publications (Journals + Conferences): <b>{jc(r)}</b></p></section>
    </>
  );
}

export default function Profile() {
  const { toast } = useUI();
  const { user, setUser } = useAuth();
  const [saved, setSaved] = useState(undefined);
  const [edit, setEdit] = useState(false);
  const [step, setStep] = useState(0);
  const [d, setD] = useState(blank());
  const [photo, setPhoto] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/employee/profile').then((r) => {
      setSaved(r.data);
      if (r.data) { setD({ ...blank(), ...r.data.data }); setPhoto(r.data.photo); } else setEdit(true);
    }).catch((e) => { setSaved(null); setEdit(true); toast(e.message, 'err'); });
  }, [toast]);

  const setE = (k, v) => setD({ ...d, e: { ...d.e, [k]: v } });
  const setP = (p) => setD({ ...d, p: p.country !== d.p.country ? { ...p, state: '', otherCountry: '' } : p });
  const setX = (k, v) => setD({ ...d, x: { ...d.x, [k]: v } });
  const next = () => { const m = check(step, d, photo); setErr(m); if (!m) setStep(step + 1); };
  const pickPhoto = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!['image/jpeg', 'image/png'].includes(f.type)) return setErr('Photo must be a JPG or PNG image.');
    if (f.size >= 1024 * 1024) return setErr('Photo must be smaller than 1 MB.');
    setErr(''); const r = new FileReader(); r.onload = () => setPhoto(r.result); r.readAsDataURL(f);
  };
  const submit = async () => {
    setBusy(true);
    try {
      const dd = { ...d, p: { ...d.p, pan: d.p.pan.toUpperCase() } };
      const r = await api('/employee/profile', { method: 'PUT', body: { data: dd, photo } });
      toast(r.message); setD(dd); setSaved({ data: dd, photo }); setEdit(false); setStep(0);
      api('/auth/me').then((m) => setUser(m.data)).catch(() => {});
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const dl = async (kind) => {
    const f = `profile-${user.employee_id}`, sec = profileSections(d);
    try { if (kind === 'pdf') await downloadPDF(f, `Faculty Profile - ${d.p.fullName}`, sec, photo); else downloadCSV(f, sec); } catch { toast('Could not generate the file', 'err'); }
  };

  if (saved === undefined) return <><h2>My Profile</h2><i className="skel wide" /><i className="skel wide" /></>;
  if (!edit) return (
    <>
      <div className="bar"><h2>My Profile</h2>
        <button className="btn ghost" onClick={() => dl('pdf')}>Download PDF</button>
        <button className="btn ghost" onClick={() => dl('csv')}>Download CSV</button>
        <button className="btn primary" onClick={() => setEdit(true)}>Update details</button></div>
      <Review d={d} photo={photo} />
    </>
  );

  return (
    <>
      <h2>{saved ? 'Update details' : 'Complete your details'}</h2>
      <ol className="steps" aria-label="Progress">{STEPS.map((s, i) => <li key={s} className={i === step ? 'cur' : i < step ? 'done' : ''}>{i + 1}. {s}</li>)}</ol>
      {step === 0 && (
        <fieldset><legend>Personal details</legend>
          <Inputs fields={fieldsP(d.p).filter(([k]) => k !== 'corrAddress')} val={d.p} onChange={setP} />
          <label className="chk"><input type="checkbox" onChange={(e) => e.target.checked && setD({ ...d, p: { ...d.p, corrAddress: d.p.permAddress } })} /> Correspondence address is same as permanent</label>
          <Inputs fields={P.filter(([k]) => k === 'corrAddress')} val={d.p} onChange={setP} />
        </fieldset>
      )}
      {step === 1 && Object.entries(EDU).map(([k, c]) => (
        <fieldset key={k}><legend>{c.t}</legend>
          {c.opt && <label className="chk"><input type="checkbox" checked={!!d.e[k]} onChange={(e) => setE(k, e.target.checked ? {} : null)} /> {c.opt}</label>}
          {d.e[k] && <><Inputs fields={ef(k, d.e[k])} val={d.e[k]} onChange={(v) => setE(k, v.country !== d.e[k].country ? { ...v, countryName: '' } : v)} />{c.m && <p className="pct">Percentage: <b>{pct(d.e[k].obtained, d.e[k].total)}</b></p>}</>}
        </fieldset>
      ))}
      {step === 2 && (
        <>
          <fieldset><legend>KL University</legend>
            <Field label="Date of joining KL University"><input type="date" value={d.x.kl} onChange={(e) => setX('kl', e.target.value)} /></Field></fieldset>
          <fieldset><legend>Experience in previous colleges / universities</legend>
            <Rows rows={d.x.prev} onChange={(v) => setX('prev', v)} label="College / University name" add="+ Add previous college experience" /></fieldset>
          <fieldset><legend>Industry experience</legend>
            <Rows rows={d.x.ind} onChange={(v) => setX('ind', v)} label="Company name" add="+ Add industry experience" /></fieldset>
          <p className="total">Total experience (KL + previous + industry): <b>{fmt(days(d.x.kl, today()) + sum(d.x.prev) + sum(d.x.ind))}</b></p>
        </>
      )}
      {step === 3 && (
        <fieldset><legend>Research profile and publications</legend>
          <Inputs fields={RES} val={d.r || {}} onChange={(r) => setD({ ...d, r })} />
          <p className="pct">Publications (Journals + Conferences): <b>{jc(d.r)}</b></p></fieldset>
      )}
      {step === 4 && (
        <fieldset><legend>Upload photo (JPG/PNG, under 1 MB)</legend>
          <input type="file" accept="image/jpeg,image/png" onChange={pickPhoto} aria-label="Upload photo" />
          {photo && <p><img className="photo" src={photo} alt="Preview" /></p>}</fieldset>
      )}
      {step === 5 && <Review d={d} photo={photo} />}
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="actions">
        {step > 0 && <button className="btn ghost" onClick={() => { setErr(''); setStep(step - 1); }}>Back</button>}
        {saved && <button className="btn ghost" onClick={() => { setEdit(false); setD({ ...blank(), ...saved.data }); setPhoto(saved.photo); setStep(0); setErr(''); }}>Cancel</button>}
        {step < 5 ? <button className="btn primary" onClick={next}>Next</button>
          : <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Submit'}</button>}
      </div>
    </>
  );
}
