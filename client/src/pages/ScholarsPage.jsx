import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  Search,
  Mail,
  Building,
  Clock,
  GraduationCap,
  X,
  AlertCircle
} from 'lucide-react';

export default function ScholarsPage() {
  const [scholars, setScholars] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  // Modal
  const [modal, setModal] = useState(null); // 'add' | scholar object
  const [form, setForm] = useState({
    name: '',
    roll_no: '',
    department_id: '',
    email: '',
    max_hours_week: 12
  });
  const [error, setError] = useState('');

  const load = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [schList, deptList] = await Promise.all([
        api.getScholars(),
        api.getDepartments()
      ]);
      setScholars(schList);
      setDepartments(deptList);
    } catch (err) {
      console.error('Failed to load scholars:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, []);

  const openAdd = () => {
    setForm({
      name: '',
      roll_no: '',
      department_id: departments[0]?.id || '',
      email: '',
      max_hours_week: 12
    });
    setError('');
    setModal('add');
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      roll_no: s.roll_no || '',
      department_id: s.department_id || '',
      email: s.email || '',
      max_hours_week: s.max_hours_week || 12
    });
    setError('');
    setModal(s);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Scholar name is required');
      return;
    }

    try {
      if (modal === 'add') {
        await api.createScholar(form);
      } else {
        await api.updateScholar(modal.id, form);
      }
      setModal(null);
      load(false);
    } catch (err) {
      setError(err.error || 'Failed to save scholar');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete scholar "${name}"? They will be unassigned from all courses and timetable entries.`)) return;
    try {
      await api.deleteScholar(id);
      load(false);
    } catch (err) {
      alert(err.error || 'Failed to delete scholar');
    }
  };

  const filtered = scholars.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.roll_no && s.roll_no.toLowerCase().includes(search.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase()));
    const matchesDept = selectedDept === 'all' || String(s.department_id) === String(selectedDept);
    return matchesSearch && matchesDept;
  });

  const totalMaxHours = scholars.reduce((sum, s) => sum + (s.max_hours_week || 0), 0);
  const totalScheduledHours = scholars.reduce((sum, s) => sum + (s.scheduled_hours || 0), 0);

  if (loading) return <div className="loading"><div className="spinner" />Loading scholars...</div>;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Research Scholars & TAs</h2>
          <p>Manage PhD scholars and Teaching Assistants assigned to labs and tutorials under faculty supervision</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add Scholar
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
              <UserCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Scholars</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{scholars.length}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scheduled Hours</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{totalScheduledHours} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/ {totalMaxHours}h limit</span></div>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', color: 'var(--amber)' }}>
              <Building size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Departments</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{departments.length}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 220 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search by name, roll no, email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 30, height: 32, fontSize: 12 }}
              />
            </div>

            {departments.length > 0 && (
              <select
                className="form-select"
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                style={{ width: 'auto', height: 32, fontSize: 12 }}
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing <b>{filtered.length}</b> of <b>{scholars.length}</b> scholars
          </div>
        </div>

        {/* Table List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <p>No scholars found. Click "Add Scholar" above to create one.</p>
            </div>
          ) : (
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Scholar Name</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Roll No / ID</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Department</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Email</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Weekly Workload</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const pct = Math.min(100, Math.round(((s.scheduled_hours || 0) / (s.max_hours_week || 12)) * 100));
                  const isHigh = pct >= 90;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13 }}>
                        <div className="flex items-center gap-2">
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700
                          }}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{s.name}</div>
                            {s.assignment_count > 0 && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {s.assignment_count} course assignment{s.assignment_count > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {s.roll_no || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        {s.department_name ? (
                          <span className="badge badge-indigo" style={{ fontSize: 11 }}>
                            {s.department_name}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {s.email ? (
                          <div className="flex items-center gap-1">
                            <Mail size={12} />
                            <span>{s.email}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        <div style={{ width: 140 }}>
                          <div className="flex justify-between" style={{ fontSize: 11, marginBottom: 3 }}>
                            <span>{s.scheduled_hours || 0}h / {s.max_hours_week || 12}h</span>
                            <span style={{ color: isHigh ? 'var(--amber)' : 'var(--text-muted)' }}>{pct}%</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: isHigh ? 'var(--amber)' : 'var(--primary)',
                              borderRadius: 3, transition: 'width 0.3s'
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn btn-sm btn-secondary btn-icon"
                            onClick={() => openEdit(s)}
                            title="Edit Scholar"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger btn-icon"
                            onClick={() => handleDelete(s.id, s.name)}
                            title="Delete Scholar"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Add / Edit */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 460, width: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'add' ? 'Add Research Scholar / TA' : 'Edit Scholar'}</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error"><AlertCircle size={14} /> {error}</div>}

                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dr. Jane Scholar / Rahul Verma"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Roll Number / Scholar ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 23PHDCSE01"
                    value={form.roll_no}
                    onChange={e => setForm(f => ({ ...f, roll_no: e.target.value }))}
                  />
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
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="scholar@university.edu"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Teaching Hours / Week</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="40"
                    value={form.max_hours_week}
                    onChange={e => setForm(f => ({ ...f, max_hours_week: e.target.value }))}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Standard PhD scholar TA duty is usually 8–12 hours per week.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{modal === 'add' ? 'Add Scholar' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
