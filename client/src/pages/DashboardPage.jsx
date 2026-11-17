import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAcademicTerm } from '../context/AcademicTermContext';
import {
  Users,
  DoorOpen,
  BookOpen,
  GraduationCap,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Clock,
  Layers,
  Filter,
  BarChart3,
  Calendar
} from 'lucide-react';

export default function DashboardPage() {
  const { activeTerm, terms } = useAcademicTerm();
  const [stats, setStats] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [scholars, setScholars] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classSemesters, setClassSemesters] = useState([]);
  const [courseOfferings, setCourseOfferings] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Semester filter state ('all' | number)
  const [selectedSemester, setSelectedSemester] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getStats(activeTerm),
      api.getTeachers(),
      api.getScholars(),
      api.getRooms(),
      api.getClasses(),
      api.getClassSemesters(activeTerm).catch(() => []),
      api.getCourseOfferings({ academic_term: activeTerm }).catch(() => []),
      api.getTimetable({ academic_term: activeTerm }),
    ])
      .then(([s, t, sch, r, cl, cs, co, tt]) => {
        setStats(s);
        setTeachers(t);
        setScholars(sch);
        setRooms(r);
        setClasses(cl);
        setClassSemesters(cs || []);
        setCourseOfferings(co || []);
        setEntries(tt);
      })
      .finally(() => setLoading(false));
  }, [activeTerm]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" /> Loading dashboard &amp; semester overview...
      </div>
    );
  }

  // Attach dynamic semester number for the active term to each class
  const classSemesterMap = new Map((classSemesters || []).map(cs => [cs.class_id, cs.semester_number]));
  const enhancedClasses = classes.map(c => ({
    ...c,
    term_semester: classSemesterMap.has(c.id) ? classSemesterMap.get(c.id) : c.semester,
  }));

  // Extract all distinct semesters present in classes for this academic term
  const availableSemesters = [
    ...new Set(enhancedClasses.map(c => c.term_semester).filter(Boolean)),
  ].sort((a, b) => Number(a) - Number(b));

  // Filter classes by semester
  const filteredClasses = selectedSemester === 'all'
    ? enhancedClasses
    : enhancedClasses.filter(c => Number(c.term_semester) === Number(selectedSemester));

  const filteredClassIds = new Set(filteredClasses.map(c => c.id));

  // Filter course offerings by semester
  const filteredOfferings = selectedSemester === 'all'
    ? courseOfferings
    : courseOfferings.filter(co => filteredClassIds.has(co.class_id));

  // Filter timetable entries by semester
  const filteredEntries = selectedSemester === 'all'
    ? entries
    : entries.filter(e => filteredClassIds.has(e.class_id));

  // Metric computations
  const totalScheduledHours = filteredEntries.reduce(
    (sum, e) => sum + (e.duration_hours || 1),
    0
  );

  // Compute teacher hours for the filtered entries
  const teacherHoursMap = {};
  filteredEntries.forEach(e => {
    if (e.teacher_id) {
      teacherHoursMap[e.teacher_id] = (teacherHoursMap[e.teacher_id] || 0) + (e.duration_hours || 1);
    }
  });

  // Compute scholar hours for the filtered entries
  const scholarHoursMap = {};
  filteredEntries.forEach(e => {
    if (e.scholar_id) {
      scholarHoursMap[e.scholar_id] = (scholarHoursMap[e.scholar_id] || 0) + (e.duration_hours || 1);
    }
  });

  // Compute room bookings for the filtered entries
  const roomBookingsMap = {};
  filteredEntries.forEach(e => {
    if (e.room_id) {
      roomBookingsMap[e.room_id] = (roomBookingsMap[e.room_id] || 0) + 1;
    }
  });

  // Active faculty in this scope
  const activeTeachers = teachers.filter(t => (teacherHoursMap[t.id] || 0) > 0);
  const activeScholars = scholars.filter(s => (scholarHoursMap[s.id] || 0) > 0);
  const activeRooms = rooms.filter(r => (roomBookingsMap[r.id] || 0) > 0);

  const currentTermObj = (terms || []).find(t => t.code === activeTerm);

  return (
    <div className="fade-in">
      {/* ─── Page Header ────────────────────────────────────────────── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2>PEC CSE Academic Overview &amp; Analytics</h2>
            <span className="badge badge-indigo" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} />
              Term: {currentTermObj?.name || activeTerm}
            </span>
          </div>
          <p>
            {selectedSemester === 'all'
              ? `Punjab Engineering College (PEC) · Department of Computer Science & Engineering · Academic Term ${activeTerm}`
              : `PEC CSE Semester ${selectedSemester} Timetable Overview & Workload distribution (${activeTerm})`}
          </p>
        </div>

        {/* ─── Semester Selector Tabs / Dropdown ──────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 2,
            gap: 2,
          }}>
            <button
              type="button"
              className={`btn btn-sm ${selectedSemester === 'all' ? 'btn-primary' : ''}`}
              style={{ borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12 }}
              onClick={() => setSelectedSemester('all')}
            >
              All Semesters
            </button>
            {availableSemesters.map(sem => (
              <button
                key={sem}
                type="button"
                className={`btn btn-sm ${selectedSemester === String(sem) || selectedSemester === sem ? 'btn-primary' : ''}`}
                style={{ borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12 }}
                onClick={() => setSelectedSemester(sem)}
              >
                Sem {sem}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* ─── Semester Stats Cards ───────────────────────────────────── */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              {selectedSemester === 'all' ? 'Scheduled Hours' : `Sem ${selectedSemester} Hours`}
            </div>
            <div className="stat-value" style={{ color: 'var(--indigo-light)' }}>
              {totalScheduledHours}h
            </div>
            <div className="stat-sub">
              {filteredEntries.length} timetable sessions
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Batches / Classes</div>
            <div className="stat-value" style={{ color: 'var(--emerald)' }}>
              {filteredClasses.length}
            </div>
            <div className="stat-sub">
              {filteredOfferings.length} course offerings in {activeTerm}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Faculty &amp; Scholars</div>
            <div className="stat-value" style={{ color: 'var(--amber)' }}>
              {activeTeachers.length} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>fac</span> + {activeScholars.length} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>ta</span>
            </div>
            <div className="stat-sub">
              {selectedSemester === 'all' ? `active in ${activeTerm}` : `teaching Sem ${selectedSemester}`}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Venues Utilized</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>
              {activeRooms.length} / {rooms.length}
            </div>
            <div className="stat-sub">classrooms &amp; laboratories</div>
          </div>
        </div>

        {/* ─── Class-by-Class Progress for this Semester ───────────────── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={16} style={{ color: 'var(--indigo)' }} />
              <span>
                {selectedSemester === 'all' ? 'Class Scheduling Progress' : `Semester ${selectedSemester} Batches & Schedules`}
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'}
            </span>
          </div>

          {filteredClasses.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
              No classes defined for this semester in term {activeTerm}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {filteredClasses.map(cl => {
                const classOffers = courseOfferings.filter(co => co.class_id === cl.id);
                const classEntries = entries.filter(e => e.class_id === cl.id);
                const classHours = classEntries.reduce((s, e) => s + (e.duration_hours || 1), 0);

                return (
                  <div
                    key={cl.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{cl.name}</span>
                      <span className="badge badge-indigo" style={{ fontSize: 10 }}>
                        Sem {cl.term_semester || '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      <span>{classOffers.length} courses offered</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {classHours}h scheduled ({classEntries.length} sessions)
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {classOffers.map(crs => (
                        <span
                          key={crs.id || crs.course_id}
                          className="badge badge-subtle"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          title={crs.course_name || crs.name}
                        >
                          {crs.short_name || crs.course_short_name || crs.course_code || crs.code}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Grid: Teacher & Scholar Workloads / Room Utilization ─────── */}
        <div className="grid-2">
          {/* Teacher Workload in this scope */}
          <div className="card" style={{ maxHeight: 460, overflowY: 'auto' }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} style={{ color: 'var(--indigo)' }} />
                <span>
                  {selectedSemester === 'all' ? `Faculty Weekly Workload (${activeTerm})` : `Faculty Hours in Sem ${selectedSemester}`}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {selectedSemester === 'all' ? activeTerm : 'Semester Scope'}
              </span>
            </div>

            {teachers.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No faculty registered.</div>
            ) : (
              teachers.map(t => {
                const scheduledInScope = teacherHoursMap[t.id] || 0;
                const overallStat = stats?.teacherWorkloads?.find(w => w.id === t.id);
                const overallScheduled = overallStat?.scheduled_hours || 0;
                const maxHours = t.max_hours_week || 20;

                const displayHours = selectedSemester === 'all' ? overallScheduled : scheduledInScope;
                if (selectedSemester !== 'all' && displayHours === 0) return null;

                const pct = Math.min(100, (displayHours / maxHours) * 100);
                const color = pct > 90 ? 'var(--rose)' : pct > 70 ? 'var(--amber)' : 'var(--indigo)';

                return (
                  <div key={t.id} style={{ marginBottom: 12 }}>
                    <div className="flex justify-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {t.name}
                        {t.designation && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11, fontWeight: 400 }}>
                            {t.designation}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {displayHours} / {maxHours}h {selectedSemester !== 'all' && `(term total ${overallScheduled}h)`}
                      </span>
                    </div>
                    <div className="workload-bar">
                      <div className="workload-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })
            )}

            {selectedSemester !== 'all' && activeTeachers.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
                No faculty sessions scheduled for Semester {selectedSemester} yet.
              </div>
            )}
          </div>

          {/* Room Utilization in this scope */}
          <div className="card" style={{ maxHeight: 460, overflowY: 'auto' }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DoorOpen size={16} style={{ color: 'var(--emerald)' }} />
                <span>
                  {selectedSemester === 'all' ? `Room Utilization (${activeTerm})` : `Room Bookings in Sem ${selectedSemester}`}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {rooms.length} venues
              </span>
            </div>

            {rooms.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No rooms registered.</div>
            ) : (
              rooms.map(r => {
                const bookingsInScope = roomBookingsMap[r.id] || 0;
                const overallStat = stats?.roomUtilization?.find(w => w.id === r.id);
                const overallBooked = overallStat?.booked_slots || 0;

                const displayBooked = selectedSemester === 'all' ? overallBooked : bookingsInScope;
                if (selectedSemester !== 'all' && displayBooked === 0) return null;

                const pct = Math.min(100, (displayBooked / 40) * 100);
                const utilizationColor = `hsl(${Math.max(0, 120 - pct * 1.2)}, 72%, 45%)`;

                return (
                  <div key={r.id} style={{ marginBottom: 12 }}>
                    <div className="flex justify-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {r.name}
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11, fontWeight: 400 }}>
                          {r.type} • cap {r.capacity} {r.location ? `• ${r.location}` : ''}
                        </span>
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {displayBooked} slots {selectedSemester !== 'all' && `(term total ${overallBooked})`}
                      </span>
                    </div>
                    <div className="workload-bar">
                      <div className="workload-fill" style={{ width: `${pct}%`, background: utilizationColor }} />
                    </div>
                  </div>
                );
              })
            )}

            {selectedSemester !== 'all' && activeRooms.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
                No rooms booked for Semester {selectedSemester} yet.
              </div>
            )}
          </div>
        </div>

        {/* ─── Scholar TA Duty in this Scope ────────────────────────────── */}
        {scholars.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={16} style={{ color: 'var(--primary)' }} />
                <span>
                  {selectedSemester === 'all' ? `Research Scholar TA Duties (${activeTerm})` : `Scholar TA Duties in Sem ${selectedSemester}`}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {scholars.length} scholars
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {scholars.map(s => {
                const hours = scholarHoursMap[s.id] || 0;
                const max = s.max_hours_week || 12;
                const pct = Math.min(100, (hours / max) * 100);

                return (
                  <div
                    key={s.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>
                        {s.name}
                        {s.designation && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 10, fontWeight: 400 }}>
                            ({s.designation})
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hours}/{max}h</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {s.roll_no ? `${s.roll_no} • ` : ''}{s.department_name || 'CSE'}
                    </div>
                    <div className="workload-bar" style={{ height: 6 }}>
                      <div className="workload-fill" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Constraint Engine Status ─────────────────────────────────── */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} style={{ color: 'var(--emerald)' }} />
              Constraint Engine Status
            </div>
            <span className="badge badge-emerald">Active &amp; Enforcing ({activeTerm})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {[
              'Academic Term & Semester Scoping',
              'Teacher Conflict Prevention',
              'Scholar Collision Prevention',
              'Multi-Group Parallel Lab Supervision',
              'Room Conflict Prevention',
              'Student Group Conflict',
              'Teacher Availability',
              'Room Booking Conflict',
              'Room Capacity & Type Matching',
              'Holiday Enforcement',
              'Teacher & Scholar Workload Limit',
            ].map(rule => (
              <div key={rule} className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--emerald)', fontSize: 14 }}>✓</span> {rule}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
