import { createContext, useContext, useState, useCallback } from 'react';

export const PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,64}$/;
export const PWMSG = 'Password must be 8-64 characters with uppercase, lowercase, a number and a special character.';
const Ctx = createContext();
export const useUI = () => useContext(Ctx);

export function UIProvider({ children }) {
  const [toasts, setT] = useState([]);
  const [dlg, setDlg] = useState(null);
  const toast = useCallback((message, type = 'ok') => {
    const id = Math.random();
    setT((t) => [...t, { id, message, type }]);
    setTimeout(() => setT((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const confirm = useCallback((text) => new Promise((r) => setDlg({ text, r })), []);
  const close = (v) => { dlg.r(v); setDlg(null); };
  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast ' + t.type}>{t.message}</div>)}</div>
      {dlg && (
        <div className="overlay">
          <div className="dialog" role="alertdialog" aria-modal="true">
            <p>{dlg.text}</p>
            <div className="actions">
              <button className="btn ghost" onClick={() => close(false)}>Cancel</button>
              <button className="btn danger" onClick={() => close(true)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const Field = ({ label, children }) => <label className="field"><span>{label}</span>{children}</label>;

export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className="link" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

export function useAsync() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = (fn) => async (e) => {
    e?.preventDefault(); setErr(''); setBusy(true);
    try { await fn(); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return { busy, err, run };
}
