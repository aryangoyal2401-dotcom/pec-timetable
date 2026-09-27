import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ShieldCheck, UserCog, User, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (email, newRole) => {
    if (email === import.meta.env.VITE_SUPER_ADMIN_EMAIL || email === 'aryangoyal.bt24cse@pec.edu.in') {
      alert("Cannot change the super admin's role.");
      return;
    }
    
    try {
      await api.updateUserRole(email, newRole);
      setUsers(users.map(u => u.email === email ? { ...u, role: newRole } : u));
    } catch (err) {
      alert('Failed to update role');
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading users...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-indigo-600" />
          Admin Panel
        </h1>
        <p className="text-slate-500 mt-1">Manage user roles and system access.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium">User</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const isSuperAdmin = u.email === 'aryangoyal.bt24cse@pec.edu.in';
              const isSelf = u.email === currentUser.email;

              return (
                <tr key={u.email} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.picture ? (
                        <img src={u.picture} alt={u.name} className="w-10 h-10 rounded-full border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-slate-800 flex items-center gap-2">
                          {u.name || 'Unknown'}
                          {isSelf && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">You</span>}
                        </div>
                        <div className="text-slate-500 text-xs">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full text-xs font-semibold">
                        <UserCog className="w-3.5 h-3.5" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-medium">
                        <User className="w-3.5 h-3.5" /> Viewer
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <ShieldAlert className="w-3.5 h-3.5" /> Super Admin
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.email, e.target.value)}
                        disabled={isSelf} // Don't let users demote themselves easily
                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
