import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Trash2, Edit2, X } from 'lucide-react';

const ROOM_TYPES = ['classroom','lab','seminar','conference','auditorium'];
const TYPE_BADGE = { classroom:'badge-indigo', lab:'badge-emerald', seminar:'badge-amber', conference:'badge-sky', auditorium:'badge-violet' };

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name:'', capacity:60, type:'classroom', department_id:'', location:'' });
  const [error, setError] = useState('');

  const load = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    Promise.all([api.getRooms(), api.getDepartments()])
      .then(([r,d]) => { setRooms(r); setDepartments(d); })
      .finally(() => setLoading(false));
  };
  useEffect(() => load(true), []);

  const openAdd = () => {
    setForm({ name:'', capacity:60, type:'classroom', department_id: departments[0]?.id||'', location:'' });
    setError('');
    setModal('add');
  };
  const openEdit = r => {
    setForm({ name:r.name, capacity:r.capacity, type:r.type, department_id:r.department_id||'', location:r.location||'' });
    setError('');
    setModal(r);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      if (modal === 'add') await api.createRoom(form);
      else await api.updateRoom(modal.id, form);
      setModal(null);
      load(false);
    } catch(err) { setError(err.error || 'Error saving room'); }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this room?')) return;
    await api.deleteRoom(id);
    load(false);
  };

  if (loading) return <div className="loading"><div className="spinner"/>Loading...</div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h2>Rooms & Venues</h2><p>{rooms.length} venues available</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={14}/> Add Room</button>
      </div>
      <div className="page-body">
        <div className="grid-3" style={{ marginBottom: 16 }}>
          {ROOM_TYPES.map(type => {
            const count = rooms.filter(r => r.type === type).length;
            return (
              <div key={type} className="stat-card">
                <div className="stat-label">{type}s</div>
                <div className="stat-value" style={{ fontSize: 22, color: 'var(--text-primary)' }}>{count}</div>
              </div>
            );
          })}
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Room</th><th>Type</th><th>Capacity</th><th>Location</th><th>Department</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {rooms.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td><span className={`badge ${TYPE_BADGE[r.type] || 'badge-gray'}`}>{r.type}</span></td>
                    <td>{r.capacity}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.location || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.department_name || '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary btn-icon" onClick={() => openEdit(r)}><Edit2 size={12}/></button>
                        <button className="btn btn-sm btn-danger btn-icon" onClick={() => handleDelete(r.id)}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'add' ? 'Add Room' : 'Edit Room'}</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setModal(null)}><X size={14}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Room Name / Number</label>
                  <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                      {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacity</label>
                    <input className="form-input" type="number" min="1" value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:parseInt(e.target.value)}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" placeholder="e.g. Block A, Floor 2" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={form.department_id} onChange={e=>setForm(f=>({...f,department_id:e.target.value}))}>
                    <option value="">No department</option>
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
    </div>
  );
}
