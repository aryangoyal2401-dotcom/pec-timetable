import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAcademicTerm } from '../context/AcademicTermContext';
import { useAuth } from '../context/AuthContext';
import { X, Plus, AlertCircle, CheckCircle, GraduationCap, Users, DoorOpen, RefreshCw, UserCheck, Printer, Search } from 'lucide-react';
import { getFirstName, formatTeacherLabel, formatTeacherWithDesignation } from '../utils/nameFormat';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };

function formatTime(value) {
  if (!value) return '';
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

const COLOR_COUNT = 8;
function entryColor(id) { return `entry-color-${id % COLOR_COUNT}`; }

// ─── Helpers ────────────────────────────────────────────────────────────────

function typeBadge(type) {
  const map = {
    lecture:  { bg: '#e0e7ff', color: '#3730a3', label: 'Lecture'  },
    lab:      { bg: '#d1fae5', color: '#065f46', label: 'Lab'      },
    tutorial: { bg: '#fef3c7', color: '#92400e', label: 'Tutorial' },
  };
  const s = map[type] || { bg: '#f3f4f6', color: '#374151', label: type };
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 10,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

function statusBadge(status) {
  const map = {
    complete:    { icon: '✅', label: 'Complete',    color: '#065f46', bg: '#d1fae5' },
    partial:     { icon: '⚠️', label: 'Partial',     color: '#92400e', bg: '#fef3c7' },
    not_started: { icon: '❌', label: 'Not Started', color: '#991b1b', bg: '#fee2e2' },
  };
  const s = map[status] || { icon: '—', label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>{s.icon} {s.label}</span>
  );
}

function groupTypeBadge(type) {
  const map = {
    lecture: { bg: '#e0e7ff', color: '#3730a3', label: 'lecture group' },
    lab:     { bg: '#d1fae5', color: '#065f46', label: 'lab group' },
  };
  const s = map[type] || { bg: '#f3f4f6', color: '#374151', label: type };
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 10,
      fontSize: 10, fontWeight: 600, background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

// Mini progress bar + scheduled hours label
function ScheduleRow({ row }) {
  const pct = row.required_hours > 0
    ? Math.min(100, (row.scheduled_hours / row.required_hours) * 100)
    : 0;
  const barColor =
    row.status === 'complete' ? '#10b981' :
    row.status === 'partial'  ? '#f59e0b' : '#ef4444';

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
        {row.course_code ? (
          <>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.course_code}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>{row.course_name}</span>
            {row.course_short_name && row.course_short_name !== row.course_code && (
              <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 11 }}>({row.course_short_name})</span>
            )}
          </>
        ) : (
          row.course_name
        )}
      </td>
      <td style={{ padding: '7px 12px' }}>{typeBadge(row.component_type)}</td>
      <td style={{ padding: '7px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {row.required_hours}h
        {row.session_duration > 1 && (
          <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            ({row.session_duration}h sessions)
          </span>
        )}
      </td>
      <td style={{ padding: '7px 12px', minWidth: 110 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, width: `${pct}%`,
              background: barColor, transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {row.scheduled_hours}h
          </span>
        </div>
      </td>
      <td style={{ padding: '7px 12px', textAlign: 'center', color: row.remaining > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
        {row.remaining > 0 ? `−${row.remaining}h` : '—'}
      </td>
      <td style={{ padding: '7px 12px' }}>{statusBadge(row.status)}</td>
    </tr>
  );
}

// Collapsible section card inside the status panel
function StatusSection({ title, badgeEl, rows, defaultOpen = true, indent = 0 }) {
  const [open, setOpen] = useState(defaultOpen);
  const complete = rows.filter(r => r.status === 'complete').length;
  const total    = rows.length;

  return (
    <div style={{
      margin: indent > 0 ? '8px 0 0 0' : '0',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', cursor: 'pointer',
          background: indent > 0 ? 'var(--bg-elevated)' : 'var(--bg-subtle, var(--bg-elevated))',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
          {badgeEl}
          <span style={{
            fontSize: 11, padding: '1px 7px', borderRadius: 10,
            background: complete === total ? '#d1fae5' : '#fef3c7',
            color:      complete === total ? '#065f46' : '#92400e',
            fontWeight: 600,
          }}>
            {complete}/{total}
          </span>
        </div>
        <span style={{ fontSize: 14, color: 'var(--text-muted)', userSelect: 'none' }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                {['Course', 'Component', 'Required', 'Scheduled', 'Remaining', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '6px 12px', textAlign: 'left', fontWeight: 600,
                    whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 11,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => <ScheduleRow key={i} row={row} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TimetablePage() {
  const { isAdmin } = useAuth();
  const { activeTerm, activeTermObj } = useAcademicTerm();
  const [viewMode, setViewMode]             = useState('class'); // 'class' | 'teacher' | 'scholar' | 'room'

  const [classes, setClasses]               = useState([]);
  const [selectedClass, setSelectedClass]   = useState('');

  const [teachers, setTeachers]             = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [teacherWorkload, setTeacherWorkload] = useState(null);

  const [scholars, setScholars]             = useState([]);
  const [selectedScholar, setSelectedScholar] = useState('');

  const [rooms, setRooms]                   = useState([]);
  const [selectedRoom, setSelectedRoom]     = useState('');

  const [allCourses, setAllCourses]         = useState([]);
  const [entries, setEntries]               = useState([]);
  const [slots, setSlots]                   = useState([]);
  const [loading, setLoading]               = useState(false);

  const [modal, setModal]                   = useState(null); // { day, period, slot, editEntry? }
  const [form, setForm]                     = useState({ course_component_id: '', teacher_id: '', room_id: '', group_id: '' });
  const [roomSearch, setRoomSearch]         = useState('');
  const [assignments, setAssignments]       = useState([]);
  const [groups, setGroups]                 = useState([]);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');

  const [scheduleStatus, setScheduleStatus] = useState([]);
  const [statusOpen, setStatusOpen]         = useState(true);
  const [offerings, setOfferings]           = useState([]);

  // Initial load
  useEffect(() => {
    Promise.all([
      api.getClasses(),
      api.getTeachers(),
      api.getScholars(),
      api.getRooms(),
      api.getTimeSlots(),
      api.getCourses(),
      api.getCourseOfferings({ academic_term: activeTerm }).catch(() => []),
    ]).then(async ([cl, t, sch, r, s, coursesList, offList]) => {
      setClasses(cl);
      setTeachers(t);
      setScholars(sch);
      setRooms(r);
      setSlots(s);
      setOfferings(offList || []);

      // Load full component details for each course
      const fullCourses = await Promise.all(
        coursesList.map(c => api.getCourse(c.id).catch(() => c))
      );
      setAllCourses(fullCourses);

      const savedClassId = localStorage.getItem('timetable_selected_class');
      const allEntries = await api.getTimetable({ academic_term: activeTerm }).catch(() => []);
      const classWithEntries = cl.find(c => allEntries.some(e => e.class_id === c.id));
      const targetClass = cl.find(c => String(c.id) === String(savedClassId)) || classWithEntries || cl[0];
      if (targetClass && !selectedClass) setSelectedClass(targetClass.id.toString());
    });
  }, [activeTerm]);

  // Fetch entries whenever viewMode, selected entity, or activeTerm changes
  useEffect(() => {
    if (viewMode === 'class') {
      if (!selectedClass) { setEntries([]); return; }
      setLoading(true);
      Promise.all([
        api.getTimetable({ class_id: selectedClass, academic_term: activeTerm }),
        api.getAssignmentsByClass(selectedClass, activeTerm),
        api.getClass(selectedClass),
        api.getScheduleStatus(selectedClass, activeTerm),
        api.getCourseOfferings({ academic_term: activeTerm }).catch(() => []),
      ]).then(([tt, assgn, cls, status, offList]) => {
        setEntries(tt);
        setAssignments(assgn);
        setGroups(cls.groups || []);
        setScheduleStatus(status || []);
        if (offList) setOfferings(offList);
      }).finally(() => setLoading(false));
    } else if (viewMode === 'teacher') {
      if (!selectedTeacher) { setEntries([]); setTeacherWorkload(null); return; }
      setLoading(true);
      Promise.all([
        api.getTimetable({ teacher_id: selectedTeacher, academic_term: activeTerm }),
        api.getWorkload(selectedTeacher).catch(() => null),
      ]).then(([tt, wl]) => {
        setEntries(tt);
        setTeacherWorkload(wl);
      }).finally(() => setLoading(false));
    } else if (viewMode === 'scholar') {
      if (!selectedScholar) { setEntries([]); return; }
      setLoading(true);
      api.getTimetable({ scholar_id: selectedScholar, academic_term: activeTerm })
        .then(setEntries)
        .finally(() => setLoading(false));
    } else if (viewMode === 'room') {
      if (!selectedRoom) { setEntries([]); return; }
      setLoading(true);
      api.getTimetable({ room_id: selectedRoom, academic_term: activeTerm })
        .then(setEntries)
        .finally(() => setLoading(false));
    }
  }, [viewMode, selectedClass, selectedTeacher, selectedScholar, selectedRoom, activeTerm]);

  const refreshEntries = async () => {
    if (viewMode === 'class' && selectedClass) {
      const [tt, assgn, cls, status, offList] = await Promise.all([
        api.getTimetable({ class_id: selectedClass, academic_term: activeTerm }),
        api.getAssignmentsByClass(selectedClass, activeTerm),
        api.getClass(selectedClass),
        api.getScheduleStatus(selectedClass, activeTerm),
        api.getCourseOfferings({ academic_term: activeTerm }).catch(() => []),
      ]);
      setEntries(tt);
      setAssignments(assgn);
      setGroups(cls.groups || []);
      setScheduleStatus(status || []);
      if (offList) setOfferings(offList);
    } else if (viewMode === 'teacher' && selectedTeacher) {
      const [tt, wl] = await Promise.all([
        api.getTimetable({ teacher_id: selectedTeacher, academic_term: activeTerm }),
        api.getWorkload(selectedTeacher).catch(() => null),
      ]);
      setEntries(tt);
      setTeacherWorkload(wl);
    } else if (viewMode === 'scholar' && selectedScholar) {
      const tt = await api.getTimetable({ scholar_id: selectedScholar, academic_term: activeTerm });
      setEntries(tt);
    } else if (viewMode === 'room' && selectedRoom) {
      const tt = await api.getTimetable({ room_id: selectedRoom, academic_term: activeTerm });
      setEntries(tt);
    }
  };

  // Build period list from slots
  const periods = [...new Set(slots.map(s => s.period))].sort((a, b) => a - b);

  // slotMap: 'day-period' -> slot object
  const slotMap = {};
  slots.forEach(s => { slotMap[`${s.day}-${s.period}`] = s; });

  // entryMap: 'day-period' -> [ ...entries ] (multi-entry per slot)
  const entryMap = {};
  entries.forEach(e => {
    const key = `${e.day}-${e.period}`;
    if (!entryMap[key]) entryMap[key] = [];
    entryMap[key].push(e);
  });

  // Consumed cells for multi-hour sessions
  const consumed = new Set();
  entries.forEach(e => {
    const dur = e.duration_hours ?? 1;
    if (dur > 1) {
      for (let offset = 1; offset < dur; offset++) {
        consumed.add(`${e.day}-${e.period + offset}`);
      }
    }
  });

  // Collect all available course components across all courses
  const allComponents = [];
  allCourses.forEach(c => {
    (c.components || []).forEach(comp => {
      allComponents.push({
        id: comp.id,
        course_id: c.id,
        course_name: c.name,
        course_code: c.code,
        course_short_name: c.short_name || c.code || c.name,
        component_type: comp.type,
        hours_per_week: comp.hours_per_week,
        duration_hours: comp.duration_hours || 1,
        requires_lab: comp.requires_lab,
      });
    });
  });

  // Target class ID for modal / class view (selected class or class of entry being edited)
  const modalClassId = modal?.editEntry ? Number(modal.editEntry.class_id) : (selectedClass ? Number(selectedClass) : null);

  // Components belonging specifically to the selected batch
  const batchComponents = allComponents.filter(comp => {
    // If editing an existing entry, always keep that entry's component selectable
    if (modal?.editEntry && Number(modal.editEntry.course_component_id) === Number(comp.id)) {
      return true;
    }

    if (!modalClassId) return true;

    // 1. Matched via course_offerings for this batch in active term
    const inOfferings = offerings.some(o =>
      Number(o.class_id) === modalClassId &&
      (Number(o.course_id) === Number(comp.course_id) || Number(o.id) === Number(comp.course_id))
    );
    if (inOfferings) return true;

    // 2. Matched via legacy direct course.class_id link
    const parentCourse = allCourses.find(c => Number(c.id) === Number(comp.course_id));
    if (parentCourse && Number(parentCourse.class_id) === modalClassId) {
      return true;
    }

    // 3. Matched via teacher_assignments for this batch & term
    const inAssignments = assignments.some(a =>
      Number(a.class_id) === modalClassId &&
      Number(a.course_component_id) === Number(comp.id)
    );
    if (inAssignments) return true;

    // 4. Matched via scheduleStatus
    const inStatus = scheduleStatus.some(s =>
      Number(s.course_component_id) === Number(comp.id)
    );
    if (inStatus) return true;

    return false;
  });

  // Modal handlers
  function openAdd(day, period) {
    if (!isAdmin) return;
    if (viewMode !== 'class') return;
    const slot = slotMap[`${day}-${period}`];
    setModal({ day, period, slot, editEntry: null });
    setForm({ course_component_id: '', teacher_id: '', room_id: '', group_id: '' });
    setRoomSearch('');
    setError(''); setSuccess('');
  }

  function openEdit(entry) {
    if (!isAdmin) return;
    const slot = slotMap[`${entry.day}-${entry.period}`];
    setModal({ day: entry.day, period: entry.period, slot, editEntry: entry });
    setForm({
      course_component_id: entry.course_component_id.toString(),
      teacher_id: entry.teacher_id.toString(),
      room_id: entry.room_id.toString(),
      group_id: entry.group_id ? entry.group_id.toString() : '',
    });
    setRoomSearch('');
    setError(''); setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.course_component_id || !form.room_id) {
      setError('Please select course component and room.');
      return;
    }

    const selectedComp = allComponents.find(c => c.id === parseInt(form.course_component_id));
    const isLab = selectedComp?.component_type === 'lab' || selectedComp?.component_type === 'tutorial';
    const lectureGroups = groups.filter(g => g.group_type === 'lecture');
    const labGroups = groups.filter(g => g.group_type === 'lab');

    if (isLab && labGroups.length > 0 && !form.group_id) {
      setError('Please select a lab group.');
      return;
    }
    if (!isLab && lectureGroups.length > 0 && !form.group_id) {
      setError('Please select a lecture group.');
      return;
    }

    setSubmitting(true); setError('');
    try {
      const slot = slotMap[`${modal.day}-${modal.period}`];
      const selectedComp = allComponents.find(c => c.id === parseInt(form.course_component_id));
      const duration_hours = selectedComp?.duration_hours ?? 1;

      const targetClassId = modal.editEntry ? modal.editEntry.class_id : parseInt(selectedClass);

      const payload = {
        academic_term:        activeTerm,
        class_id:             targetClassId,
        course_component_id:  parseInt(form.course_component_id),
        teacher_id:           form.teacher_id ? parseInt(form.teacher_id) : null,
        scholar_id:           modal.editEntry?.scholar_id || assignedFaculty?.scholar_id || null,
        room_id:              parseInt(form.room_id),
        time_slot_id:         slot.id,
        group_id:             form.group_id ? parseInt(form.group_id) : null,
        duration_hours,
      };
      if (modal.editEntry) {
        await api.updateEntry(modal.editEntry.id, payload);
      } else {
        await api.createEntry(payload);
      }
      setSuccess('Saved successfully!');
      await refreshEntries();
      setTimeout(() => { setModal(null); setSuccess(''); }, 600);
    } catch (err) {
      setError(err.message || err.error || 'Constraint violation — check conflicts.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entryId, e) {
    e.stopPropagation();
    if (!confirm('Remove this timetable entry?')) return;
    await api.deleteEntry(entryId);
    setEntries(prev => prev.filter(en => en.id !== entryId));
    await refreshEntries();
  }

  // Selected component in modal
  const selectedComp = form.course_component_id
    ? allComponents.find(c => c.id === parseInt(form.course_component_id))
    : null;
  const isLabComponent = selectedComp?.component_type === 'lab' || selectedComp?.component_type === 'tutorial';
  const componentDuration = selectedComp?.duration_hours ?? 1;

  // Teacher options
  const assignedTeachers = assignments
    .filter(a => a.course_component_id === parseInt(form.course_component_id))
    .map(a => a.teacher_id);

  const assignedFaculty = assignments.find(a =>
    Number(a.class_id) === Number(selectedClass) &&
    Number(a.course_component_id) === Number(form.course_component_id) &&
    (form.group_id ? Number(a.group_id) === Number(form.group_id) : a.group_id == null)
  );
  const teacherLocked = Boolean(assignedFaculty?.teacher_id);

  const occupiedGroupIds = new Set(
    modal
      ? entries
        .filter(entry => entry.id !== modal.editEntry?.id && entry.group_id)
        .filter(entry => entry.day === modal.day && entry.period <= modal.period &&
          entry.period + (entry.duration_hours || 1) - 1 >= modal.period)
        .map(entry => Number(entry.group_id))
      : []
  );

  const activeDays = DAYS.filter(d => slots.some(s => s.day === d));

  const currentTeacher = teachers.find(t => t.id === parseInt(selectedTeacher));
  const currentScholar = scholars.find(s => s.id === parseInt(selectedScholar));
  const currentRoom    = rooms.find(r => r.id === parseInt(selectedRoom));

  // Schedule Status grouping
  const wholeClassRows = scheduleStatus.filter(r => !r.group_type);
  const lectureRows    = scheduleStatus.filter(r => r.group_type === 'lecture');
  const labRows        = scheduleStatus.filter(r => r.group_type === 'lab');
  const lectureGroupIds = [...new Set(lectureRows.map(r => r.group_name))];
  const statusTotal    = scheduleStatus.length;
  const statusComplete = scheduleStatus.filter(r => r.status === 'complete').length;

  return (
    <div className="fade-in">
      {/* ─── Page Header & View Switcher ──────────────────────────────── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Timetable</h2>
          <p>
            {viewMode === 'class' && 'Class schedule · Click cell to add entries · Multiple groups per slot'}
            {viewMode === 'teacher' && 'Teacher timetable · Faculty weekly teaching schedule and workload'}
            {viewMode === 'scholar' && 'Scholar timetable · Research Scholars / TAs weekly lab and tutorial duty'}
            {viewMode === 'room' && 'Room timetable · Venue utilization and room allocations'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 9999 }}>
          {/* View Mode Switcher */}
          <div style={{
            display: 'flex', background: 'var(--bg-elevated)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 2,
            position: 'relative', zIndex: 9999
          }}>
            <button
              className={`btn btn-sm ${viewMode === 'class' ? 'btn-primary' : ''}`}
              style={{ borderRadius: 'var(--radius-sm)', padding: '5px 12px' }}
              onClick={() => setViewMode('class')}
            >
              <GraduationCap size={13} /> Class
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'teacher' ? 'btn-primary' : ''}`}
              style={{ borderRadius: 'var(--radius-sm)', padding: '5px 12px' }}
              onClick={() => {
                setViewMode('teacher');
                if (teachers.length > 0 && !selectedTeacher) setSelectedTeacher(teachers[0].id.toString());
              }}
            >
              <Users size={13} /> Teacher
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'scholar' ? 'btn-primary' : ''}`}
              style={{ borderRadius: 'var(--radius-sm)', padding: '5px 12px' }}
              onClick={() => {
                setViewMode('scholar');
                if (scholars.length > 0 && !selectedScholar) setSelectedScholar(scholars[0].id.toString());
              }}
            >
              <UserCheck size={13} /> Scholar
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'room' ? 'btn-primary' : ''}`}
              style={{ borderRadius: 'var(--radius-sm)', padding: '5px 12px' }}
              onClick={() => {
                setViewMode('room');
                if (rooms.length > 0 && !selectedRoom) setSelectedRoom(rooms[0].id.toString());
              }}
            >
              <DoorOpen size={13} /> Room
            </button>
          </div>

          {/* Dynamic Dropdown Filter */}
          {viewMode === 'class' && (
            <select
              className="form-select"
              style={{ width: 190 }}
              value={selectedClass}
              onChange={e => {
                setSelectedClass(e.target.value);
                localStorage.setItem('timetable_selected_class', e.target.value);
              }}
            >
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {viewMode === 'teacher' && (
            <select
              className="form-select"
              style={{ width: 220 }}
              value={selectedTeacher}
              onChange={e => setSelectedTeacher(e.target.value)}
            >
              <option value="">Select Teacher</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{formatTeacherLabel(t)}</option>)}
            </select>
          )}

          {viewMode === 'scholar' && (
            <select
              className="form-select"
              style={{ width: 220 }}
              value={selectedScholar}
              onChange={e => setSelectedScholar(e.target.value)}
            >
              <option value="">Select Scholar</option>
              {scholars.map(s => <option key={s.id} value={s.id}>{s.name} {s.designation ? `(${s.designation})` : (s.roll_no ? `(${s.roll_no})` : '')}</option>)}
            </select>
          )}

          {viewMode === 'room' && (
            <select
              className="form-select"
              style={{ width: 210 }}
              value={selectedRoom}
              onChange={e => setSelectedRoom(e.target.value)}
            >
              <option value="">Select Room</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type} · cap {r.capacity})</option>)}
            </select>
          )}

          <button
            className="btn btn-sm btn-secondary btn-icon"
            onClick={refreshEntries}
            title="Refresh timetable, groups, and assignments"
            aria-label="Refresh timetable"
          >
            <RefreshCw size={14} />
          </button>

          {isAdmin && viewMode === 'class' && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => openAdd('Mon', 1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} /> Add Entry
            </button>
          )}

          <button
            className="btn btn-sm btn-secondary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Export timetable as PDF"
          >
            <Printer size={14} /> PDF
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* ─── Teacher Info Banner (Teacher View) ────────────────────────── */}
        {viewMode === 'teacher' && currentTeacher && (
          <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 8, background: 'rgba(99,102,241,0.15)',
                  color: 'var(--indigo-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                }}>
                  {currentTeacher.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{currentTeacher.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currentTeacher.designation || 'Faculty'} • CSE Department</div>
                </div>
              </div>

              {teacherWorkload && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>Weekly Workload</div>
                    <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                      {teacherWorkload.scheduled_hours} / {teacherWorkload.max_hours} hours
                    </div>
                  </div>
                  <div style={{ width: 100, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${Math.min(100, (teacherWorkload.scheduled_hours / teacherWorkload.max_hours) * 100)}%`,
                      background: teacherWorkload.scheduled_hours > teacherWorkload.max_hours ? 'var(--rose)' : 'var(--indigo)',
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Scholar Info Banner (Scholar View) ────────────────────────── */}
        {viewMode === 'scholar' && currentScholar && (
          <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 8, background: 'rgba(99,102,241,0.15)',
                  color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                }}>
                  {currentScholar.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {currentScholar.name}
                    {currentScholar.designation && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11, fontWeight: 400 }}>
                        {currentScholar.designation}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {currentScholar.roll_no ? `${currentScholar.roll_no} • ` : ''}
                    {currentScholar.department_name || currentScholar.designation || 'Research Scholar / TA'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>Weekly TA Duty</div>
                  <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                    {entries.reduce((s, e) => s + (e.duration_hours || 1), 0)} / {currentScholar.max_hours_week || 12} hours
                  </div>
                </div>
                <div style={{ width: 100, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${Math.min(100, ((entries.reduce((s, e) => s + (e.duration_hours || 1), 0)) / (currentScholar.max_hours_week || 12)) * 100)}%`,
                    background: (entries.reduce((s, e) => s + (e.duration_hours || 1), 0)) > (currentScholar.max_hours_week || 12) ? 'var(--rose)' : 'var(--primary)',
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Room Info Banner (Room View) ─────────────────────────────── */}
        {viewMode === 'room' && currentRoom && (
          <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 8, background: 'rgba(16,185,129,0.15)',
                  color: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                }}>
                  🚪
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{currentRoom.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Type: <span style={{ textTransform: 'capitalize' }}>{currentRoom.type}</span> • Capacity: {currentRoom.capacity} seats {currentRoom.location ? `• ${currentRoom.location}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-emerald">{entries.length} scheduled sessions</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Empty state when no entity is selected ───────────────────── */}
        {((viewMode === 'class' && !selectedClass) ||
          (viewMode === 'teacher' && !selectedTeacher) ||
          (viewMode === 'scholar' && !selectedScholar) ||
          (viewMode === 'room' && !selectedRoom)) ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {viewMode === 'class' ? '🎓' : viewMode === 'teacher' ? '👩‍🏫' : viewMode === 'scholar' ? '🧑‍🔬' : '🚪'}
            </div>
            <h3>Select a {viewMode} to view timetable</h3>
            <p>Choose from the dropdown above to view weekly schedules</p>
          </div>
        ) : loading ? (
          <div className="loading"><div className="spinner" /> Loading timetable...</div>
        ) : (
          /* ─── Timetable Grid ────────────────────────────────────────── */
          <div className="card timetable-grid-card" style={{ padding: 0 }}>
            <div className="timetable-horizontal-scroll">
              <table className="timetable-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 60, width: 60, textAlign: 'center' }}>Day</th>
                    {periods.map(period => {
                      const slot = slots.find(item => item.period === period);
                      return (
                        <th key={period} style={{ minWidth: 105, maxWidth: 135 }}>
                          <div>P{period}</div>
                          <div style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--text-muted)' }}>
                            {formatTime(slot?.start_time)}–{formatTime(slot?.end_time)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map(day => {
                    return (
                      <tr key={day}>
                        {/* Day Name Sticky Column */}
                        <td className="tt-day-cell">
                          <div className="tt-period-label">
                            <span className="period-time">{day}</span>
                          </div>
                        </td>

                        {/* Every single Period column is always rendered */}
                        {periods.map(period => {
                          const cellKey = `${day}-${period}`;
                          const slot = slotMap[cellKey];
                          const startingEntries = entryMap[cellKey] || [];
                          const continuingEntries = entries.filter(
                            e => e.day === day && e.period < period && (e.period + (e.duration_hours || 1) - 1) >= period
                          );

                          if (!slot) {
                            return (
                              <td
                                key={period}
                                style={{ background: 'var(--bg-elevated)', opacity: 0.4 }}
                              />
                            );
                          }

                          const isEmpty = startingEntries.length === 0 && continuingEntries.length === 0;

                          return (
                            <td
                              key={period}
                              className={`tt-table-td ${isEmpty ? 'tt-empty-td' : ''}`}
                              onClick={() => {
                                if (viewMode === 'class' && isEmpty) {
                                  openAdd(day, period);
                                }
                              }}
                            >
                              <div className="tt-slot-entries">
                                {/* Sessions starting in this period */}
                                {startingEntries.map(entry => {
                                  const dur = entry.duration_hours || 1;
                                  return (
                                    <div
                                      key={entry.id}
                                      className={`tt-entry ${entryColor(entry.course_component_id)}`}
                                      onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                                      title={`${entry.course_code ? `[${entry.course_code}] ` : ''}${entry.course_name}${entry.course_short_name && entry.course_short_name !== entry.course_code ? ` (${entry.course_short_name})` : ''} · ${entry.component_type.toUpperCase()}${entry.group_name ? ` · ${entry.group_name}` : ''} · ${entry.teacher_name ? `Faculty: ${formatTeacherWithDesignation(entry.teacher_name, entry.designation)}` : 'Unassigned'}${entry.scholar_name ? ` · TA: ${entry.scholar_name}${entry.scholar_designation ? ` (${entry.scholar_designation})` : ''}` : ''} · ${entry.room_name}${dur > 1 ? ` · ${dur}h session (P${period}–P${period + dur - 1})` : ''}`}
                                    >
                                      {isAdmin && viewMode === 'class' && (
                                        <button
                                          className="delete-btn"
                                          onClick={ev => handleDelete(entry.id, ev)}
                                          title="Delete entry"
                                        >×</button>
                                      )}

                                      {/* Primary Line: Course Code, Shortform & Group */}
                                      <div className="tt-entry-primary">
                                        <span style={{ fontWeight: 700 }}>
                                          {entry.course_code ? (
                                            <>
                                              <span>{entry.course_code}</span>
                                              {entry.course_short_name && entry.course_short_name !== entry.course_code && (
                                                <span style={{ opacity: 0.85, fontWeight: 600, marginLeft: 3 }}>
                                                  ({entry.course_short_name})
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            entry.course_short_name || entry.course_name
                                          )}
                                        </span>
                                        {entry.group_name && (
                                          <span className="tt-group-pill">
                                            {entry.group_name}
                                          </span>
                                        )}
                                        {dur > 1 && (
                                          <span style={{
                                            fontSize: 9, padding: '0 3px', borderRadius: 3,
                                            background: 'rgba(0,0,0,0.3)', fontWeight: 600,
                                            marginLeft: 'auto', whiteSpace: 'nowrap',
                                          }}>
                                            {dur}h (P{period}–P{period + dur - 1})
                                          </span>
                                        )}
                                      </div>

                                      {/* Secondary Line: Teacher / Scholar & Room */}
                                      <div className="tt-entry-secondary">
                                        {viewMode === 'class' && (
                                          <>
                                            <span title={entry.teacher_name ? formatTeacherWithDesignation(entry.teacher_name, entry.designation) : (entry.scholar_name ? `TA: ${entry.scholar_name}` : '')}>
                                              {entry.teacher_name
                                                ? getFirstName(entry.teacher_name)
                                                : (entry.scholar_name ? `TA ${getFirstName(entry.scholar_name)}` : 'No Faculty')}
                                              {entry.scholar_name && entry.teacher_name ? ` + TA` : ''}
                                            </span>
                                            <span style={{ opacity: 0.6, margin: '0 3px' }}>•</span>
                                            <span>{entry.room_name || 'No Room'}</span>
                                          </>
                                        )}
                                        {viewMode === 'teacher' && (
                                          <>
                                            <span>{entry.class_name} {entry.group_name ? `(${entry.group_name})` : ''}</span>
                                            <span style={{ opacity: 0.6, margin: '0 3px' }}>•</span>
                                            <span>{entry.room_name}</span>
                                          </>
                                        )}
                                        {viewMode === 'scholar' && (
                                          <>
                                            <span>{entry.class_name} {entry.group_name ? `(${entry.group_name})` : ''}</span>
                                            <span style={{ opacity: 0.6, margin: '0 3px' }}>•</span>
                                            <span>{entry.room_name}</span>
                                          </>
                                        )}
                                        {viewMode === 'room' && (
                                          <>
                                            <span>{entry.class_name} {entry.group_name ? `(${entry.group_name})` : ''}</span>
                                            <span style={{ opacity: 0.6, margin: '0 3px' }}>•</span>
                                            <span title={entry.teacher_name ? formatTeacherWithDesignation(entry.teacher_name, entry.designation) : (entry.scholar_name ? `TA: ${entry.scholar_name}` : '')}>
                                              {entry.teacher_name
                                                ? getFirstName(entry.teacher_name)
                                                : (entry.scholar_name ? `TA ${getFirstName(entry.scholar_name)}` : '')}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Sessions continuing from an earlier period (stacked neatly below starting entries) */}
                                {continuingEntries.map(entry => {
                                  const dur = entry.duration_hours || 1;
                                  return (
                                    <div
                                      key={`cont-${entry.id}`}
                                      className={`tt-entry tt-entry-continuation ${entryColor(entry.course_component_id)}`}
                                      onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                                      title={`Continuing from P${entry.period} (${formatTime(entry.start_time)}): ${entry.course_code ? `[${entry.course_code}] ` : ''}${entry.course_name}${entry.course_short_name && entry.course_short_name !== entry.course_code ? ` (${entry.course_short_name})` : ''} ${entry.group_name ? `(${entry.group_name})` : ''}`}
                                    >
                                      <div className="tt-entry-primary" style={{ fontSize: 9.5, opacity: 0.9 }}>
                                        <span style={{ fontWeight: 700 }}>
                                          ↳ {entry.course_code ? (
                                            <>
                                              <span>{entry.course_code}</span>
                                              {entry.course_short_name && entry.course_short_name !== entry.course_code && (
                                                <span style={{ opacity: 0.85, fontWeight: 600, marginLeft: 3 }}>
                                                  ({entry.course_short_name})
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            entry.course_short_name || entry.course_name
                                          )}
                                        </span>
                                        {entry.group_name && (
                                          <span style={{ fontSize: 9, opacity: 0.85 }}>({entry.group_name})</span>
                                        )}
                                        <span style={{ fontSize: 8.5, opacity: 0.65, marginLeft: 'auto' }}>
                                          cont. (P{entry.period}–P{entry.period + dur - 1})
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Add Button */}
                              {isAdmin && viewMode === 'class' && (
                                <div
                                  className="tt-cell-add"
                                  onClick={(e) => { e.stopPropagation(); openAdd(day, period); }}
                                  title={`Add entry to ${day} P${period}`}
                                >
                                  <Plus size={11} />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── Schedule Status Panel (Class View Only) ──────────────────────── */}
      {isAdmin && viewMode === 'class' && selectedClass && !loading && scheduleStatus.length > 0 && (
        <div style={{ marginTop: 24, padding: '0 0 24px' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px', cursor: 'pointer',
                borderBottom: statusOpen ? '1px solid var(--border)' : 'none',
                background: 'var(--bg-elevated)',
              }}
              onClick={() => setStatusOpen(o => !o)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>📋</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Schedule Status</span>
                <span style={{
                  padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: statusComplete === statusTotal ? '#d1fae5' : '#fef3c7',
                  color:      statusComplete === statusTotal ? '#065f46' : '#92400e',
                }}>
                  {statusComplete} of {statusTotal} fully scheduled
                </span>
              </div>
              <span style={{ fontSize: 18, color: 'var(--text-muted)', userSelect: 'none' }}>
                {statusOpen ? '▲' : '▼'}
              </span>
            </div>

            {statusOpen && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 1) Whole-class rows */}
                {wholeClassRows.length > 0 && (
                  <StatusSection
                    title="Whole Class"
                    badgeEl={null}
                    rows={wholeClassRows}
                    defaultOpen={true}
                    indent={0}
                  />
                )}

                {/* 2) Lecture & Lab Groups */}
                {lectureGroupIds.map(lgName => {
                  const lgRows = lectureRows.filter(r => r.group_name === lgName);

                  return (
                    <div key={lgName}>
                      <StatusSection
                        title={lgName}
                        badgeEl={groupTypeBadge('lecture')}
                        rows={lgRows}
                        defaultOpen={true}
                        indent={0}
                      />
                    </div>
                  );
                })}

                {/* 3) Lab groups are independent from lecture groups. */}
                {(() => {
                  const labGroupNames = [...new Set(labRows.map(r => r.group_name))]
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                  return labGroupNames.map(sgName => (
                    <StatusSection
                      key={sgName}
                      title={sgName}
                      badgeEl={groupTypeBadge('lab')}
                      rows={labRows.filter(r => r.group_name === sgName)}
                      defaultOpen={true}
                      indent={0}
                    />
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Add / Edit Modal ───────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 500, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  {modal.editEntry ? (
                    <>
                      Edit Entry: {modal.editEntry.course_code ? `[${modal.editEntry.course_code}] ` : ''}{modal.editEntry.course_name}
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 6 }}>
                        ({modal.editEntry.component_type.toUpperCase()})
                      </span>
                    </>
                  ) : (
                    <>Add Entry — {DAY_LABELS[modal.day]}, P{modal.period}</>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {DAY_LABELS[modal.day]}, {formatTime(modal.slot?.start_time)}–{formatTime(modal.slot?.end_time)}
                </div>
              </div>
              <button className="btn btn-icon btn-secondary" onClick={() => setModal(null)}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <div><strong>Constraint Violation</strong><div style={{ marginTop: 4 }}>{error}</div></div>
                  </div>
                )}
                {success && (
                  <div className="alert alert-success"><CheckCircle size={16} />{success}</div>
                )}

                {/* Course Component */}
                <div className="form-group">
                  <label className="form-label">
                    Course Component
                    {modalClassId && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                        (Assigned to {classes.find(c => c.id === modalClassId)?.name || 'this batch'})
                      </span>
                    )}
                  </label>
                  <select
                    className="form-select"
                    value={form.course_component_id}
                    onChange={e => {
                      const newCompId = e.target.value;
                      // Find if an assignment exists for this component
                      const defaultAssgn = assignments.find(a => a.course_component_id === parseInt(newCompId));
                      setForm(f => ({
                        ...f,
                        course_component_id: newCompId,
                        teacher_id: defaultAssgn ? defaultAssgn.teacher_id.toString() : (teachers[0]?.id?.toString() || ''),
                        group_id: '',
                      }));
                      setError('');
                    }}
                    required
                  >
                    <option value="">
                      {batchComponents.length === 0
                        ? '— No courses assigned to this batch —'
                        : 'Select course & component'}
                    </option>
                    {batchComponents.map(comp => (
                      <option key={comp.id} value={comp.id}>
                        {comp.course_code ? `[${comp.course_code}] ` : (comp.course_short_name ? `[${comp.course_short_name}] ` : '')}
                        {comp.course_name}
                        {comp.course_short_name && comp.course_short_name !== comp.course_code ? ` (${comp.course_short_name})` : ''}
                        {' — '}
                        {comp.component_type.toUpperCase()} ({comp.hours_per_week}h/wk)
                      </option>
                    ))}
                  </select>
                  {batchComponents.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 5 }}>
                      ⚠️ No courses assigned to this batch for {activeTerm}. Assign courses to this batch in <strong>Courses &gt; Batch Offerings</strong>.
                    </div>
                  )}
                </div>

                {/* Duration & Requirement info */}
                {selectedComp && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 6, marginBottom: 14,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      {selectedComp.course_code && (
                        <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: 6 }}>
                          [{selectedComp.course_code}]
                        </span>
                      )}
                      <span>{selectedComp.course_name}</span>
                      {selectedComp.course_short_name && selectedComp.course_short_name !== selectedComp.course_code && (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({selectedComp.course_short_name})</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>
                        Duration: <strong style={{ color: componentDuration > 1 ? 'var(--primary, #6366f1)' : 'inherit' }}>
                          {componentDuration} hour{componentDuration > 1 ? 's' : ''} session
                        </strong>
                      </span>
                      {selectedComp.requires_lab ? (
                        <span className="badge badge-amber">🧪 Lab room required</span>
                      ) : (
                        <span className="badge badge-indigo">📖 Classroom</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Student Group */}
                {(() => {
                  const lectureGroups = groups.filter(g => g.group_type === 'lecture');
                  const labGroups     = groups.filter(g => g.group_type === 'lab');
                  const requiresLectureGroup = !isLabComponent && lectureGroups.length > 0;
                  const requiresLabGroup = isLabComponent && labGroups.length > 0;
                  const groupOptions  = (isLabComponent ? labGroups : (lectureGroups.length > 0 ? lectureGroups : []))
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

                  return (
                    <div className="form-group">
                      <label className="form-label">
                        Student Group
                        {selectedComp && (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
                            {isLabComponent
                              ? (labGroups.length > 0 ? '(select lab group)' : '(whole class — no lab groups defined)')
                              : (lectureGroups.length > 0 ? '(select lecture group)' : '(whole class — no lecture groups defined)')}
                          </span>
                        )}
                      </label>
                      <select
                        className="form-select"
                        value={form.group_id}
                        onChange={e => {
                          const newGid = e.target.value;
                          // If a specific assignment exists for this group, auto-select teacher
                          const grpAssgn = assignments.find(
                            a => a.course_component_id === parseInt(form.course_component_id) && (newGid ? a.group_id === parseInt(newGid) : a.group_id == null)
                          );
                          setForm(f => ({
                            ...f,
                            group_id: newGid,
                            teacher_id: grpAssgn ? grpAssgn.teacher_id.toString() : f.teacher_id,
                          }));
                          setError('');
                        }}
                        required={requiresLectureGroup || requiresLabGroup}
                      >
                        {isLabComponent ? (
                          labGroups.length > 0 ? (
                            <option value="">Select a lab group</option>
                          ) : (
                            <option value="">Whole class (no split)</option>
                          )
                        ) : (
                          lectureGroups.length > 0 ? (
                            <option value="">Select a lecture group</option>
                          ) : (
                            <option value="">Whole class (no split)</option>
                          )
                        )}
                        {groupOptions.map(g => (
                          <option key={g.id} value={g.id} disabled={occupiedGroupIds.has(Number(g.id)) && form.group_id !== g.id.toString()}>
                            {g.name} {occupiedGroupIds.has(Number(g.id)) && form.group_id !== g.id.toString() ? '(occupied)' : `(${g.member_count > 0 ? `${g.member_count} students` : `${g.student_count || 0} students`})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                {/* Teacher Selection */}
                <div className="form-group">
                  <label className="form-label">
                    Teacher
                    {teacherLocked && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
                        (assigned on Assignments page)
                      </span>
                    )}
                  </label>
                  <select
                    className="form-select"
                    value={form.teacher_id}
                    onChange={e => { setForm(f => ({ ...f, teacher_id: e.target.value })); setError(''); }}
                    disabled={teacherLocked}
                  >
                    <option value="">None (Unassigned Faculty)</option>
                    {teachers.map(t => {
                      const isAssigned = assignedTeachers.includes(t.id);
                      return (
                        <option key={t.id} value={t.id}>
                          {formatTeacherLabel(t)} {isAssigned ? '★ (Assigned)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Room Selection with Keyword Search */}
                {(() => {
                  const filteredRooms = rooms.filter(r => {
                    if (!roomSearch.trim()) return true;
                    const q = roomSearch.toLowerCase().trim();
                    return (
                      (r.name && r.name.toLowerCase().includes(q)) ||
                      (r.type && r.type.toLowerCase().includes(q)) ||
                      (r.location && r.location.toLowerCase().includes(q)) ||
                      (r.capacity && String(r.capacity).includes(q))
                    );
                  });

                  return (
                    <div className="form-group">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>
                          Room *
                          {selectedComp?.requires_lab && (
                            <span style={{ color: 'var(--amber)', fontSize: 11, marginLeft: 8 }}>
                              (Please pick a Lab room)
                            </span>
                          )}
                        </label>
                        {roomSearch && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {filteredRooms.length} room{filteredRooms.length === 1 ? '' : 's'} matching
                          </span>
                        )}
                      </div>

                      {/* Keyword search input */}
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <Search
                          size={13}
                          style={{
                            position: 'absolute',
                            left: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            pointerEvents: 'none'
                          }}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search room (e.g. L21, 306, Lab, NAB)..."
                          value={roomSearch}
                          onChange={e => setRoomSearch(e.target.value)}
                          style={{ paddingLeft: 28, paddingRight: roomSearch ? 26 : 10, fontSize: 12, height: 30 }}
                        />
                        {roomSearch && (
                          <button
                            type="button"
                            onClick={() => setRoomSearch('')}
                            style={{
                              position: 'absolute',
                              right: 6,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Clear search"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      <select
                        className="form-select"
                        value={form.room_id}
                        onChange={e => { setForm(f => ({ ...f, room_id: e.target.value })); setError(''); }}
                        required
                      >
                        <option value="">{filteredRooms.length === 0 ? 'No matching rooms found' : 'Select room...'}</option>
                        {form.room_id && !filteredRooms.some(r => r.id === parseInt(form.room_id)) && (() => {
                          const cur = rooms.find(r => r.id === parseInt(form.room_id));
                          return cur ? (
                            <option key={cur.id} value={cur.id}>
                              {cur.type === 'lab' ? '🔬' : '🚪'} {cur.name} ({cur.type.toUpperCase()} · cap: {cur.capacity}) [Current]
                            </option>
                          ) : null;
                        })()}
                        {filteredRooms.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.type === 'lab' ? '🔬' : '🚪'} {r.name} ({r.type.toUpperCase()}{r.location ? ` · ${r.location}` : ''} · cap: {r.capacity})
                          </option>
                        ))}
                      </select>

                      {/* Quick selection chips if 1-6 rooms match */}
                      {roomSearch && filteredRooms.length > 0 && filteredRooms.length <= 6 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          {filteredRooms.map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => { setForm(f => ({ ...f, room_id: r.id.toString() })); setError(''); }}
                              className={`badge ${form.room_id === r.id.toString() ? 'badge-indigo' : 'badge-gray'}`}
                              style={{
                                cursor: 'pointer',
                                border: form.room_id === r.id.toString() ? '1px solid var(--primary)' : '1px solid var(--border)',
                                fontSize: 11,
                                padding: '3px 8px'
                              }}
                            >
                              {r.type === 'lab' ? '🔬' : '🚪'} {r.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Validating...' : (modal.editEntry ? 'Update' : 'Schedule Session')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
