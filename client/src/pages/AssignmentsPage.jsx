import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  Filter,
  Layers,
  ArrowRight,
  FlaskConical,
  Lightbulb
} from 'lucide-react';

function matchesAssignment(assignment, classId, componentId, groupId = null) {
  return Number(assignment.class_id) === Number(classId) &&
    Number(assignment.course_component_id) === Number(componentId) &&
    (groupId === null ? assignment.group_id == null : Number(assignment.group_id) === Number(groupId));
}

export default function AssignmentsPage() {
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [classGroupsMap, setClassGroupsMap] = useState({});
  const [lectureModes, setLectureModes] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'assigned' | 'unassigned'

  // Micro feedback state for inline saves: { [key]: 'saving' | 'saved' }
  const [saveStatus, setSaveStatus] = useState({});

  const loadAll = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [clsList, crsList, tchrList, asgnList] = await Promise.all([
        api.getClasses(),
        api.getCourses(),
        api.getTeachers(),
        api.getAssignments(),
      ]);
      setClasses(clsList);
      setCourses(crsList);
      setTeachers(tchrList);
      setAssignments(asgnList);

      // Load groups for all classes in parallel
      const groupEntries = await Promise.all(
        clsList.map(async (cl) => {
          const detail = await api.getClass(cl.id);
          return [cl.id, detail.groups || []];
        })
      );
      setClassGroupsMap(Object.fromEntries(groupEntries));
    } catch (err) {
      console.error('Failed to load assignments data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(true);
  }, []);

  // Set saving indicator
  const setFeedback = (key, status) => {
    setSaveStatus((prev) => ({ ...prev, [key]: status }));
    if (status === 'saved') {
      setTimeout(() => {
        setSaveStatus((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 2000);
    }
  };

  // Inline assign / unassign handler
  const handleTeacherChange = async (classId, componentId, groupId, teacherId) => {
    const key = `${classId}_${componentId}_${groupId || 'none'}`;
    setFeedback(key, 'saving');

    try {
      await api.assignTeacher({
        class_id: parseInt(classId),
        course_component_id: parseInt(componentId),
        group_id: groupId ? parseInt(groupId) : null,
        teacher_id: teacherId ? parseInt(teacherId) : null,
      });

      // Reload assignments list quietly
      const updatedAssignments = await api.getAssignments();
      setAssignments(updatedAssignments);
      setFeedback(key, 'saved');
    } catch (err) {
      console.error('Assignment failed:', err);
      alert(err.error || 'Failed to update teacher assignment');
      setFeedback(key, null);
    }
  };

  const switchLectureMode = async (classId, componentId, lectureGroups, mode) => {
    const currentMode = getLectureMode(classId, componentId, lectureGroups);
    if (currentMode === mode) return;

    setLectureModes(prev => ({ ...prev, [`${classId}_${componentId}`]: mode }));
    try {
      if (mode === 'groups') {
        // A lecture cannot be assigned to the whole class and lecture groups at once.
        await handleTeacherChange(classId, componentId, null, null);
      } else {
        // Whole-class mode replaces any per-lecture-group assignments.
        await Promise.all(lectureGroups.map(group =>
          handleTeacherChange(classId, componentId, group.id, null)
        ));
      }
      setAssignments(await api.getAssignments());
    } catch (err) {
      alert(err.error || 'Failed to change lecture assignment mode');
    }
  };

  const getLectureMode = (classId, componentId, lectureGroups) => {
    const key = `${classId}_${componentId}`;
    if (lectureModes[key]) return lectureModes[key];
    return assignments.some(
      (assignment) => assignment.class_id === classId &&
        assignment.course_component_id === componentId &&
        lectureGroups.some(group => group.id === assignment.group_id)
    ) ? 'groups' : 'whole';
  };

  const COMP_ICONS = {
    lecture: <BookOpen size={13} style={{ color: 'var(--indigo)' }} />,
    lab: <FlaskConical size={13} style={{ color: 'var(--emerald)' }} />,
    tutorial: <Lightbulb size={13} style={{ color: 'var(--amber)' }} />,
  };

  const COMP_BADGES = {
    lecture: 'badge-indigo',
    lab: 'badge-emerald',
    tutorial: 'badge-amber',
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading faculty assignments...
      </div>
    );
  }

  // Filter classes according to selectedClass
  const visibleClasses = selectedClass === 'all'
    ? classes
    : classes.filter((cl) => cl.id === parseInt(selectedClass));

  // Courses available for selected class filter dropdown
  const availableCourses = selectedClass === 'all'
    ? courses
    : courses.filter((c) => c.class_id === parseInt(selectedClass));

  // Calculate metrics
  let totalRequirements = 0;
  let fulfilledRequirements = 0;

  classes.forEach((cl) => {
    const clCourses = courses.filter((c) => c.class_id === cl.id);
    const groups = classGroupsMap[cl.id] || [];
    const lectureGroups = groups.filter((g) => g.group_type === 'lecture');
    const labGroups = groups.filter((g) => g.group_type === 'lab');

    clCourses.forEach((c) => {
      (c.components || []).forEach((comp) => {
        const lectureMode = comp.type === 'lecture' && lectureGroups.length > 0
          ? getLectureMode(cl.id, comp.id, lectureGroups)
          : 'whole';

        if (comp.type === 'lecture' && lectureMode === 'groups') {
          lectureGroups.forEach((g) => {
            totalRequirements++;
            const asgn = assignments.find(a => matchesAssignment(a, cl.id, comp.id, g.id));
            if (asgn?.teacher_id) fulfilledRequirements++;
          });
        } else if ((comp.type === 'lab' || comp.type === 'tutorial') && labGroups.length > 0) {
          labGroups.forEach((g) => {
            totalRequirements++;
            const asgn = assignments.find(a => matchesAssignment(a, cl.id, comp.id, g.id));
            if (asgn?.teacher_id) fulfilledRequirements++;
          });
        } else {
          totalRequirements++;
          const asgn = assignments.find(a => matchesAssignment(a, cl.id, comp.id));
          if (asgn?.teacher_id) fulfilledRequirements++;
        }
      });
    });
  });

  const missingRequirements = totalRequirements - fulfilledRequirements;

  return (
    <div className="fade-in">
      {/* ─── Page Header ─── */}
      <div className="page-header">
        <div>
          <h2>Teacher Allocations</h2>
          <p>Assign faculty to course lectures &amp; lab groups for each batch</p>
        </div>

        {/* Quick summary stats */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: 12,
            }}
          >
            <CheckCircle2 size={15} style={{ color: 'var(--emerald)' }} />
            <span>
              <strong>{fulfilledRequirements}</strong> / {totalRequirements} Assigned
            </span>
          </div>

          {missingRequirements > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--rose)',
              }}
            >
              <AlertCircle size={15} />
              <span>
                <strong>{missingRequirements}</strong> Missing Faculty
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 20,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
            justifyContent: 'space-between',
          }}
        >
          {/* Dropdown Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            {/* Batch / Class Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Batch / Class:
              </span>
              <select
                className="form-select"
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedCourse('all'); // Reset course filter on class change
                }}
                style={{ width: 'auto', minWidth: 170, fontSize: 13 }}
              >
                <option value="all">All Batches / Classes</option>
                {classes.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name} {cl.semester ? `(Sem ${cl.semester})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject / Course Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Subject / Course:
              </span>
              <select
                className="form-select"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                style={{ width: 'auto', minWidth: 180, fontSize: 13 }}
              >
                <option value="all">All Subjects</option>
                {availableCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Tabs */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                padding: 2,
                border: '1px solid var(--border)',
              }}
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'assigned', label: 'Assigned' },
                { id: 'unassigned', label: 'Unassigned' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: filterStatus === tab.id ? 600 : 400,
                    borderRadius: 'var(--radius-sm)',
                    background: filterStatus === tab.id ? 'var(--indigo)' : 'transparent',
                    color: filterStatus === tab.id ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', minWidth: 200 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              className="form-input"
              placeholder="Search course or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 30, height: 32, fontSize: 12 }}
            />
          </div>
        </div>
      </div>

      {/* ─── Batch / Class Sections ─── */}
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {visibleClasses.map((cl) => {
          const groups = classGroupsMap[cl.id] || [];
          const lectureGroups = groups.filter((g) => g.group_type === 'lecture');
          const labGroups = groups.filter((g) => g.group_type === 'lab');

          // Courses for this class
          let classCourses = courses.filter((c) => {
            if (c.class_id !== cl.id) return false;
            // Hide courses from previous semesters if the class has a semester and course has a semester
            if (cl.semester && c.semester && c.semester !== cl.semester) return false;
            return true;
          });

          // Filter by selectedCourse if specified
          if (selectedCourse !== 'all') {
            classCourses = classCourses.filter((c) => c.id === parseInt(selectedCourse));
          }

          // Search filter
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            classCourses = classCourses.filter(
              (c) =>
                c.name.toLowerCase().includes(query) ||
                (c.code && c.code.toLowerCase().includes(query)) ||
                (c.components || []).some((comp) => {
                  const compAsgns = assignments.filter(
                    (a) => a.class_id === cl.id && a.course_component_id === comp.id
                  );
                  return compAsgns.some((a) => a.teacher_name?.toLowerCase().includes(query));
                })
            );
          }

            if (filterStatus !== 'all') {
              classCourses = classCourses.filter(course =>
                (course.components || []).some(comp => {
                  const isSplitByLabGroup = (comp.type === 'lab' || comp.type === 'tutorial') && labGroups.length > 0;
                  if (isSplitByLabGroup) {
                    return labGroups.some(group => {
                      const assigned = assignments.some(assignment =>
                        matchesAssignment(assignment, cl.id, comp.id, group.id) && assignment.teacher_id
                      );
                      return filterStatus === 'assigned' ? assigned : !assigned;
                    });
                  }

                  const isLectureByGroup = comp.type === 'lecture' && lectureGroups.length > 0 &&
                    getLectureMode(cl.id, comp.id, lectureGroups) === 'groups';
                  if (isLectureByGroup) {
                    const allGroupsAssigned = lectureGroups.every(group => assignments.some(assignment =>
                      matchesAssignment(assignment, cl.id, comp.id, group.id) && assignment.teacher_id
                    ));
                    return filterStatus === 'assigned' ? allGroupsAssigned : !allGroupsAssigned;
                  }

                  const assigned = assignments.some(assignment =>
                    matchesAssignment(assignment, cl.id, comp.id) && assignment.teacher_id
                  );
                  return filterStatus === 'assigned' ? assigned : !assigned;
                })
              );
            }

          return (
            <div key={cl.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Batch Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Users size={18} style={{ color: 'var(--indigo)' }} />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{cl.name}</span>
                    {cl.semester && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        Semester {cl.semester}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>{cl.student_count_actual || cl.student_count || 0} Students</span>
                  <span>•</span>
                  <span>{groups.length} Groups ({labGroups.length} Lab Splits)</span>
                  <span>•</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {classCourses.length} Subjects
                  </span>
                </div>
              </div>

              {/* Notice if no courses assigned to this batch */}
              {classCourses.length === 0 && (
                <div
                  className="card"
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px dashed var(--border)',
                  }}
                >
                  <BookOpen size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                    No subjects assigned to <strong>{cl.name}</strong> yet.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                    Assign courses to this batch in the <strong>Courses</strong> page to allocate teachers here.
                  </p>
                </div>
              )}

              {/* Courses Grid / Cards for this Batch */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                gap: 12,
                alignItems: 'start',
              }}>
              {classCourses.map((course) => {
                const components = course.components || [];

                return (
                  <div
                    key={course.id}
                    className="card"
                    style={{
                      padding: 0,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                    }}
                  >
                    {/* Course Title Row */}
                    <div
                      style={{
                        padding: '12px 18px',
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(99,102,241,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--indigo)',
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {course.code ? course.code.slice(0, 3) : 'SUB'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{course.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {course.code || 'No code'} {course.department_name ? `• ${course.department_name}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {components.length} component{components.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Component Allocation Table */}
                    {components.length === 0 ? (
                      <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: 12 }}>
                        No components defined for this subject yet. Add components in the Courses page.
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '22%' }}>Component</th>
                              <th style={{ width: '24%' }}>Target / Group</th>
                              <th style={{ width: '38%' }}>Assigned Teacher</th>
                              <th style={{ width: '16%', textAlign: 'right' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {components.map((comp) => {
                              const isLab = comp.type === 'lab' || comp.type === 'tutorial';
                              const hasLabSplits = isLab && labGroups.length > 0;
                              const isLecture = comp.type === 'lecture';
                              const lectureMode = isLecture && lectureGroups.length > 0
                                ? getLectureMode(cl.id, comp.id, lectureGroups)
                                : 'whole';

                              // If it's a lab and has lab sub-groups, render a row per lab group
                              if (hasLabSplits) {
                                const hasMatchingLabGroup = filterStatus === 'all' || labGroups.some(group => {
                                  const groupAssignment = assignments.find(a => matchesAssignment(a, cl.id, comp.id, group.id));
                                  const groupAssigned = !!groupAssignment?.teacher_id;
                                  return filterStatus === 'assigned' ? groupAssigned : !groupAssigned;
                                });
                                if (!hasMatchingLabGroup) return null;

                                return (
                                  <React.Fragment key={comp.id}>
                                    {/* Lab/tutorial group summary row */}
                                    <tr style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          {COMP_ICONS[comp.type]}
                                          <div>
                                            <span className={`badge ${COMP_BADGES[comp.type]}`} style={{ textTransform: 'capitalize' }}>
                                              {comp.type}
                                            </span>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                              {comp.hours_per_week}h/wk {comp.duration_hours > 1 ? `(${comp.duration_hours}h sessions)` : ''}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--emerald)' }}>
                                          {labGroups.length} Lab Groups Split
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                          Individual faculty per group
                                        </div>
                                      </td>
                                      <td colSpan={2}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                          Assign faculty separately for each group below.
                                        </span>
                                      </td>
                                    </tr>

                                    {/* Sub-rows for each Lab Group */}
                                    {labGroups.map((g) => {
                                      const key = `${cl.id}_${comp.id}_${g.id}`;
                                      const asgn = assignments.find(a => matchesAssignment(a, cl.id, comp.id, g.id));
                                      const isAssigned = !!asgn?.teacher_id;
                                      const feedback = saveStatus[key];

                                      const showGroup = filterStatus === 'all' ||
                                        (filterStatus === 'assigned' && isAssigned) ||
                                        (filterStatus === 'unassigned' && !isAssigned);
                                      if (!showGroup) return null;

                                      return (
                                        <tr key={g.id} style={{ borderLeft: '3px solid var(--emerald)' }}>
                                          <td style={{ paddingLeft: 34 }}>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                              ↳ Lab Component
                                            </span>
                                          </td>
                                          <td>
                                            <span className="badge badge-emerald" style={{ fontWeight: 600 }}>
                                              {g.name}
                                            </span>
                                            {g.student_count > 0 && (
                                              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                                                ({g.student_count} students)
                                              </span>
                                            )}
                                          </td>
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <select
                                                className="form-select"
                                                value={asgn?.teacher_id || ''}
                                                onChange={(e) =>
                                                  handleTeacherChange(cl.id, comp.id, g.id, e.target.value)
                                                }
                                                style={{
                                                  fontSize: 12,
                                                  color: 'var(--text-primary)',
                                                  backgroundColor: 'var(--bg-elevated)',
                                                  borderColor: isAssigned ? 'rgba(16, 185, 129, 0.4)' : undefined,
                                                  background: isAssigned ? 'var(--bg-elevated)' : undefined,
                                                }}
                                              >
                                                <option value="">-- Unassigned (Select Faculty) --</option>
                                                {teachers.map((t) => (
                                                  <option key={t.id} value={t.id} style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}>
                                                    {t.name} {t.designation ? `• ${t.designation}` : ''}
                                                  </option>
                                                ))}
                                              </select>

                                              {feedback === 'saving' && (
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                  Saving...
                                                </span>
                                              )}
                                              {feedback === 'saved' && (
                                                <span style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}>
                                                  ✓ Saved
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td style={{ textAlign: 'right' }}>
                                            {isAssigned ? (
                                              <span className="badge badge-emerald" style={{ fontSize: 11 }}>
                                                ✓ Assigned
                                              </span>
                                            ) : (
                                              <span className="badge badge-amber" style={{ fontSize: 11 }}>
                                                Needs Faculty
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              }

                              // Whole-class component or lecture configured for group assignment
                              const key = `${cl.id}_${comp.id}_none`;
                              const asgn = assignments.find(a => matchesAssignment(a, cl.id, comp.id));
                              const feedback = saveStatus[key];

                              if (isLecture && lectureGroups.length > 0 && lectureMode === 'groups') {
                                const assignedGroupCount = lectureGroups.filter(group => assignments.some(
                                  assignment => matchesAssignment(assignment, cl.id, comp.id, group.id) && assignment.teacher_id
                                )).length;

                                const groupsAssigned = assignedGroupCount === lectureGroups.length;
                                if (filterStatus === 'assigned' && !groupsAssigned) return null;
                                if (filterStatus === 'unassigned' && groupsAssigned) return null;

                                return (
                                  <tr key={comp.id}>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {COMP_ICONS[comp.type]}
                                        <div>
                                          <span className={`badge ${COMP_BADGES[comp.type]}`} style={{ textTransform: 'capitalize' }}>
                                            {comp.type}
                                          </span>
                                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                            {comp.hours_per_week}h/wk {comp.duration_hours > 1 ? `(${comp.duration_hours}h sessions)` : ''}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        <select
                                          className="form-select"
                                          value="groups"
                                          onChange={() => switchLectureMode(cl.id, comp.id, lectureGroups, 'whole')}
                                          style={{ fontSize: 12 }}
                                        >
                                          <option value="whole">Whole class</option>
                                          <option value="groups">Lecture groups</option>
                                        </select>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                          {assignedGroupCount}/{lectureGroups.length} groups assigned
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {lectureGroups.map(group => {
                                          const groupAssignment = assignments.find(assignment =>
                                            matchesAssignment(assignment, cl.id, comp.id, group.id)
                                          );
                                          const groupKey = `${cl.id}_${comp.id}_${group.id}`;
                                          return (
                                            <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <span className="badge badge-indigo" style={{ minWidth: 52, textAlign: 'center' }}>{group.name}</span>
                                              <select
                                                className="form-select"
                                                value={groupAssignment?.teacher_id || ''}
                                                onChange={e => handleTeacherChange(cl.id, comp.id, group.id, e.target.value)}
                                                style={{ fontSize: 12, color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}
                                              >
                                                <option value="" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}>-- Select Faculty --</option>
                                                {teachers.map(t => (
                                                  <option key={t.id} value={t.id} style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}>{t.name} {t.designation ? `• ${t.designation}` : ''}</option>
                                                ))}
                                              </select>
                                              {saveStatus[groupKey] === 'saving' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving...</span>}
                                              {saveStatus[groupKey] === 'saved' && <span style={{ fontSize: 11, color: 'var(--emerald)' }}>✓</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      {assignedGroupCount === lectureGroups.length ? (
                                        <span className="badge badge-emerald">✓ Assigned</span>
                                      ) : (
                                        <span className="badge badge-amber">Needs Faculty</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              }

                              const isAssigned = !!asgn?.teacher_id;
                              if (filterStatus === 'assigned' && !isAssigned) return null;
                              if (filterStatus === 'unassigned' && isAssigned) return null;

                              return (
                                <tr key={comp.id}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {COMP_ICONS[comp.type]}
                                      <div>
                                        <span className={`badge ${COMP_BADGES[comp.type]}`} style={{ textTransform: 'capitalize' }}>
                                          {comp.type}
                                        </span>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                          {comp.hours_per_week}h/wk {comp.duration_hours > 1 ? `(${comp.duration_hours}h sessions)` : ''}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        {isLab ? 'Whole Class (No split)' : 'Whole Class'}
                                      </span>
                                      {isLecture && lectureGroups.length > 0 && (
                                        <select
                                          className="form-select"
                                          value="whole"
                                          onChange={() => switchLectureMode(cl.id, comp.id, lectureGroups, 'groups')}
                                          style={{ width: 125, fontSize: 11, height: 28 }}
                                        >
                                          <option value="whole">Whole class</option>
                                          <option value="groups">Lecture groups</option>
                                        </select>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <select
                                        className="form-select"
                                        value={asgn?.teacher_id || ''}
                                        onChange={(e) =>
                                          handleTeacherChange(cl.id, comp.id, null, e.target.value)
                                        }
                                        style={{
                                          fontSize: 12,
                                          color: 'var(--text-primary)',
                                          backgroundColor: 'var(--bg-elevated)',
                                          borderColor: isAssigned ? 'rgba(99, 102, 241, 0.4)' : undefined,
                                          background: isAssigned ? 'var(--bg-elevated)' : undefined,
                                        }}
                                      >
                                        <option value="" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}>-- Unassigned (Select Faculty) --</option>
                                        {teachers.map((t) => (
                                          <option key={t.id} value={t.id} style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}>
                                            {t.name} {t.designation ? `• ${t.designation}` : ''}
                                          </option>
                                        ))}
                                      </select>

                                      {feedback === 'saving' && (
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                          Saving...
                                        </span>
                                      )}
                                      {feedback === 'saved' && (
                                        <span style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}>
                                          ✓ Saved
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    {isAssigned ? (
                                      <span className="badge badge-emerald" style={{ fontSize: 11 }}>
                                        ✓ Assigned
                                      </span>
                                    ) : (
                                      <span className="badge badge-amber" style={{ fontSize: 11 }}>
                                        Needs Faculty
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          );
        })}

        {visibleClasses.length === 0 && (
          <div className="empty-state">
            <h3>No Batches / Classes Found</h3>
            <p>Create batches in the Classes page first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
