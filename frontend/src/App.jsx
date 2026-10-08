import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { UIProvider } from './ui.jsx';
import { AuthProvider, useAuth } from './auth.jsx';
import { AdminLogin, EmployeeLogin, EmployeeRegister, AdminDashboard, AdminEmployees, AdminReports, FacultyLists, EmployeeDashboard, NotFound, Forbidden, ChangePassword } from './pages.jsx';
import Profile from './Profile.jsx';

const home = (u) => (u.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard');

function Guard({ role, guest, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center"><div className="spin" /></div>;
  if (guest) return user ? <Navigate to={home(user)} replace /> : children;
  if (!user) return <Navigate to={`/${role}/login`} replace />;
  return user.role === role ? children : <Navigate to="/forbidden" replace />;
}

function Shell({ role }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const links = role === 'admin' ? [['/admin/dashboard', 'Dashboard'], ['/admin/employees', 'Employees'], ['/admin/faculty-lists', 'Faculty lists'], ['/admin/reports', 'Reports'], ['/admin/password', 'Change password']]
    : [['/employee/dashboard', 'Dashboard'], ['/employee/profile', 'My Profile'], ['/employee/password', 'Change password']];
  const out = async () => { await logout(); nav(`/${role}/login`); };
  return (
    <div className="shell">
      <header>
        <button className="btn ghost menu-btn" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>☰</button>
        <div className="logo">◈ Faculty Portal</div>
        <div className="spacer" />
        <div className="profile">
          <button className="btn ghost" aria-haspopup="menu" onClick={() => setMenu(!menu)}>{user.name || user.username || user.employee_id} ▾</button>
          {menu && <div className="menu" role="menu"><small>{user.employee_id || 'Administrator'}</small><button className="link" onClick={() => { setMenu(false); nav(`/${role}/password`); }}>Change password</button><button className="link" onClick={out}>Logout</button></div>}
        </div>
      </header>
      <div className="body">
        <nav className={open ? 'side open' : 'side'}>
          {links.map(([to, l]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}>{l}</NavLink>)}
          <button className="link" onClick={out}>Logout</button>
        </nav>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/employee/login" replace />} />
            <Route path="/admin/login" element={<Guard guest><AdminLogin /></Guard>} />
            <Route path="/employee/login" element={<Guard guest><EmployeeLogin /></Guard>} />
            <Route path="/employee/register" element={<Guard guest><EmployeeRegister /></Guard>} />
            <Route path="/admin" element={<Guard role="admin"><Shell role="admin" /></Guard>}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="employees" element={<AdminEmployees />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="faculty-lists" element={<FacultyLists />} />
              <Route path="password" element={<ChangePassword />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
            <Route path="/employee" element={<Guard role="employee"><Shell role="employee" /></Guard>}>
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="password" element={<ChangePassword />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
            <Route path="/forbidden" element={<Forbidden />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </UIProvider>
  );
}
