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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
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
      course_component_id: entry.course_component_id != null ? entry.course_component_id.toString() : '',
      teacher_id: entry.teacher_id != null ? entry.teacher_id.toString() : '',
      room_id: entry.room_id != null ? entry.room_id.toString() : '',
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

  async function handleDownloadPdf() {
    const area = document.getElementById('timetable-printable-area');
    if (!area) {
      window.print();
      return;
    }

    if (typeof window.html2pdf === 'undefined') {
      window.print();
      return;
    }

    setDownloadingPdf(true);
    try {
      const batchName = viewMode === 'class'
        ? (classes.find(c => String(c.id) === String(selectedClass))?.name || 'Class')
        : viewMode === 'teacher'
        ? (teachers.find(t => String(t.id) === String(selectedTeacher))?.name || 'Teacher')
        : viewMode === 'scholar'
        ? (scholars.find(s => String(s.id) === String(selectedScholar))?.name || 'Scholar')
        : (rooms.find(r => String(r.id) === String(selectedRoom))?.name || 'Room');

      const safeFileName = `${batchName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Timetable_${activeTerm}.pdf`;

      const numPeriods = Math.max(periods.length, 1);
      // Sizing each period dynamically so all periods (P1 through P14 or whatever exist) fit completely
      const colWidth = 115;
      const dayColWidth = 55;
      const paddingBuffer = 24;
      const targetWidth = dayColWidth + (numPeriods * colWidth) + paddingBuffer;

      const opt = {
        margin:       [5, 5, 5, 5],
        filename:     safeFileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          logging: false,
          width: targetWidth,
          windowWidth: targetWidth + 100,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            clonedDoc.body.style.width = `${targetWidth + 100}px`;
            clonedDoc.body.style.minWidth = `${targetWidth + 100}px`;
            clonedDoc.body.style.overflow = 'visible';

            // Ensure the html2pdf overlay and container do not clip or constrain width
            clonedDoc.querySelectorAll('.html2pdf__overlay').forEach(o => {
              o.style.overflow = 'visible';
              o.style.width = '100%';
            });
            clonedDoc.querySelectorAll('.html2pdf__container').forEach(c => {
              c.style.setProperty('width', `${targetWidth}px`, 'important');
              c.style.setProperty('min-width', `${targetWidth}px`, 'important');
              c.style.setProperty('max-width', 'none', 'important');
              c.style.overflow = 'visible';
              c.style.margin = '0';
              c.style.left = '0';
            });

            const clonedArea = clonedDoc.getElementById('timetable-printable-area');
            if (clonedArea) {
              clonedArea.style.setProperty('width', `${targetWidth}px`, 'important');
              clonedArea.style.setProperty('min-width', `${targetWidth}px`, 'important');
              clonedArea.style.setProperty('max-width', 'none', 'important');
              clonedArea.style.overflow = 'visible';
              clonedArea.style.background = '#ffffff';
              clonedArea.style.padding = '8px 12px';
              clonedArea.style.boxSizing = 'border-box';

              // Unconstrain all parent containers
              let parent = clonedArea.parentElement;
              while (parent && parent !== clonedDoc.body) {
                parent.style.overflow = 'visible';
                parent.style.width = `${targetWidth}px`;
                parent.style.maxWidth = 'none';
                parent = parent.parentElement;
              }

              const header = clonedArea.querySelector('.print-only-header');
              if (header) {
                header.style.display = 'block';
                header.style.marginBottom = '8px';
              }

              const scrollWrapper = clonedArea.querySelector('.timetable-horizontal-scroll');
              if (scrollWrapper) {
                scrollWrapper.style.overflow = 'visible';
                scrollWrapper.style.width = '100%';
                scrollWrapper.style.maxWidth = 'none';
              }

              const table = clonedArea.querySelector('.timetable-table');
              if (table) {
                table.style.setProperty('width', '100%', 'important');
                table.style.setProperty('min-width', '100%', 'important');
                table.style.setProperty('max-width', 'none', 'important');
                table.style.tableLayout = 'fixed';
                table.style.border = '1px solid #000000';
              }

              // Set explicit column widths on table headers to distribute all periods evenly
              const dayTh = clonedArea.querySelector('.timetable-table th.tt-day-th');
              if (dayTh) {
                dayTh.style.width = `${dayColWidth}px`;
                dayTh.style.minWidth = `${dayColWidth}px`;
                dayTh.style.maxWidth = `${dayColWidth}px`;
              }

              const periodThs = clonedArea.querySelectorAll('.timetable-table th.tt-period-th');
              periodThs.forEach(th => {
                th.style.width = `${colWidth}px`;
                th.style.minWidth = `${colWidth}px`;
                th.style.maxWidth = `${colWidth}px`;
              });

              // Ensure sticky positioning is removed for html2canvas
              clonedArea.querySelectorAll('.timetable-table th, .timetable-table td.tt-day-cell').forEach(el => {
                el.style.position = 'static';
              });

              clonedArea.querySelectorAll('.tt-cell-add').forEach(el => el.style.display = 'none');
              clonedArea.querySelectorAll('.delete-btn').forEach(el => el.style.display = 'none');
            }
          }
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      await window.html2pdf().set(opt).from(area).save();
    } catch (err) {
      console.error('PDF auto-download failed, falling back to window.print():', err);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
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

  const currentClass   = classes.find(c => c.id === parseInt(selectedClass));
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

          <button
            className="btn btn-sm btn-secondary"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Download full timetable as PDF"
          >
            {downloadingPdf ? (
              <>
                <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Printer size={14} />
                <span>PDF</span>
              </>
            )}
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
          <div id="timetable-printable-area" className="card timetable-grid-card" style={{ padding: 0 }}>
            {/* Printable Header — shows the batch / entity name when printing or saving as PDF */}
            <div className="print-only-header">
              <div className="print-header-main">
                {viewMode === 'class' && (currentClass ? `${currentClass.name} — Weekly Timetable` : 'Academic Timetable')}
                {viewMode === 'teacher' && (currentTeacher ? `${formatTeacherLabel(currentTeacher)} — Weekly Schedule` : 'Faculty Schedule')}
                {viewMode === 'scholar' && (currentScholar ? `${currentScholar.name} (TA) — Weekly Schedule` : 'Scholar Schedule')}
                {viewMode === 'room' && (currentRoom ? `${currentRoom.name} (${currentRoom.type}) — Room Schedule` : 'Room Timetable')}
              </div>
              <div className="print-header-sub">
                {viewMode === 'class' && currentClass && (
                  <span>Batch: <strong>{currentClass.name}</strong> · </span>
                )}
                <span>Academic Term: <strong>{activeTerm}</strong></span>
              </div>
            </div>

            <div className="timetable-horizontal-scroll">
              <table className="timetable-table">
                <thead>
                  <tr>
                    <th className="tt-day-th">Day</th>
                    {periods.map(period => {
                      const slot = slots.find(item => item.period === period);
                      return (
                        <th key={period} className="tt-period-th">
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
                    const dayEntries = entries.filter(e => e.day === day);

                    // Sort entries: period ascending, duration descending, then id
                    const sortedEntries = [...dayEntries].sort((a, b) => {
                      if (a.period !== b.period) return a.period - b.period;
                      const durA = a.duration_hours || 1;
                      const durB = b.duration_hours || 1;
                      if (durA !== durB) return durB - durA;
                      return a.id - b.id;
                    });

                    // Interval partitioning into non-overlapping tracks / lanes
                    // Handles staggered sessions (e.g., 9-11 and 10-12) cleanly across full colSpan
                    const lanes = [];
                    for (const entry of sortedEntries) {
                      const dur = entry.duration_hours || 1;
                      const start = entry.period;
                      const end = start + dur - 1;

                      let placed = false;
                      for (const lane of lanes) {
                        const fits = lane.every(item => {
                          const itemDur = item.duration_hours || 1;
                          const itemStart = item.period;
                          const itemEnd = itemStart + itemDur - 1;

                          // Identical span: can share the multi-hour cell
                          if (itemStart === start && itemDur === dur) return true;

                          // Disjoint: item ends before start, or starts after end
                          return itemEnd < start || itemStart > end;
                        });

                        if (fits) {
                          lane.push(entry);
                          placed = true;
                          break;
                        }
                      }

                      if (!placed) {
                        lanes.push([entry]);
                      }
                    }

                    // Phase 2: If multiple lanes exist for this day, balance multi-entry slots across available free lanes
                    // e.g. on Wednesday at P2-P3, separate multiple entries into distinct lanes/slots
                    if (lanes.length > 1) {
                      for (let lIdx = 0; lIdx < lanes.length; lIdx++) {
                        const lane = lanes[lIdx];
                        // Group entries in this lane by period & duration
                        const groups = {};
                        lane.forEach(e => {
                          const key = `${e.period}-${e.duration_hours || 1}`;
                          if (!groups[key]) groups[key] = [];
                          groups[key].push(e);
                        });

                        for (const key in groups) {
                          const groupEntries = groups[key];
                          if (groupEntries.length > 1) {
                            const [pStr, dStr] = key.split('-');
                            const p = parseInt(pStr);
                            const dur = parseInt(dStr);
                            const end = p + dur - 1;

                            // Try to distribute surplus entries to other lanes that are completely free during [p, end]
                            while (groupEntries.length > 1) {
                              let moved = false;
                              for (let targetIdx = 0; targetIdx < lanes.length; targetIdx++) {
                                if (targetIdx === lIdx) continue;
                                const targetLane = lanes[targetIdx];
                                const targetFree = targetLane.every(item => {
                                  const itemDur = item.duration_hours || 1;
                                  const itemStart = item.period;
                                  const itemEnd = itemStart + itemDur - 1;
                                  return itemEnd < p || itemStart > end;
                                });

                                if (targetFree) {
                                  const entryToMove = groupEntries.pop();
                                  const removeIdx = lane.findIndex(e => e.id === entryToMove.id);
                                  if (removeIdx !== -1) lane.splice(removeIdx, 1);
                                  targetLane.push(entryToMove);
                                  moved = true;
                                  break;
                                }
                              }
                              if (!moved) break;
                            }
                          }
                        }
                      }
                    }

                    const activeLanes = lanes.length > 0 ? lanes : [[]];
                    const hasMultipleLanes = activeLanes.length > 1;

                    // Helper: which lanes have active entries at period p
                    const activeLaneIndicesAtPeriod = (p) => {
                      const active = [];
                      activeLanes.forEach((lane, idx) => {
                        const has = lane.some(e => {
                          const dur = e.duration_hours || 1;
                          return e.period <= p && p < e.period + dur;
                        });
                        if (has) active.push(idx);
                      });
                      return active;
                    };

                    // Track which periods are already spanned (by horizontal colSpan or vertical rowSpan)
                    const laneSkips = activeLanes.map(() => new Set());

                    return activeLanes.map((lane, laneIdx) => {
                      const isFirstLane = laneIdx === 0;
                      const isLastLane = laneIdx === activeLanes.length - 1;

                      const cells = [];

                      for (let i = 0; i < periods.length; i++) {
                        const period = periods[i];

                        // If skipped in this lane, do not render a td
                        if (laneSkips[laneIdx].has(period)) {
                          continue;
                        }

                        const cellKey = `${day}-${period}`;
                        const slot = slotMap[cellKey];

                        // Check active lanes at this period
                        const activeLaneIndices = activeLaneIndicesAtPeriod(period);

                        // Case 1: Slot does not exist in master schedule for this day/period
                        if (!slot) {
                          if (isFirstLane) {
                            cells.push(
                              <td
                                key={period}
                                rowSpan={activeLanes.length > 1 ? activeLanes.length : undefined}
                                className={isLastLane || (activeLanes.length > 1 && isFirstLane) ? 'tt-day-bottom-border' : undefined}
                                style={{ background: 'var(--bg-elevated)', opacity: 0.4 }}
                              />
                            );
                            for (let l = 1; l < activeLanes.length; l++) {
                              laneSkips[l].add(period);
                            }
                          }
                          continue;
                        }

                        // Case 2: This period has NO entry anywhere on this day across ANY lane
                        if (activeLaneIndices.length === 0) {
                          if (isFirstLane) {
                            cells.push(
                              <td
                                key={period}
                                rowSpan={activeLanes.length > 1 ? activeLanes.length : undefined}
                                className={`tt-table-td tt-empty-td ${isLastLane || (activeLanes.length > 1 && isFirstLane) ? 'tt-day-bottom-border' : ''}`}
                                onClick={() => {
                                  if (viewMode === 'class') {
                                    openAdd(day, period);
                                  }
                                }}
                              >
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
                            for (let l = 1; l < activeLanes.length; l++) {
                              laneSkips[l].add(period);
                            }
                          }
                          continue;
                        }

                        // Case 3: Entries exist at this period
                        const laneStarts = lane.filter(e => e.period === period);

                        // If this lane has no entry starting at this period
                        if (laneStarts.length === 0) {
                          cells.push(
                            <td
                              key={period}
                              className={`tt-table-td tt-lane-spacer ${isLastLane ? 'tt-day-bottom-border' : ''}`}
                            />
                          );
                          continue;
                        }

                        const cellEntries = laneStarts;
                        const dur = cellEntries[0].duration_hours || 1;

                        // Determine horizontal colSpan across full duration
                        const remaining = periods.slice(i);
                        const colSpan = Math.min(dur, remaining.length);
                        if (colSpan > 1) {
                          for (let s = 1; s < colSpan; s++) {
                            laneSkips[laneIdx].add(periods[i + s]);
                          }
                        }

                        // Determine vertical rowSpan:
                        // If ONLY this lane is active across all periods covered by this cell's colSpan,
                        // it can safely take rowSpan={activeLanes.length} and eliminate all empty white space!
                        let rowSpan = 1;
                        if (activeLanes.length > 1 && laneIdx === 0) {
                          let onlyThisLane = true;
                          for (let s = 0; s < colSpan; s++) {
                            const checkP = periods[i + s];
                            const lanesAtP = activeLaneIndicesAtPeriod(checkP);
                            if (lanesAtP.some(idx => idx !== 0)) {
                              onlyThisLane = false;
                              break;
                            }
                          }
                          if (onlyThisLane) {
                            rowSpan = activeLanes.length;
                            for (let l = 1; l < activeLanes.length; l++) {
                              for (let s = 0; s < colSpan; s++) {
                                laneSkips[l].add(periods[i + s]);
                              }
                            }
                          }
                        }

                        const reachesBottom = (laneIdx + rowSpan) >= activeLanes.length;
                        cells.push(
                          <td
                            key={period}
                            colSpan={colSpan > 1 ? colSpan : undefined}
                            rowSpan={rowSpan > 1 ? rowSpan : undefined}
                            className={`tt-table-td ${colSpan > 1 ? 'tt-span-td' : ''} ${reachesBottom ? 'tt-day-bottom-border' : ''}`}
                          >
                            <div className="tt-slot-entries">
                              {cellEntries.map(entry => {
                                const entryDur = entry.duration_hours || 1;
                                return (
                                  <div
                                    key={entry.id}
                                    className={`tt-entry ${entryColor(entry.course_component_id)} ${entryDur > 1 ? 'tt-multihour-entry' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                                    title={`${entry.course_code ? `[${entry.course_code}] ` : ''}${entry.course_name}${entry.course_short_name && entry.course_short_name !== entry.course_code ? ` (${entry.course_short_name})` : ''} · ${entry.component_type.toUpperCase()}${entry.group_name ? ` · ${entry.group_name}` : ''} · ${entry.teacher_name ? `Faculty: ${formatTeacherWithDesignation(entry.teacher_name, entry.designation)}` : 'Unassigned'}${entry.scholar_name ? ` · TA: ${entry.scholar_name}${entry.scholar_designation ? ` (${entry.scholar_designation})` : ''}` : ''} · ${entry.room_name}${entryDur > 1 ? ` · ${entryDur}h session (P${entry.period}–P${entry.period + entryDur - 1})` : ''}`}
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
                                      {entryDur > 1 && (
                                        <span style={{
                                          fontSize: 9.5,
                                          padding: '1px 6px',
                                          borderRadius: 3,
                                          background: 'rgba(0,0,0,0.25)',
                                          fontWeight: 700,
                                          marginLeft: 'auto',
                                          whiteSpace: 'nowrap',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3
                                        }}>
                                          ⏱ {entryDur}h (P{entry.period}–P{entry.period + entryDur - 1})
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
                                          <span style={{ opacity: 0.6, margin: '0 4px' }}>•</span>
                                          <span>{entry.room_name || 'No Room'}</span>
                                        </>
                                      )}
                                      {viewMode === 'teacher' && (
                                        <>
                                          <span>{entry.class_name} {entry.group_name ? `(${entry.group_name})` : ''}</span>
                                          <span style={{ opacity: 0.6, margin: '0 4px' }}>•</span>
                                          <span>{entry.room_name}</span>
                                        </>
                                      )}
                                      {viewMode === 'scholar' && (
                                        <>
                                          <span>{entry.class_name} {entry.group_name ? `(${entry.group_name})` : ''}</span>
                                          <span style={{ opacity: 0.6, margin: '0 4px' }}>•</span>
                                          <span>{entry.room_name}</span>
                                        </>
                                      )}
                                      {viewMode === 'room' && (
                                        <>
                                          <span>{entry.class_name} {entry.group_name ? `(${entry.group_name})` : ''}</span>
                                          <span style={{ opacity: 0.6, margin: '0 4px' }}>•</span>
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
                      }

                      const rowClasses = [
                        hasMultipleLanes ? 'tt-lane-row' : '',
                        isFirstLane ? 'tt-day-first-lane' : '',
                        isLastLane ? 'tt-day-last-lane' : ''
                      ].filter(Boolean).join(' ');

                      return (
                        <tr key={`${day}-lane-${laneIdx}`} className={rowClasses || undefined}>
                          {isFirstLane && (
                            <td className="tt-day-cell tt-day-bottom-border" rowSpan={activeLanes.length}>
                              <div className="tt-period-label">
                                <span className="period-time">{day}</span>
                              </div>
                            </td>
                          )}
                          {cells}
                        </tr>
                      );
                    });
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
                      const nextTeacherId = (defaultAssgn && defaultAssgn.teacher_id != null)
                        ? defaultAssgn.teacher_id.toString()
                        : (defaultAssgn?.scholar_id ? '' : (teachers[0]?.id ? teachers[0].id.toString() : ''));
                      setForm(f => ({
                        ...f,
                        course_component_id: newCompId,
                        teacher_id: nextTeacherId,
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
                          const nextGrpTeacherId = (grpAssgn && grpAssgn.teacher_id != null)
                            ? grpAssgn.teacher_id.toString()
                            : (grpAssgn?.scholar_id ? '' : f.teacher_id);
                          setForm(f => ({
                            ...f,
                            group_id: newGid,
                            teacher_id: nextGrpTeacherId,
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
                  {assignedFaculty?.scholar_id && (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--primary, #3b82f6)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>🎓</span>
                      <span>
                        Assigned TA: <strong>{scholars.find(s => s.id === assignedFaculty.scholar_id)?.name || 'Research Scholar'}</strong>
                        {scholars.find(s => s.id === assignedFaculty.scholar_id)?.designation ? ` (${scholars.find(s => s.id === assignedFaculty.scholar_id).designation})` : ''}
                      </span>
                    </div>
                  )}
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
