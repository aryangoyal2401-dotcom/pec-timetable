import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useAcademicTerm } from '../context/AcademicTermContext';
import { Plus, Trash2, Edit2, X, Users, BookOpen, FlaskConical, Save, Check } from 'lucide-react';

/* ─────────────────────────────────────────
   Tiny helpers
───────────────────────────────────────── */
function Badge({ type }) {
  const styles = {
    lecture: {
      background: '#4f46e5', color: '#fff',
      padding: '1px 7px', borderRadius: 999,
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    },
    lab: {
      background: '#059669', color: '#fff',
      padding: '1px 7px', borderRadius: 999,
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    },
  };
  return <span style={styles[type] ?? styles.lecture}>{type}</span>;
}

function formatRollRanges(rollNumbers) {
  const numeric = rollNumbers
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const ranges = [];

  for (const number of numeric) {
    const previous = ranges[ranges.length - 1];
    if (!previous || number > previous[1] + 1) ranges.push([number, number]);
    else previous[1] = number;
  }

  return ranges.map(([start, end]) => start === end ? `${start}` : `${start}-${end}`).join(', ');
}

function parseRollRanges(value, students) {
  const tokens = value.split(/[\s,]+/).filter(Boolean);
  const selectedIds = new Set();
  const invalid = [];
  const studentsByRoll = new Map(
    students.map(student => [String(student.roll_no).trim(), student.id])
  );
  const addStudentsByPosition = (start, end) => {
    if (start < 1 || end > students.length) return false;
    students.slice(start - 1, end).forEach(student => selectedIds.add(student.id));
    return true;
  };

  for (const token of tokens) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = token.match(/^\d+$/);
    if (!range && !single) {
      invalid.push(token);
      continue;
    }

    const start = single ? Number(token) : Number(range[1]);
    const end = single ? start : Number(range[2]);
    if (start > end) {
      invalid.push(token);
      continue;
    }

    let matchedRoll = false;
    for (const student of students) {
      const roll = Number(student.roll_no);
      if (Number.isFinite(roll) && roll >= start && roll <= end) {
        selectedIds.add(student.id);
        matchedRoll = true;
      }
    }

    if (!matchedRoll && !studentsByRoll.has(token) && !addStudentsByPosition(start, end)) {
      invalid.push(`${token} (not found)`);
    }
  }

  return { ids: [...selectedIds], invalid: [...new Set(invalid)] };
}

function Tabs({ active, onChange }) {
  const tabs = [
    { key: 'groups',   label: 'Groups' },
    { key: 'students', label: 'Students' },
    { key: 'assign',   label: 'Assign to Groups' },
  ];
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: active === t.key ? 700 : 400,
            color: active === t.key ? 'var(--primary, #4f46e5)' : 'var(--text-secondary)',
            borderBottom: active === t.key ? '2px solid var(--primary, #4f46e5)' : '2px solid transparent',
            marginBottom: -1,
            transition: 'all .15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Tab 1 – Groups (with manual/auto count)
───────────────────────────────────────── */
function GroupsTab({ classId, groups, onRefresh }) {
  const [name,         setName]         = useState('');
  const [groupType,    setGroupType]    = useState('lecture');
  const [studentCount, setStudentCount] = useState('');
  const [busy,         setBusy]         = useState(false);

  // Inline editing for manual student count
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editCountVal,   setEditCountVal]   = useState('');

  const handleAdd = async e => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createGroup(classId, {
        name: name.trim(),
        group_type: groupType,
        student_count: studentCount !== '' ? parseInt(studentCount) || 0 : 0,
      });
      setName('');
      setGroupType('lecture');
      setStudentCount('');
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async groupId => {
    if (!confirm('Delete this group?')) return;
    await api.deleteGroup(classId, groupId);
    onRefresh();
  };

  const handleSaveCount = async (groupId) => {
    const parsed = parseInt(editCountVal) || 0;
    await api.updateGroup(classId, groupId, { student_count: parsed });
    setEditingGroupId(null);
    onRefresh();
  };

  return (
    <div>
      {/* Group list */}
      {groups.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          No groups yet. Add one below.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {groups.map(g => {
            const hasListMembers = (g.member_count ?? 0) > 0;
            const isEditing = editingGroupId === g.id;

            return (
              <div
                key={g.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 6,
                  background: 'var(--surface-raised, rgba(0,0,0,.04))',
                  border: '1px solid var(--border)',
                }}
              >
                {g.group_type === 'lab'
                  ? <FlaskConical size={13} style={{ color: '#059669', flexShrink: 0 }} />
                  : <BookOpen     size={13} style={{ color: '#4f46e5', flexShrink: 0 }} />
                }
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 60 }}>{g.name}</span>
                <Badge type={g.group_type ?? 'lecture'} />

                {/* Count badge / inline editor */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  {hasListMembers ? (
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                      👥 {g.member_count} members (from list)
                    </span>
                  ) : isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={editCountVal}
                        onChange={e => setEditCountVal(e.target.value)}
                        style={{ width: 65, height: 24, fontSize: 11, padding: '2px 6px' }}
                        autoFocus
                      />
                      <button
                        className="btn btn-sm btn-success btn-icon"
                        style={{ height: 24, width: 24 }}
                        onClick={() => handleSaveCount(g.id)}
                        title="Save student count"
                      >
                        <Check size={11} />
                      </button>
                      <button
                        className="btn btn-sm btn-secondary btn-icon"
                        style={{ height: 24, width: 24 }}
                        onClick={() => setEditingGroupId(null)}
                        title="Cancel"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {g.student_count ?? 0} students (manual)
                      </span>
                      <button
                        className="btn btn-sm btn-secondary btn-icon"
                        style={{ height: 22, width: 22, opacity: 0.8 }}
                        onClick={() => {
                          setEditingGroupId(g.id);
                          setEditCountVal((g.student_count ?? 0).toString());
                        }}
                        title="Edit manual student count"
                      >
                        <Edit2 size={10} />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-sm btn-danger btn-icon"
                  style={{ height: 24, width: 24 }}
                  onClick={() => handleDelete(g.id)}
                  title="Delete group"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add group form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="form-input"
          placeholder="Group name (e.g. G1, CSE1)"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ flex: 1, minWidth: 120, height: 32, fontSize: 12 }}
        />
        <select
          className="form-select"
          value={groupType}
          onChange={e => setGroupType(e.target.value)}
          style={{ height: 32, fontSize: 12, width: 95 }}
        >
          <option value="lecture">Lecture</option>
          <option value="lab">Lab</option>
        </select>
        <input
          className="form-input"
          type="number"
          min="0"
          placeholder="Manual count (optional)"
          value={studentCount}
          onChange={e => setStudentCount(e.target.value)}
          style={{ width: 140, height: 32, fontSize: 12 }}
          title="Set manual count if student list is unavailable"
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={busy}
          style={{ height: 32, whiteSpace: 'nowrap' }}
        >
          <Plus size={12} /> Add Group
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────
   Tab 2 – Students
───────────────────────────────────────── */
function StudentsTab({ classId, onRefreshList }) {
  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [rollNo,    setRollNo]    = useState('');
  const [name,      setName]      = useState('');
  const [bulkText,  setBulkText]  = useState('');
  const [bulkResult,setBulkResult]= useState(null);
  const [addBusy,   setAddBusy]   = useState(false);
  const [bulkBusy,  setBulkBusy]  = useState(false);
  const [error,     setError]     = useState('');

  const loadStudents = useCallback(async () => {
    try {
      const data = await api.getStudents(classId);
      setStudents(data);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const handleAddOne = async e => {
    e.preventDefault();
    if (!rollNo.trim() || !name.trim()) return;
    setAddBusy(true);
    setError('');
    try {
      await api.addStudent(classId, { roll_no: rollNo.trim(), name: name.trim() });
      setRollNo('');
      setName('');
      await loadStudents();
      onRefreshList();
    } catch (err) {
      setError(err.error || 'Failed to add student');
    } finally {
      setAddBusy(false);
    }
  };

  const handleBulk = async e => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setBulkBusy(true);
    setBulkResult(null);
    setError('');
    try {
      const res = await api.bulkAddStudents(classId, { text: bulkText });
      setBulkResult(res);
      setBulkText('');
      await loadStudents();
      onRefreshList();
    } catch (err) {
      setError(err.error || 'Bulk import failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDelete = async studentId => {
    if (!confirm('Remove this student?')) return;
    await api.deleteStudent(classId, studentId);
    await loadStudents();
    onRefreshList();
  };

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Add Single Student */}
      <form onSubmit={handleAddOne} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          className="form-input"
          placeholder="Roll No (e.g. 21CSE001)"
          value={rollNo}
          onChange={e => setRollNo(e.target.value)}
          required
          style={{ width: 140, height: 32, fontSize: 12 }}
        />
        <input
          className="form-input"
          placeholder="Student Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ flex: 1, height: 32, fontSize: 12 }}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={addBusy}
          style={{ height: 32, whiteSpace: 'nowrap' }}
        >
          <Plus size={12} /> Add
        </button>
      </form>

      {/* Bulk Import */}
      <details style={{ marginBottom: 14 }}>
        <summary style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
          ➕ Bulk Import Students (Paste list)
        </summary>
        <form onSubmit={handleBulk} style={{ marginTop: 8 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Format: <code>ROLL_NO Student Name</code> (one per line)
          </p>
          <textarea
            className="form-input"
            rows={4}
            placeholder={`21CSE001 Aryan Singh\n21CSE002 Ravi Kumar\n21CSE003 Priya Sharma`}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={bulkBusy}
            >
              {bulkBusy ? 'Importing...' : 'Import Students'}
            </button>
            {bulkResult && (
              <span style={{ fontSize: 11, color: '#059669' }}>
                ✓ Added {bulkResult.added}, skipped {bulkResult.skipped}
              </span>
            )}
          </div>
        </form>
      </details>

      {/* Student List Table */}
      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading students...</p>
      ) : students.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          No students enrolled yet. Add individual students or bulk import above.
        </p>
      ) : (
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised, rgba(0,0,0,.03))', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Roll No</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Name</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Groups</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{s.roll_no}</td>
                  <td style={{ padding: '5px 8px' }}>{s.name}</td>
                  <td style={{ padding: '5px 8px', color: 'var(--text-muted)', fontSize: 11 }}>
                    {s.group_names || '—'}
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    <button
                      className="btn btn-sm btn-danger btn-icon"
                      style={{ height: 20, width: 20 }}
                      onClick={() => handleDelete(s.id)}
                      title="Remove student"
                    >
                      <Trash2 size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Tab 3 – Assign to Groups
───────────────────────────────────────── */
function AssignTab({ classId, groups, onRefreshList }) {
  const [students,     setStudents]     = useState([]);
  const [groupMembers, setGroupMembers] = useState({});
  const [rangeInputs,  setRangeInputs]  = useState({});
  const [rangeErrors,   setRangeErrors]  = useState({});
  const [loading,      setLoading]      = useState(true);
  const [savingAll,    setSavingAll]    = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [assignmentIssues, setAssignmentIssues] = useState({ duplicates: [], missing: [] });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [stu, ...memberArrays] = await Promise.all([
        api.getStudents(classId),
        ...groups.map(g => api.getGroupMembers(classId, g.id)),
      ]);
      setStudents(stu);
      const map = {};
      groups.forEach((g, i) => {
        map[g.id] = (memberArrays[i] ?? []).map(m => m.id);
      });
      setGroupMembers(map);
      setRangeInputs(prev => {
        const next = { ...prev };
        groups.forEach((g, i) => {
          if (!(g.id in next)) {
            next[g.id] = formatRollRanges((memberArrays[i] ?? []).map(student => student.roll_no));
          }
        });
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [classId, groups]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRangeChange = (groupId, value) => {
    setRangeInputs(prev => ({ ...prev, [groupId]: value }));
    const parsed = parseRollRanges(value, students);
    setGroupMembers(prev => ({ ...prev, [groupId]: parsed.ids }));
    setRangeErrors(prev => ({ ...prev, [groupId]: parsed.invalid }));
    setSaveError('');
    setAssignmentIssues({ duplicates: [], missing: [] });
  };

  const handleSaveAll = async () => {
    const assignments = groups.map(group => ({
      group_id: group.id,
      student_ids: parseRollRanges(rangeInputs[group.id] ?? '', students).ids,
    }));
    const errors = Object.fromEntries(groups.map(group => [
      group.id,
      parseRollRanges(rangeInputs[group.id] ?? '', students).invalid,
    ]));
    setRangeErrors(errors);

    const groupTypes = Object.fromEntries(groups.map(group => [group.id, group.group_type || 'lecture']));
    const duplicateIdsByType = { lecture: new Set(), lab: new Set() };
    const seenIdsByType = { lecture: new Set(), lab: new Set() };
    assignments.forEach(assignment => assignment.student_ids.forEach(studentId => {
      const groupType = groupTypes[assignment.group_id] || 'lecture';
      if (seenIdsByType[groupType].has(studentId)) duplicateIdsByType[groupType].add(studentId);
      seenIdsByType[groupType].add(studentId);
    }));
    const studentById = new Map(students.map(student => [student.id, student]));
    const duplicateRolls = Object.fromEntries(Object.entries(duplicateIdsByType).map(([type, ids]) => [
      type, [...ids].map(id => studentById.get(id)?.roll_no || id),
    ]));
    const missingRolls = Object.fromEntries(Object.entries(seenIdsByType).map(([type, ids]) => [
      type,
      students.filter(student => !ids.has(student.id)).map(student => student.roll_no),
    ]));
    const activeTypes = new Set(groups.map(group => group.group_type || 'lecture'));
    const hasDuplicates = [...activeTypes].some(type => duplicateRolls[type].length > 0);
    const hasMissing = [...activeTypes].some(type => missingRolls[type].length > 0);

    if (Object.values(errors).some(groupErrors => groupErrors.length > 0)) {
      setSaveError('Fix the invalid roll numbers or ranges before saving.');
      return;
    }
    if (hasDuplicates || hasMissing) {
      setAssignmentIssues({ duplicates: duplicateRolls, missing: missingRolls });
      setSaveError('Each student must be in exactly one group within each group type.');
      return;
    }

    setSavingAll(true);
    setSaveError('');
    setAssignmentIssues({ duplicates: [], missing: [] });
    try {
      await api.setAllGroupMembers(classId, { assignments });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      onRefreshList();
    } catch (err) {
      setSaveError(err.error || 'Failed to save group assignments');
    } finally {
      setSavingAll(false);
    }
  };

  if (loading) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading assignments...</p>;

  if (groups.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No groups defined. Create groups in the Groups tab first.</p>;
  }

  if (students.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No students enrolled. Add students in the Students tab first.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groups.map(g => {
        const assignedIds = groupMembers[g.id] ?? [];

        return (
          <div
            key={g.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 10,
              background: 'var(--surface-raised, rgba(0,0,0,.02))',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{g.name}</span>
                <Badge type={g.group_type ?? 'lecture'} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  ({assignedIds.length} / {students.length} students)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Roll numbers or ranges
                <input
                  type="text"
                  className="form-input"
                  value={rangeInputs[g.id] ?? ''}
                  onChange={e => handleRangeChange(g.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                  disabled={false}
                  readOnly={false}
                  autoComplete="off"
                  placeholder="Example: 1-20, 31-40, 55"
                  style={{ width: '100%', marginTop: 4, fontSize: 12 }}
                />
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Use roll numbers or student positions, e.g. 24103001-24103020 or 1-20.
              </span>
              {(rangeErrors[g.id] ?? []).length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--rose)' }}>
                  Not recognized: {rangeErrors[g.id].join(', ')}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
        <div style={{ minHeight: 18, fontSize: 11, color: 'var(--rose)', flex: 1 }}>
          {saveError && <div>{saveError}</div>}
          {Object.entries(assignmentIssues.duplicates).map(([type, rolls]) => rolls.length > 0 && (
            <div key={`duplicate-${type}`} style={{ marginTop: 3 }}>
              Overlisted in {type} groups: {rolls.join(', ')}
            </div>
          ))}
          {Object.entries(assignmentIssues.missing).map(([type, rolls]) => rolls.length > 0 && (
            <div key={`missing-${type}`} style={{ marginTop: 3 }}>
              Not assigned to a {type} group: {rolls.join(', ')}
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={handleSaveAll} disabled={savingAll}>
          <Save size={13} />
          {savingAll ? 'Saving all groups...' : savedSuccess ? 'Saved all groups' : 'Save all groups'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Class Detail Modal (holds the 3 tabs)
───────────────────────────────────────── */
function ClassDetailModal({ cls, onClose, onRefreshList }) {
  const [tab, setTab] = useState('groups');
  const [currentClass, setCurrentClass] = useState(cls);

  const reloadClass = useCallback(async () => {
    const updated = await api.getClass(cls.id);
    setCurrentClass(updated);
    onRefreshList();
  }, [cls.id, onRefreshList]);

  useEffect(() => {
    reloadClass();
  }, [reloadClass]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 580, width: '92vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title">{currentClass.name} — Class Management</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Semester {currentClass.semester ?? '—'} • Department: {currentClass.department_id ?? 'General'}
            </div>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
          <Tabs active={tab} onChange={setTab} />

          {tab === 'groups'   && <GroupsTab   classId={cls.id} groups={currentClass.groups || []} onRefresh={reloadClass} />}
          {tab === 'students' && <StudentsTab classId={cls.id} onRefreshList={reloadClass} />}
          {tab === 'assign'   && <AssignTab   classId={cls.id} groups={currentClass.groups || []} onRefreshList={reloadClass} />}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Main Classes Page
───────────────────────────────────────── */
export default function ClassesPage() {
  const { activeTerm } = useAcademicTerm();
  const [classes,     setClasses]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Add / Edit class modal
  const [modal, setModal] = useState(null); // 'add' | class object
  const [form,  setForm]  = useState({ name: '', department_id: '', student_count: 60, semester: '' });
  const [error, setError] = useState('');

  // Class detail (3-tab) modal
  const [activeClass, setActiveClass] = useState(null);

  const load = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    Promise.all([api.getClasses({ academic_term: activeTerm }), api.getDepartments()])
      .then(([c, d]) => { setClasses(c); setDepartments(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(true), [activeTerm]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      if (modal === 'add') {
        const newCls = await api.createClass(form);
        if (form.semester) {
           await api.updateClassSemester(newCls.id, activeTerm, form.semester);
        }
      } else {
        await api.updateClass(modal.id, form);
        if (form.semester) {
           await api.updateClassSemester(modal.id, activeTerm, form.semester);
        }
      }
      setModal(null);
      load(false);
    } catch (err) {
      setError(err.error || 'Operation failed');
    }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this class? All groups, students, and timetable entries will be removed.')) return;
    await api.deleteClass(id);
    load(false);
  };

  const semesters = [...new Set(classes.map(c => c.semester).filter(Boolean))].sort((a, b) => a - b);

  if (loading) return <div className="loading"><div className="spinner" />Loading...</div>;

  const ClassCard = ({ c }) => {
    const hasStudentList = (c.student_count_actual ?? 0) > 0;

    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
          <div className="flex gap-1">
            <button
              className="btn btn-sm btn-secondary btn-icon"
              onClick={() => {
                setForm({
                  name: c.name,
                  department_id: c.department_id || '',
                  student_count: c.student_count,
                  semester: c.semester || '',
                });
                setError('');
                setModal(c);
              }}
              title="Edit class details"
            >
              <Edit2 size={11} />
            </button>
            <button
              className="btn btn-sm btn-danger btn-icon"
              onClick={() => handleDelete(c.id)}
              title="Delete class"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          <Users size={11} style={{ marginRight: 4, display: 'inline' }} />
          {hasStudentList ? (
            <span style={{ color: '#059669', fontWeight: 600 }}>
              {c.student_count_actual} students (from list)
            </span>
          ) : (
            <span>
              {c.student_count} students (manual)
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {c.group_count ?? 0} groups
          </span>
          <button className="btn btn-sm btn-secondary" onClick={() => setActiveClass(c)}>
            <Users size={11} /> Manage
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      {/* ── page header ── */}
      <div className="page-header">
        <div>
          <h2>Classes</h2>
          <p>{classes.length} classes across {semesters.length} semesters</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm({ name: '', department_id: departments[0]?.id || '', student_count: 60, semester: '' });
            setError('');
            setModal('add');
          }}
        >
          <Plus size={14} /> Add Class
        </button>
      </div>

      {/* ── class grid ── */}
      <div className="page-body">
        {semesters.map(sem => (
          <div key={sem} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Semester {sem}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {classes.filter(c => c.semester === sem).map(c => <ClassCard key={c.id} c={c} />)}
            </div>
          </div>
        ))}
        {classes.filter(c => !c.semester).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {classes.filter(c => !c.semester).map(c => <ClassCard key={c.id} c={c} />)}
          </div>
        )}
      </div>

      {/* ══════════ Add / Edit Class Modal ══════════ */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'add' ? 'Add Class' : 'Edit Class'}</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setModal(null)}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Class Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. CSE 3A"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Semester</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1" max="8"
                      value={form.semester ?? ''}
                      onChange={e => setForm(f => ({ ...f, semester: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Student Count
                      <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 6 }}>
                        (manual count / fallback)
                      </span>
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      value={form.student_count}
                      onChange={e => setForm(f => ({ ...f, student_count: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={form.department_id}
                    onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ Class Detail Modal ══════════ */}
      {activeClass && (
        <ClassDetailModal
          cls={activeClass}
          onClose={() => setActiveClass(null)}
          onRefreshList={() => load(false)}
        />
      )}
    </div>
  );
}
