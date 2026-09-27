import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Trash2, X, Calendar } from 'lucide-react';

export default function CalendarPage() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ date:'', name:'' });
  const [error, setError] = useState('');

  const load = () => {
    api.getHolidays().then(setHolidays).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.createHoliday(form);
      setModal(false); load();
    } catch(err) { setError(err.error || 'Error'); }
  };

  const handleDelete = async id => {
    if (!confirm('Remove this holiday?')) return;
    await api.deleteHoliday(id); load();
  };

  const formatDate = dateStr => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  };

  if (loading) return <div className="loading"><div className="spinner"/>Loading...</div>;

  const months = [...new Set(holidays.map(h => h.date.slice(0,7)))];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h2>Academic Calendar</h2><p>{holidays.length} holidays defined</p></div>
        <button className="btn btn-primary" onClick={() => { setForm({date:'',name:''}); setError(''); setModal(true); }}>
          <Plus size={14}/> Add Holiday
        </button>
      </div>
      <div className="page-body">
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <Calendar size={16} />
          Holidays are enforced by the constraint engine. Academic classes cannot be scheduled on these dates.
        </div>

        {holidays.length === 0 ? (
          <div className="empty-state">
            <Calendar size={40} />
            <h3>No holidays defined</h3>
            <p>Add holidays to prevent scheduling on those dates.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Day</th><th>Holiday Name</th><th></th></tr></thead>
                <tbody>
                  {holidays.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{h.date}</td>
                      <td style={{ color:'var(--text-secondary)' }}>
                        {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long' })}
                      </td>
                      <td>
                        <span className="badge badge-rose">{h.name}</span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-danger btn-icon" onClick={() => handleDelete(h.id)}><Trash2 size={12}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Holiday</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setModal(false)}><X size={14}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group"><label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required/></div>
                <div className="form-group"><label className="form-label">Holiday Name</label>
                  <input className="form-input" placeholder="e.g. Republic Day" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Holiday</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
