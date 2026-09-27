import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Trash2, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
const PERIODS = [1,2,3,4,5,6,7,8];
const PERIOD_TIMES = {1:'8–9',2:'9–10',3:'10–11',4:'11–12',5:'13–14',6:'14–15',7:'15–16',8:'16–17'};
const STATUS_CYCLE = { available: 'preferred', preferred: 'blocked', blocked: 'available' };

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // 'add' | teacher obj
  const [avail, setAvail]   = useState(null); // teacher for availability
  const [availData, setAvailData] = useState({});
  const [form, setForm]     = useState({ name:'', designation:'', department_id:'', max_hours_week:18 });
  const [error, setError]   = useState('');

  const load = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    Promise.all([api.getTeachers(), api.getDepartments()])
      .then(([t,d]) => { setTeachers(t); setDepartments(d); })
      .finally(() => setLoading(false));
  };
  useEffect(() => load(true), []);

  const openAdd = () => {
    setForm({ name:'', designation:'', department_id: departments[0]?.id || '', max_hours_week:18 });
    setError('');
    setModal('add');
  };
  const openEdit = t => {
    setForm({ name: t.name, designation: t.designation||'', department_id: t.department_id||'', max_hours_week: t.max_hours_week });
    setError('');
    setModal(t);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      if (modal === 'add') { await api.createTeacher(form); }
      else { await api.updateTeacher(modal.id, form); }
      setModal(null);
      load(false);
    } catch(err) { setError(err.error || 'Error saving teacher'); }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this teacher?')) return;
    await api.deleteTeacher(id);
    load(false);
  };

  const openAvail = async t => {
    const data = await api.getTeacher(t.id);
    const map = {};
    (data.availability || []).forEach(a => { map[`${a.day}-${a.period}`] = a.status; });
    // Fill defaults
    DAYS.forEach(d => PERIODS.forEach(p => { if (!map[`${d}-${p}`]) map[`${d}-${p}`] = 'available'; }));
    setAvailData(map);
    setAvail(t);
  };

  const cycleAvail = (day, period) => {
    const key = `${day}-${period}`;
    setAvailData(prev => ({ ...prev, [key]: STATUS_CYCLE[prev[key]] }));
  };

  const saveAvail = async () => {
    const availability = [];
    DAYS.forEach(d => PERIODS.forEach(p => {
      availability.push({ day: d, period: p, status: availData[`${d}-${p}`] });
    }));
    await api.updateAvailability(avail.id, availability);
    setAvail(null);
  };

  const designations = ['Professor','Associate Professor','Assistant Professor','Lecturer'];

  if (loading) return <div className="loading"><div className="spinner" />Loading...</div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h2>Teachers</h2><p>{teachers.length} faculty members</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Teacher</button>
      </div>
      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Name</th><th>Designation</th><th>Department</th>
                <th>Max Hours/Week</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td><span className="badge badge-indigo">{t.designation || '—'}</span></td>
                    <td>{t.department_name || '—'}</td>
                    <td>{t.max_hours_week}h</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => openAvail(t)}>Availability</button>
                        <button className="btn btn-sm btn-secondary btn-icon" onClick={() => openEdit(t)}><Edit2 size={12}/></button>
                        <button className="btn btn-sm btn-danger btn-icon" onClick={() => handleDelete(t.id)}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'add' ? 'Add Teacher' : 'Edit Teacher'}</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setModal(null)}><X size={14}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <select className="form-select" value={form.designation} onChange={e => setForm(f=>({...f,designation:e.target.value}))}>
                      <option value="">Select</option>
                      {designations.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Hours/Week</label>
                    <input className="form-input" type="number" min="1" max="40" value={form.max_hours_week} onChange={e => setForm(f=>({...f,max_hours_week:parseInt(e.target.value)}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={form.department_id} onChange={e => setForm(f=>({...f,department_id:e.target.value}))}>
                    <option value="">Select Department</option>
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

      {/* Availability Modal */}
      {avail && (
        <div className="modal-overlay" onClick={() => setAvail(null)}>
          <div className="modal" style={{ width: 'min(680px, 98vw)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Availability — {avail.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Click cells to cycle: <span style={{color:'var(--emerald)'}}>Available</span> → <span style={{color:'var(--indigo-light)'}}>Preferred</span> → <span style={{color:'var(--rose)'}}>Blocked</span>
                </div>
              </div>
              <button className="btn btn-icon btn-secondary" onClick={() => setAvail(null)}><X size={14}/></button>
            </div>
            <div className="modal-body">
              <div className="avail-grid">
                <div className="avail-header"></div>
                {DAYS.map(d => <div key={d} className="avail-header">{d}</div>)}
                {PERIODS.map(p => (
                  <React.Fragment key={p}>
                    <div className="avail-period">P{p} {PERIOD_TIMES[p]}</div>
                    {DAYS.map(d => (
                      <div
                        key={`${d}-${p}`}
                        className={`avail-cell ${availData[`${d}-${p}`] || 'available'}`}
                        onClick={() => cycleAvail(d, p)}
                        title={`${d} Period ${p}: ${availData[`${d}-${p}`]}`}
                      >
                        {availData[`${d}-${p}`] === 'preferred' ? '★' : availData[`${d}-${p}`] === 'blocked' ? '✕' : ''}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAvail(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveAvail}>Save Availability</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
