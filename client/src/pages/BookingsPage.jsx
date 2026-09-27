import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Trash2, X, BookmarkPlus } from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
const DAY_LABELS = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday' };

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ room_id:'', time_slot_id:'', booked_by:'', purpose:'', date:'' });
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.getBookings(), api.getRooms(), api.getTimeSlots()])
      .then(([b,r,s]) => { setBookings(b); setRooms(r); setSlots(s); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.createBooking(form);
      setModal(false); load();
    } catch(err) { setError(err.error || 'Booking conflict'); }
  };

  const handleDelete = async id => {
    if (!confirm('Remove this booking?')) return;
    await api.deleteBooking(id); load();
  };

  if (loading) return <div className="loading"><div className="spinner"/>Loading...</div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h2>Room Bookings</h2><p>Non-academic bookings (clubs, events, meetings)</p></div>
        <button className="btn btn-primary" onClick={() => { setForm({room_id:'',time_slot_id:'',booked_by:'',purpose:'',date:''}); setError(''); setModal(true); }}>
          <Plus size={14}/> New Booking
        </button>
      </div>
      <div className="page-body">
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <BookmarkPlus size={16}/>
          Bookings are enforced by the constraint engine. Rooms blocked by non-academic bookings cannot be used in timetable entries.
        </div>

        {bookings.length === 0 ? (
          <div className="empty-state">
            <BookmarkPlus size={40}/>
            <h3>No bookings yet</h3>
            <p>Book rooms for club activities, expert lectures, seminars, and events.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Room</th><th>Day</th><th>Period</th><th>Time</th><th>Booked By</th><th>Purpose</th><th></th>
                </tr></thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td><strong>{b.room_name}</strong></td>
                      <td>{DAY_LABELS[b.day] || b.day}</td>
                      <td>P{b.period}</td>
                      <td style={{ color:'var(--text-secondary)', fontSize:12 }}>{b.start_time}–{b.end_time}</td>
                      <td>{b.booked_by}</td>
                      <td style={{ color:'var(--text-secondary)' }}>{b.purpose || '—'}</td>
                      <td>
                        <button className="btn btn-sm btn-danger btn-icon" onClick={() => handleDelete(b.id)}><Trash2 size={12}/></button>
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
              <div className="modal-title">New Room Booking</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setModal(false)}><X size={14}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group"><label className="form-label">Room</label>
                  <select className="form-select" value={form.room_id} onChange={e=>setForm(f=>({...f,room_id:e.target.value}))} required>
                    <option value="">Select room</option>
                    {rooms.map(r=><option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Time Slot</label>
                  <select className="form-select" value={form.time_slot_id} onChange={e=>setForm(f=>({...f,time_slot_id:e.target.value}))} required>
                    <option value="">Select slot</option>
                    {DAYS.map(day => (
                      <optgroup key={day} label={DAY_LABELS[day]}>
                        {slots.filter(s=>s.day===day).sort((a,b)=>a.period-b.period).map(s => (
                          <option key={s.id} value={s.id}>P{s.period}: {s.start_time}–{s.end_time}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Booked By</label>
                    <input className="form-input" placeholder="e.g. Robotics Club" value={form.booked_by} onChange={e=>setForm(f=>({...f,booked_by:e.target.value}))} required/></div>
                  <div className="form-group"><label className="form-label">Date (optional)</label>
                    <input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
                </div>
                <div className="form-group"><label className="form-label">Purpose</label>
                  <input className="form-input" placeholder="e.g. Weekly meeting" value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))}/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
