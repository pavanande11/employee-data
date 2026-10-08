import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useUI } from './ui.jsx';

const A = createContext();
export const useAuth = () => useContext(A);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useUI();
  useEffect(() => {
    api('/auth/me').then((r) => setUser(r.data)).catch(() => setUser(null)).finally(() => setLoading(false));
    const expired = () => { setUser(null); toast('Your session has expired. Please sign in again.', 'err'); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, [toast]);
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); };
  return <A.Provider value={{ user, loading, setUser, logout }}>{children}</A.Provider>;
}
