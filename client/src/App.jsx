import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  CalendarDays, Users, DoorOpen, BookOpen, GraduationCap,
  LayoutGrid, CalendarRange, BookmarkPlus, BarChart3, Menu, X, UserCheck, ShieldCheck, LogOut
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { AcademicTermProvider } from './context/AcademicTermContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import TermSelector    from './components/TermSelector';
import TimetablePage   from './pages/TimetablePage';
import TeachersPage    from './pages/TeachersPage';
import ScholarsPage    from './pages/ScholarsPage';
import RoomsPage       from './pages/RoomsPage';
import CoursesPage     from './pages/CoursesPage';
import ClassesPage     from './pages/ClassesPage';
import AssignmentsPage from './pages/AssignmentsPage';
import CalendarPage    from './pages/CalendarPage';
import BookingsPage    from './pages/BookingsPage';
import DashboardPage   from './pages/DashboardPage';
import LoginPage       from './pages/LoginPage';
import AdminPage       from './pages/AdminPage';

const NAV = [
  { label: 'Overview',    to: '/',            icon: BarChart3,    section: 'Main' },
  { label: 'Timetable',  to: '/timetable',   icon: LayoutGrid,   section: 'Main' },
  { label: 'Teachers',   to: '/teachers',    icon: Users,        section: 'Master Data' },
  { label: 'Scholars',   to: '/scholars',    icon: UserCheck,    section: 'Master Data' },
  { label: 'Rooms',      to: '/rooms',       icon: DoorOpen,     section: 'Master Data' },
  { label: 'Courses',    to: '/courses',     icon: BookOpen,     section: 'Master Data' },
  { label: 'Classes',    to: '/classes',     icon: GraduationCap,section: 'Master Data' },
  { label: 'Calendar',   to: '/calendar',    icon: CalendarRange,section: 'Planning' },
  { label: 'Bookings',   to: '/bookings',    icon: BookmarkPlus, section: 'Planning' },
];

const SECTIONS = ['Main', 'Master Data', 'Planning'];

function ProtectedLayout({ children }) {
  const { user, isAdmin, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  useEffect(() => {
    if (!isAdmin) {
      document.body.classList.add('viewer-mode');
    } else {
      document.body.classList.remove('viewer-mode');
    }
  }, [isAdmin]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AcademicTermProvider>
      <div className={`app-layout${sidebarOpen ? '' : ' sidebar-closed'}`}>
        <aside className="sidebar" aria-label="Main navigation">
          <div className="sidebar-logo">
            <img src="/pec-logo.png" alt="PEC Logo" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            <div>
              <h1>PEC CSE</h1>
              <span>Timetable &amp; Scheduling</span>
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>
          
          <nav className="sidebar-nav">
            {(isAdmin ? SECTIONS : ['Main']).map(section => (
              <div key={section}>
                <div className="nav-section-label">{section}</div>
                {NAV.filter(n => n.section === section && (isAdmin || n.to === '/timetable')).map(({ label, to, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  >
                    <Icon size={15} />
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}

            {isAdmin && (
              <div>
                <div className="nav-section-label">System</div>
                <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <ShieldCheck size={15} />
                  Admin Panel
                </NavLink>
              </div>
            )}
          </nav>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {user.picture ? (
                <img src={user.picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)' }}></div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {user.name}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {isAdmin ? 'Administrator' : 'Viewer (Read-only)'}
                </span>
              </div>
            </div>
            <button 
              className="signout-button"
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </aside>

        <main className="main-content">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 24px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!sidebarOpen && (
                <button
                  className="sidebar-open-button"
                  style={{ position: 'static' }}
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar"
                  title="Open sidebar"
                >
                  <Menu size={18} />
                </button>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                PEC / CSE Timetable
              </span>
            </div>

            <TermSelector />
          </div>

          <div style={{ flex: 1 }}>
            {children}
          </div>
        </main>
      </div>
    </AcademicTermProvider>
  );
}

function MainApp() {
  const { loading, isAdmin } = useAuth();
  
  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading session...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ProtectedLayout>
          <Routes>
            <Route path="/"            element={isAdmin ? <DashboardPage /> : <Navigate to="/timetable" replace />} />
            <Route path="/timetable"   element={<TimetablePage />} />
            <Route path="/teachers"    element={<TeachersPage />} />
            <Route path="/scholars"    element={<ScholarsPage />} />
            <Route path="/rooms"       element={<RoomsPage />} />
            <Route path="/courses"     element={<CoursesPage />} />
            <Route path="/classes"     element={<ClassesPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/calendar"    element={<CalendarPage />} />
            <Route path="/bookings"    element={<BookingsPage />} />
            <Route path="/admin"       element={<AdminPage />} />
          </Routes>
        </ProtectedLayout>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </BrowserRouter>
  );
}
