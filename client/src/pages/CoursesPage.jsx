import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAcademicTerm } from '../context/AcademicTermContext';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  BookOpen,
  FlaskConical,
  Lightbulb,
  CheckCircle2,
  Search,
  Sparkles,
  Layers,
  GraduationCap,
  ListPlus,
  ExternalLink,
  Calendar,
  Pencil
} from 'lucide-react';

export default function CoursesPage() {
  const { activeTerm, activeTermObj } = useAcademicTerm();

  // Tab State: 'offerings' (Term Allocations) | 'catalog' (Master Course Directory)
  const [activeTab, setActiveTab] = useState('offerings');

  // Master catalog & metadata
  const [catalogCourses, setCatalogCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [scholars, setScholars] = useState([]);
  const [classSemesters, setClassSemesters] = useState([]);

  // Term Offerings & Assignments
  const [offerings, setOfferings] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [classGroupsMap, setClassGroupsMap] = useState({});

  // Filters & State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  // Micro save status for inline assignment changes: { [key]: 'saving' | 'saved' }
  const [saveStatus, setSaveStatus] = useState({});

  // Modals
  const [masterModal, setMasterModal] = useState(null); // 'add' | course object for catalog
  const [offeringModal, setOfferingModal] = useState(false); // Modal to assign catalog courses to selected batch
  const [selectedCatalogCourseIds, setSelectedCatalogCourseIds] = useState([]);

  const [form, setForm] = useState({
    name: '',
    code: '',
    short_name: '',
    department_id: '',
    semester: '',
  });

  // Initial components in Add Master Course Modal
  const [hasLecture, setHasLecture] = useState(true);
  const [lectureForm, setLectureForm] = useState({ hours_per_week: 3, duration_hours: 1 });
  const [hasLab, setHasLab] = useState(false);
  const [labForm, setLabForm] = useState({ hours_per_week: 2, duration_hours: 2, requires_lab: true });
  const [hasTutorial, setHasTutorial] = useState(false);
  const [tutForm, setTutForm] = useState({ hours_per_week: 1, duration_hours: 1 });

  // Individual Component Modal (for catalog)
  const [compModal, setCompModal] = useState(null);
  const [compForm, setCompForm] = useState({ type: 'lecture', hours_per_week: 3, duration_hours: 1, requires_lab: false });
  const [error, setError] = useState('');

  // ─── Data Loading ──────────────────────────────────────────────────────────
  const loadAll = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [crsList, deptList, clsList, tchrList, schList, csList, offList, asgnList] = await Promise.all([
        api.getCourses(),
        api.getDepartments(),
        api.getClasses(),
        api.getTeachers(),
        api.getScholars(),
        api.getClassSemesters(activeTerm),
        api.getCourseOfferings({ academic_term: activeTerm }),
        api.getAssignments({ academic_term: activeTerm }),
      ]);

      setCatalogCourses(crsList);
      setDepartments(deptList);
      setClasses(clsList);
      setTeachers(tchrList);
      setScholars(schList);
      setClassSemesters(csList);
      setOfferings(offList);
      setAssignments(asgnList);

      // Default selected class - check saved or find one with offerings or fallback to first
      const savedClassId = localStorage.getItem('timetable_selected_class');
      const classWithOfferings = clsList.find(c => offList.some(o => o.class_id === c.id));
      const targetClass = clsList.find(c => String(c.id) === String(savedClassId)) || classWithOfferings || clsList[0];
      
      if (targetClass && (!selectedClassId || !clsList.some(c => String(c.id) === String(selectedClassId)))) {
        setSelectedClassId(String(targetClass.id));
      }

      // Load groups for all classes
      const groupEntries = await Promise.all(
        clsList.map(async (cl) => {
          const detail = await api.getClass(cl.id);
          return [cl.id, detail.groups || []];
        })
      );
      setClassGroupsMap(Object.fromEntries(groupEntries));
    } catch (err) {
      console.error('Failed to load courses & offerings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(true);
  }, [activeTerm]);

  const toggle = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  // ─── Allocation Handler ───────────────────────────────────────────────────
  const handleAllocationChange = async (classId, componentId, groupId, teacherId, scholarId) => {
    const key = `${classId}_${componentId}_${groupId || 'none'}`;
    setFeedback(key, 'saving');

    const cId = parseInt(classId);
    const compId = parseInt(componentId);
    const gId = groupId ? parseInt(groupId) : null;
    const tId = teacherId ? parseInt(teacherId) : null;
    const sId = scholarId ? parseInt(scholarId) : null;

    // Optimistically update assignments state immediately
    setAssignments(prev => {
      const existingIdx = prev.findIndex(
        a => Number(a.class_id) === cId &&
          Number(a.course_component_id) === compId &&
          (gId ? Number(a.group_id) === gId : a.group_id == null)
      );

      if (!tId && !sId) {
        if (existingIdx !== -1) {
          const next = [...prev];
          next.splice(existingIdx, 1);
          return next;
        }
        return prev;
      }

      const updatedItem = {
        ...(existingIdx !== -1 ? prev[existingIdx] : {}),
        academic_term: activeTerm,
        class_id: cId,
        course_component_id: compId,
        group_id: gId,
        teacher_id: tId,
        scholar_id: sId,
      };

      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = updatedItem;
        return next;
      } else {
        return [...prev, updatedItem];
      }
    });

    try {
      await api.assignTeacher({
        academic_term: activeTerm,
        class_id: cId,
        course_component_id: compId,
        group_id: gId,
        teacher_id: tId,
        scholar_id: sId,
      });

      const updatedAssignments = await api.getAssignments({ academic_term: activeTerm });
      setAssignments(updatedAssignments);
      setFeedback(key, 'saved');
    } catch (err) {
      console.error('Allocation failed:', err);
      // Re-sync with server on error
      const updatedAssignments = await api.getAssignments({ academic_term: activeTerm }).catch(() => []);
      setAssignments(updatedAssignments);
      alert(err.error || 'Failed to update assignment');
      setFeedback(key, null);
    }
  };


  // ─── Course Offerings Handlers (Assign catalog courses to batch) ─────────
  const handleAssignCoursesToBatch = async (e) => {
    e.preventDefault();
    if (!selectedClassId || selectedCatalogCourseIds.length === 0) return;

    try {
      await api.createCourseOffering({
        academic_term: activeTerm,
        class_id: parseInt(selectedClassId),
        course_ids: selectedCatalogCourseIds,
      });
      setOfferingModal(false);
      setSelectedCatalogCourseIds([]);
      const updatedOfferings = await api.getCourseOfferings({ academic_term: activeTerm });
      setOfferings(updatedOfferings);
    } catch (err) {
      alert(err.error || 'Failed to assign courses to batch');
    }
  };

  const handleRemoveOffering = async (offeringId, courseName) => {
    if (!confirm(`Remove "${courseName}" from this batch for academic term ${activeTerm}? All scheduled timetable entries and allocations for this batch in this term will be removed.`)) return;

    try {
      await api.deleteCourseOffering(offeringId);
      const updatedOfferings = await api.getCourseOfferings({ academic_term: activeTerm });
      setOfferings(updatedOfferings);
      const updatedAssignments = await api.getAssignments({ academic_term: activeTerm });
      setAssignments(updatedAssignments);
    } catch (err) {
      alert(err.error || 'Failed to remove course offering');
    }
  };

  // ─── Master Catalog Modal Handlers ─────────────────────────────────────────
  const openAddMasterCourse = () => {
    setForm({
      name: '',
      code: '',
      short_name: '',
      department_id: departments[0]?.id || '',
      semester: '',
    });
    setHasLecture(true);
    setLectureForm({ hours_per_week: 3, duration_hours: 1 });
    setHasLab(false);
    setLabForm({ hours_per_week: 2, duration_hours: 2, requires_lab: true });
    setHasTutorial(false);
    setTutForm({ hours_per_week: 1, duration_hours: 1 });
    setError('');
    setMasterModal('add');
  };

  const openEditMasterCourse = (c) => {
    setForm({
      name: c.name,
      code: c.code || '',
      short_name: c.short_name || '',
      department_id: c.department_id || '',
      semester: c.semester || '',
    });
    const comps = c.components || [];
    const lec = comps.find(cp => cp.type === 'lecture');
    const lab = comps.find(cp => cp.type === 'lab');
    const tut = comps.find(cp => cp.type === 'tutorial');

    setHasLecture(!!lec);
    setLectureForm({
      hours_per_week: lec ? lec.hours_per_week : 3,
      duration_hours: lec ? lec.duration_hours : 1,
    });

    setHasLab(!!lab);
    setLabForm({
      hours_per_week: lab ? lab.hours_per_week : 2,
      duration_hours: lab ? lab.duration_hours : 2,
      requires_lab: lab ? !!lab.requires_lab : true,
    });

    setHasTutorial(!!tut);
    setTutForm({
      hours_per_week: tut ? tut.hours_per_week : 1,
      duration_hours: tut ? tut.duration_hours : 1,
    });

    setError('');
    setMasterModal(c);
  };

  const handleMasterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Course name is required');
      return;
    }

    const components = [];
    if (hasLecture) {
      components.push({
        type: 'lecture',
        hours_per_week: parseInt(lectureForm.hours_per_week) || 1,
        duration_hours: parseInt(lectureForm.duration_hours) || 1,
        requires_lab: false,
      });
    }
    if (hasLab) {
      components.push({
        type: 'lab',
        hours_per_week: parseInt(labForm.hours_per_week) || 1,
        duration_hours: parseInt(labForm.duration_hours) || 1,
        requires_lab: labForm.requires_lab,
      });
    }
    if (hasTutorial) {
      components.push({
        type: 'tutorial',
        hours_per_week: parseInt(tutForm.hours_per_week) || 1,
        duration_hours: parseInt(tutForm.duration_hours) || 1,
        requires_lab: false,
      });
    }

    try {
      if (masterModal === 'add') {
        await api.createCourse({ ...form, components });
      } else {
        await api.updateCourse(masterModal.id, { ...form, components });
      }
      setMasterModal(null);
      loadAll(false);
    } catch (err) {
      setError(err.error || 'Failed to save course in catalog');
    }
  };

  const handleDeleteMasterCourse = async (id) => {
    if (!confirm('Delete this course from the master catalog? All components and historical offerings will be removed.')) return;
    await api.deleteCourse(id);
    loadAll(false);
  };

  const openEditComponent = (course, comp) => {
    setCompModal({ courseId: course.id, compId: comp.id, courseName: course.name });
    setCompForm({
      type: comp.type,
      hours_per_week: comp.hours_per_week,
      duration_hours: comp.duration_hours,
      requires_lab: !!comp.requires_lab
    });
    setError('');
  };

  const handleComponentSubmit = async (e) => {
    e.preventDefault();
    if (!compModal) return;
    try {
      await api.updateComponent(compModal.courseId, compModal.compId, {
        type: compForm.type,
        hours_per_week: parseInt(compForm.hours_per_week) || 1,
        duration_hours: parseInt(compForm.duration_hours) || 1,
        requires_lab: compForm.requires_lab
      });
      setCompModal(null);
      loadAll(false);
    } catch (err) {
      alert(err.error || 'Failed to update component');
    }
  };

  const handleDeleteComponent = async (courseId, compId, type) => {
    if (!confirm(`Delete ${type.toUpperCase()} component? Any associated teacher allocations and timetable entries will be removed.`)) return;
    try {
      await api.deleteComponent(courseId, compId);
      loadAll(false);
    } catch (err) {
      alert(err.error || 'Failed to delete component');
    }
  };

  const COMP_BADGES = {
    lecture: 'badge-indigo',
    lab: 'badge-emerald',
    tutorial: 'badge-amber'
  };

  const COMP_ICONS = {
    lecture: <BookOpen size={13} style={{ color: 'var(--indigo)' }} />,
    lab: <FlaskConical size={13} style={{ color: 'var(--emerald)' }} />,
    tutorial: <Lightbulb size={13} style={{ color: 'var(--amber)' }} />,
  };

  if (loading) return <div className="loading"><div className="spinner" />Loading courses &amp; offerings...</div>;

  // Filter offerings for selected class
  const classOfferings = offerings.filter(o => String(o.class_id) === String(selectedClassId));
  const activeClassObj = classes.find(c => String(c.id) === String(selectedClassId));
  const activeClassSemesterObj = classSemesters.find(cs => String(cs.class_id) === String(selectedClassId));
  const currentSemesterNum = activeClassSemesterObj?.semester || activeClassObj?.semester || 1;

  const currentClassGroups = classGroupsMap[selectedClassId] || [];
  const currentLectureGroups = currentClassGroups.filter(g => g.group_type === 'lecture');
  const currentLabGroups = currentClassGroups.filter(g => g.group_type === 'lab');

  // Filter master catalog courses by search
  const filteredCatalogCourses = catalogCourses.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.short_name && c.short_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fade-in">
      {/* ─── Page Header ────────────────────────────────────────────── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Courses &amp; Faculty Allocations</h2>
          <p>
            {activeTab === 'offerings'
              ? `Course offerings and instructor allocations for Semester ${activeTerm}`
              : 'Institutional Master Course Catalog — courses defined once and reusable across terms'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: 2,
          }}>
            <button
              className={`btn btn-sm ${activeTab === 'offerings' ? 'btn-primary' : ''}`}
              style={{ borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12 }}
              onClick={() => setActiveTab('offerings')}
            >
              <Layers size={13} /> Batch Offerings ({activeTerm})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'catalog' ? 'btn-primary' : ''}`}
              style={{ borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12 }}
              onClick={() => setActiveTab('catalog')}
            >
              <BookOpen size={13} /> Master Catalog ({catalogCourses.length})
            </button>
          </div>

          {activeTab === 'catalog' && (
            <button className="btn btn-primary" onClick={openAddMasterCourse}>
              <Plus size={14} /> Add to Catalog
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* ─── TAB 1: BATCH COURSE OFFERINGS & ALLOCATIONS ────────────── */}
        {activeTab === 'offerings' && (
          <div>
            {/* Batch Selector Card */}
            <div className="card" style={{ padding: '12px 18px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GraduationCap size={16} style={{ color: 'var(--indigo)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Select Batch / Class:</span>
                  </div>

                  <select
                    className="form-select"
                    value={selectedClassId}
                    onChange={e => {
                      setSelectedClassId(e.target.value);
                      localStorage.setItem('timetable_selected_class', e.target.value);
                    }}
                    style={{ width: 'auto', minWidth: 200, fontSize: 13, fontWeight: 600 }}
                  >
                    {classes.map(cl => {
                      const sem = classSemesters.find(cs => cs.class_id === cl.id)?.semester || cl.semester;
                      return (
                        <option key={cl.id} value={cl.id}>
                          {cl.name} (Semester {sem || '—'})
                        </option>
                      );
                    })}
                  </select>

                  {activeClassObj && (
                    <span className="badge badge-indigo" style={{ fontSize: 11 }}>
                      Studying Semester {currentSemesterNum} in Term {activeTerm}
                    </span>
                  )}
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const alreadyAssigned = new Set(classOfferings.map(o => o.course_id));
                    // If none assigned yet in this term, auto-select courses matching the batch's semester
                    if (alreadyAssigned.size === 0) {
                      catalogCourses.forEach(c => {
                        if (c.semester == currentSemesterNum) {
                          alreadyAssigned.add(c.id);
                        }
                      });
                    }
                    setSelectedCatalogCourseIds(Array.from(alreadyAssigned));
                    setOfferingModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ListPlus size={14} /> Assign Courses from Catalog
                </button>
              </div>
            </div>

            {/* Courses Offered to this Batch */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Courses Offered to {activeClassObj?.name || 'Class'} in {activeTerm} ({classOfferings.length} courses)
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Assigned instructors will supervise timetable sessions for this batch
                </span>
              </div>

              {classOfferings.map(offering => {
                const codeStr = offering.code || 'NO-CODE';
                const nameStr = offering.name;
                const shortStr = offering.short_name || offering.code || '—';
                const headerDisplay = `${codeStr}, ${nameStr}, (${shortStr})`;

                return (
                  <div key={offering.offering_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Course Row Header */}
                    <div
                      className="flex items-center justify-between"
                      style={{
                        padding: '12px 18px',
                        cursor: 'pointer',
                        background: expanded[offering.offering_id] ? 'var(--bg-elevated)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onClick={() => toggle(offering.offering_id)}
                    >
                      <div className="flex items-center gap-3">
                        {expanded[offering.offering_id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{headerDisplay}</span>
                            <span className="badge badge-indigo" style={{ fontSize: 10, padding: '2px 6px' }}>
                              Sem {offering.semester || currentSemesterNum}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {offering.department_name ? `${offering.department_name} • ` : ''}
                            <span>{offering.components ? `${offering.components.length} components` : 'No components'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-sm btn-danger"
                          style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                          onClick={() => handleRemoveOffering(offering.offering_id, offering.name)}
                          title="Remove course from this semester"
                        >
                          <Trash2 size={11} /> Unassign from Batch
                        </button>
                      </div>
                    </div>

                    {/* Components & Allocation Table */}
                    {expanded[offering.offering_id] && (
                      <div style={{ background: 'var(--bg-elevated)', padding: '12px 18px 18px 36px', borderTop: '1px solid var(--border)' }}>
                        {(!offering.components || offering.components.length === 0) ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            No components defined in Master Catalog for this course.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {offering.components.map(comp => {
                              const isLecture = comp.type === 'lecture';
                              const isLab = comp.type === 'lab';
                              const isTutorial = comp.type === 'tutorial';

                              const relevantGroups = isLecture
                                ? (currentLectureGroups.length > 0 ? currentLectureGroups : [])
                                : (currentLabGroups.length > 0 ? currentLabGroups : []);

                              return (
                                <div
                                  key={comp.id}
                                  style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    padding: '12px 16px'
                                  }}
                                >
                                  {/* Component Header */}
                                  <div className="flex items-center justify-between" style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                                    <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                                      {COMP_ICONS[comp.type]}
                                      <span className={`badge ${COMP_BADGES[comp.type]}`} style={{ fontWeight: 600 }}>
                                        {comp.type.toUpperCase()}
                                      </span>
                                      <span style={{ fontSize: 12, fontWeight: 600 }}>{comp.hours_per_week}h/week</span>
                                      {comp.duration_hours > 1 && (
                                        <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
                                          ({comp.duration_hours}h sessions)
                                        </span>
                                      )}
                                      {comp.requires_lab && (
                                        <span className="badge badge-amber" style={{ fontSize: 10 }}>Requires Lab</span>
                                      )}
                                      {isLecture && (
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                          • {currentLectureGroups.length > 0 ? `Lecture groups (${currentLectureGroups.map(g => g.name).join(', ')})` : 'Whole class lecture'}
                                        </span>
                                      )}
                                      {(isLab || isTutorial) && (
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                          • {currentLabGroups.length > 0 ? `Lab sub-groups (${currentLabGroups.map(g => g.name).join(', ')})` : 'Whole class lab/tutorial'}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        className="btn btn-sm btn-secondary"
                                        style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                                        onClick={() => openEditComponent({ id: offering.course_id || offering.id, name: offering.name }, comp)}
                                        title="Edit this component (hours, duration, lab)"
                                      >
                                        <Pencil size={11} /> Edit Component
                                      </button>
                                      <button
                                        className="btn btn-sm btn-danger btn-icon"
                                        style={{ height: 24, width: 24, padding: 0 }}
                                        onClick={() => handleDeleteComponent(offering.course_id || offering.id, comp.id, comp.type)}
                                        title="Delete this component"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Allocations Table */}
                                  <div>
                                    {relevantGroups.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {relevantGroups.map(grp => {
                                          const asgn = assignments.find(
                                            a => Number(a.class_id) === Number(selectedClassId) &&
                                              Number(a.course_component_id) === Number(comp.id) &&
                                              Number(a.group_id) === Number(grp.id)
                                          );
                                          const key = `${selectedClassId}_${comp.id}_${grp.id}`;
                                          const status = saveStatus[key];

                                          return (
                                            <div
                                              key={grp.id}
                                              style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'minmax(130px, 170px) 1fr 1fr 40px',
                                                gap: 14,
                                                alignItems: 'center',
                                                background: 'var(--bg-elevated)',
                                                padding: '10px 14px',
                                                borderRadius: 6,
                                                border: '1px solid var(--border)'
                                              }}
                                            >
                                              <div>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{grp.name}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                                                  ({grp.group_type || 'group'})
                                                </span>
                                              </div>

                                              {/* Teacher Selector */}
                                              <div>
                                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                                                  Faculty / Teacher
                                                </label>
                                                <select
                                                  className="form-select form-select-sm"
                                                  value={asgn?.teacher_id || ''}
                                                  onChange={e => handleAllocationChange(
                                                    selectedClassId,
                                                    comp.id,
                                                    grp.id,
                                                    e.target.value || null,
                                                    asgn?.scholar_id || null
                                                  )}
                                                >
                                                  <option value="">Unassigned (None)</option>
                                                  {teachers.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name} ({t.designation || 'Faculty'})</option>
                                                  ))}
                                                </select>
                                              </div>

                                              {/* Scholar Selector */}
                                              <div>
                                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                                                  Research Scholar / TA
                                                </label>
                                                <select
                                                  className="form-select form-select-sm"
                                                  value={asgn?.scholar_id || ''}
                                                  onChange={e => handleAllocationChange(
                                                    selectedClassId,
                                                    comp.id,
                                                    grp.id,
                                                    asgn?.teacher_id || null,
                                                    e.target.value || null
                                                  )}
                                                >
                                                  <option value="">None (No Scholar)</option>
                                                  {scholars.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} {s.roll_no ? `(${s.roll_no})` : ''}</option>
                                                  ))}
                                                </select>
                                              </div>

                                              {/* Feedback */}
                                              <div style={{ textAlign: 'center' }}>
                                                {status === 'saving' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>...</span>}
                                                {status === 'saved' && <span style={{ fontSize: 12, color: 'var(--emerald)' }}>✓</span>}
                                                {!status && (asgn?.teacher_id || asgn?.scholar_id) && (
                                                  <CheckCircle2 size={15} style={{ color: 'var(--emerald)', margin: '0 auto' }} />
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      /* Whole Class Mode */
                                      (() => {
                                        const asgn = assignments.find(
                                          a => Number(a.class_id) === Number(selectedClassId) &&
                                            Number(a.course_component_id) === Number(comp.id) &&
                                            a.group_id == null
                                        );
                                        const key = `${selectedClassId}_${comp.id}_none`;
                                        const status = saveStatus[key];

                                        return (
                                          <div>
                                            {(isLab || isTutorial) && currentLabGroups.length === 0 && (
                                              <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 6 }}>
                                                💡 Tip: No lab groups found for this class. You can create lab groups on the Classes page, or assign whole class below:
                                              </div>
                                            )}
                                            <div
                                              style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'minmax(130px, 170px) 1fr 1fr 40px',
                                                gap: 14,
                                                alignItems: 'center',
                                                background: 'var(--bg-elevated)',
                                                padding: '10px 14px',
                                                borderRadius: 6,
                                                border: '1px solid var(--border)'
                                              }}
                                            >
                                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                                Whole Class ({activeClassObj?.name})
                                              </div>

                                              {/* Teacher Selector */}
                                              <div>
                                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                                                  Faculty / Teacher
                                                </label>
                                                <select
                                                  className="form-select form-select-sm"
                                                  value={asgn?.teacher_id || ''}
                                                  onChange={e => handleAllocationChange(
                                                    selectedClassId,
                                                    comp.id,
                                                    null,
                                                    e.target.value || null,
                                                    asgn?.scholar_id || null
                                                  )}
                                                >
                                                  <option value="">Unassigned (None)</option>
                                                  {teachers.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name} ({t.designation || 'Faculty'})</option>
                                                  ))}
                                                </select>
                                              </div>

                                              {/* Scholar Selector */}
                                              <div>
                                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>
                                                  Research Scholar / TA
                                                </label>
                                                <select
                                                  className="form-select form-select-sm"
                                                  value={asgn?.scholar_id || ''}
                                                  onChange={e => handleAllocationChange(
                                                    selectedClassId,
                                                    comp.id,
                                                    null,
                                                    asgn?.teacher_id || null,
                                                    e.target.value || null
                                                  )}
                                                >
                                                  <option value="">None (No Scholar)</option>
                                                  {scholars.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} {s.roll_no ? `(${s.roll_no})` : ''}</option>
                                                  ))}
                                                </select>
                                              </div>

                                              {/* Feedback */}
                                              <div style={{ textAlign: 'center' }}>
                                                {status === 'saving' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>...</span>}
                                                {status === 'saved' && <span style={{ fontSize: 12, color: 'var(--emerald)' }}>✓</span>}
                                                {!status && (asgn?.teacher_id || asgn?.scholar_id) && (
                                                  <CheckCircle2 size={15} style={{ color: 'var(--emerald)', margin: '0 auto' }} />
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {classOfferings.length === 0 && (
                <div className="empty-state" style={{ padding: 36 }}>
                  <h3>No courses assigned to this batch in {activeTerm}</h3>
                  <p>Click "Assign Courses from Catalog" above to select courses for this batch.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: MASTER COURSE CATALOG ─────────────────────────────── */}
        {activeTab === 'catalog' && (
          <div>
            {/* Search Bar */}
            <div className="card" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 240, maxWidth: 360 }}>
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search course code, name, shortform..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ height: 32, fontSize: 12 }}
                />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Master Catalog contains <b>{filteredCatalogCourses.length}</b> courses • Defined once and reusable in any semester.
              </div>
            </div>

            {/* Master Courses Table / List */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {filteredCatalogCourses.map(c => {
                const codeStr = c.code || 'NO-CODE';
                const nameStr = c.name;
                const shortStr = c.short_name || c.code || '—';
                const headerDisplay = `${codeStr}, ${nameStr}, (${shortStr})`;

                return (
                  <div key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div
                      className="flex items-center justify-between"
                      style={{
                        padding: '14px 18px',
                        cursor: 'pointer',
                        background: expanded[`cat_${c.id}`] ? 'var(--bg-elevated)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onClick={() => toggle(`cat_${c.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        {expanded[`cat_${c.id}`] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{headerDisplay}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {c.department_name ? `${c.department_name} • ` : ''}
                            {c.semester ? `Semester ${c.semester} • ` : ''}
                            <span>{c.components ? `${c.components.length} components` : `${c.component_count || 0} components`}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openEditMasterCourse(c)}
                          title="Edit course details"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger btn-icon"
                          onClick={() => handleDeleteMasterCourse(c.id)}
                          title="Delete course from catalog"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Components Details */}
                    {expanded[`cat_${c.id}`] && (
                      <div style={{ background: 'var(--bg-elevated)', padding: '12px 18px 18px 36px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {(c.components || []).map(comp => (
                            <div
                              key={comp.id}
                              style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 6,
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                            >
                              {COMP_ICONS[comp.type]}
                              <span className={`badge ${COMP_BADGES[comp.type]}`}>{comp.type.toUpperCase()}</span>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{comp.hours_per_week}h/wk</span>
                              {comp.duration_hours > 1 && (
                                <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
                                  ({comp.duration_hours}h sessions)
                                </span>
                              )}
                              {comp.requires_lab && (
                                <span className="badge badge-amber" style={{ fontSize: 10 }}>Lab Required</span>
                              )}
                              <button
                                className="btn btn-sm btn-secondary btn-icon"
                                style={{ width: 22, height: 22, padding: 0, marginLeft: 4 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditComponent(c, comp);
                                }}
                                title="Edit component"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                className="btn btn-sm btn-danger btn-icon"
                                style={{ width: 22, height: 22, padding: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteComponent(c.id, comp.id, comp.type);
                                }}
                                title="Delete component"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredCatalogCourses.length === 0 && (
                <div className="empty-state" style={{ padding: 36 }}>
                  <p>No courses in master catalog. Click "Add to Catalog" to create institutional courses.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: Assign Catalog Courses to Batch in this Term ──────── */}
      {offeringModal && (
        <div className="modal-overlay" onClick={() => setOfferingModal(false)}>
          <div className="modal" style={{ maxWidth: 560, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Assign Courses to {activeClassObj?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Academic Term: <b>{activeTerm}</b> • Semester {currentSemesterNum}
                </div>
              </div>
              <button className="btn btn-icon btn-secondary" onClick={() => setOfferingModal(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleAssignCoursesToBatch}>
              <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Select the courses from the master catalog that {activeClassObj?.name} is taking this semester:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {catalogCourses
                    .sort((a, b) => {
                      // Sort by semester match first, then by name
                      const aMatch = a.semester == currentSemesterNum ? -1 : 1;
                      const bMatch = b.semester == currentSemesterNum ? -1 : 1;
                      if (aMatch !== bMatch) return aMatch - bMatch;
                      return a.name.localeCompare(b.name);
                    })
                    .map(crs => {
                    const isChecked = selectedCatalogCourseIds.includes(crs.id);
                    const isSemesterMatch = crs.semester == currentSemesterNum;
                    return (
                      <label
                        key={crs.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          background: isChecked ? 'rgba(99,102,241,0.08)' : 'var(--bg-elevated)',
                          border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          opacity: (crs.semester && !isSemesterMatch && !isChecked) ? 0.5 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedCatalogCourseIds(prev => [...prev, crs.id]);
                            } else {
                              setSelectedCatalogCourseIds(prev => prev.filter(id => id !== crs.id));
                            }
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {crs.code || 'CODE'}, {crs.name}, ({crs.short_name || crs.code || '—'})
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {crs.department_name ? `${crs.department_name} • ` : ''}
                            {(crs.components || []).map(comp => comp.type).join(', ') || 'No components'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setOfferingModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Batch Courses ({selectedCatalogCourseIds.length} selected)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Add / Edit Master Catalog Course ──────────────────── */}
      {masterModal && (
        <div className="modal-overlay" onClick={() => setMasterModal(null)}>
          <div className="modal" style={{ maxWidth: 540, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{masterModal === 'add' ? 'Add Course to Master Catalog' : 'Edit Catalog Course'}</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setMasterModal(null)}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleMasterSubmit}>
              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Course Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. CSN5003"
                      value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Shortform (Abbreviation) *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. SE, TOC, OS"
                      value={form.short_name}
                      onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Course Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Software Engineering"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Displayed as: <b>{form.code || 'CODE'}, {form.name || 'Course Name'}, ({form.short_name || 'SHORT'})</b>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={form.department_id}
                    onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">No Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Semester Tag (Optional)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1" max="10"
                    placeholder="e.g. 4"
                    value={form.semester}
                    onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Link this course to a specific semester to automatically filter it when assigning teachers.
                  </div>
                </div>

                {/* Course Components Configuration */}
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <label className="form-label" style={{ marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
                    Course Components (Lectures, Labs, Tutorials)
                  </label>

                    {/* Lecture */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                      <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={hasLecture}
                          onChange={e => setHasLecture(e.target.checked)}
                        />
                        <BookOpen size={14} style={{ color: 'var(--indigo)' }} />
                        Lecture Component
                      </label>
                      {hasLecture && (
                        <div className="form-row" style={{ marginTop: 10 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Hours / Week</label>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="10"
                              value={lectureForm.hours_per_week}
                              onChange={e => setLectureForm(f => ({ ...f, hours_per_week: e.target.value }))}
                            />
                          </div>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Session Duration (hrs)</label>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="4"
                              value={lectureForm.duration_hours}
                              onChange={e => setLectureForm(f => ({ ...f, duration_hours: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lab */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                      <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={hasLab}
                          onChange={e => setHasLab(e.target.checked)}
                        />
                        <FlaskConical size={14} style={{ color: 'var(--emerald)' }} />
                        Lab Component (Practical)
                      </label>
                      {hasLab && (
                        <div className="form-row" style={{ marginTop: 10 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Hours / Week</label>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="10"
                              value={labForm.hours_per_week}
                              onChange={e => setLabForm(f => ({ ...f, hours_per_week: e.target.value }))}
                            />
                          </div>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Session Duration (hrs)</label>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="4"
                              value={labForm.duration_hours}
                              onChange={e => setLabForm(f => ({ ...f, duration_hours: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tutorial */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                      <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={hasTutorial}
                          onChange={e => setHasTutorial(e.target.checked)}
                        />
                        <Lightbulb size={14} style={{ color: 'var(--amber)' }} />
                        Tutorial Component
                      </label>
                      {hasTutorial && (
                        <div className="form-row" style={{ marginTop: 10 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Hours / Week</label>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="10"
                              value={tutForm.hours_per_week}
                              onChange={e => setTutForm(f => ({ ...f, hours_per_week: e.target.value }))}
                            />
                          </div>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Session Duration (hrs)</label>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="4"
                              value={tutForm.duration_hours}
                              onChange={e => setTutForm(f => ({ ...f, duration_hours: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setMasterModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{masterModal === 'add' ? 'Add Course to Catalog' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── MODAL 3: Edit Course Component ───────────────────────────── */}
      {compModal && (
        <div className="modal-overlay" onClick={() => setCompModal(null)}>
          <div className="modal" style={{ maxWidth: 440, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Edit Component: {compForm.type?.toUpperCase()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Course: <b>{compModal.courseName}</b>
                </div>
              </div>
              <button className="btn btn-icon btn-secondary" onClick={() => setCompModal(null)}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleComponentSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Component Type</label>
                  <select
                    className="form-select"
                    value={compForm.type}
                    onChange={e => setCompForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab (Practical)</option>
                    <option value="tutorial">Tutorial</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Hours / Week *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max="15"
                      value={compForm.hours_per_week}
                      onChange={e => setCompForm(f => ({ ...f, hours_per_week: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Session Duration (hrs) *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max="5"
                      value={compForm.duration_hours}
                      onChange={e => setCompForm(f => ({ ...f, duration_hours: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={compForm.requires_lab}
                      onChange={e => setCompForm(f => ({ ...f, requires_lab: e.target.checked }))}
                    />
                    Requires Dedicated Lab / Computer Lab Room
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCompModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Component</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
