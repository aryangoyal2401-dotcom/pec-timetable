import React, { useState } from 'react';
import { useAcademicTerm } from '../context/AcademicTermContext';
import { api } from '../services/api';
import { Calendar, Plus, Sparkles, X, ArrowRight, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

export default function TermSelector() {
  const { terms, activeTerm, setActiveTerm, createTerm, rollover, refreshTerms } = useAcademicTerm();
  const [modalOpen, setModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Backup modal state
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [backupError, setBackupError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleExportBackup = async () => {
    try {
      setBackupStatus('Exporting data...');
      setBackupError('');
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timetable_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupStatus('Backup exported successfully! Keep this file safe.');
    } catch (err) {
      setBackupError(err.error || err.message || 'Failed to export backup');
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImporting(true);
        setBackupError('');
        setBackupStatus('Restoring data...');
        const json = JSON.parse(event.target.result);
        if (!json.data) throw new Error('Invalid timetable backup file format');

        await api.importBackup(json.data);
        await refreshTerms();
        setBackupStatus('✅ Database restored successfully! Reloading...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err) {
        setBackupError(err.error || err.message || 'Failed to restore database from file');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleCreateTerm = async (e) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) {
      setError('Term code and name are required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (autoAdvance) {
        // Create term & rollover all batches (Sem 1->2, 3->4, 5->6, etc.)
        await rollover(activeTerm, newCode.trim(), true);
      } else {
        await createTerm({
          code: newCode.trim(),
          name: newName.trim(),
          is_active: 0,
          switch_to: true,
        });
      }
      setModalOpen(false);
      setNewCode('');
      setNewName('');
    } catch (err) {
      setError(err.error || 'Failed to create academic term');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '3px 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
          <Calendar size={13} style={{ color: 'var(--primary)' }} />
          <span>Semester:</span>
        </div>

        <select
          className="form-select"
          value={activeTerm}
          onChange={(e) => setActiveTerm(e.target.value)}
          style={{
            fontSize: 12,
            height: 26,
            padding: '0 8px',
            background: 'var(--bg-card)',
            fontWeight: 700,
            color: 'var(--primary)',
            width: 'auto',
            border: '1px solid var(--border)',
          }}
        >
          {terms.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} {t.name ? `(${t.name})` : ''}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            // Suggest next term code
            const currentParts = activeTerm.split('-');
            if (currentParts.length === 3) {
              const year = currentParts[0];
              const yr2 = currentParts[1];
              const termNum = parseInt(currentParts[2]);
              const nextCode = termNum === 1 ? `${year}-${yr2}-2` : `${parseInt(year) + 1}-${parseInt(yr2) + 1}-1`;
              setNewCode(nextCode);
              setNewName(`Academic Semester ${nextCode}`);
            } else {
              setNewCode('2026-27-2');
              setNewName('Academic Semester 2026-27 (Even / Term 2)');
            }
            setError('');
            setModalOpen(true);
          }}
          style={{ height: 24, padding: '0 8px', fontSize: 11 }}
          title="Add next academic semester / term"
        >
          <Plus size={11} /> Next Term
        </button>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            setBackupStatus('');
            setBackupError('');
            setBackupModalOpen(true);
          }}
          style={{ height: 24, padding: '0 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          title="Export / Import Database Backup"
        >
          <Download size={11} /> Sync &amp; Backup
        </button>
      </div>

      {/* Modal for creating a new academic semester / rollover */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Academic Semester / Term</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setModalOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateTerm}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label className="form-label">Term Code (e.g. 2026-27-2, 2027-28-1) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. 2026-27-2"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Term Display Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Academic Semester 2026-27 (Even / Term 2)"
                    required
                  />
                </div>

                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  marginTop: 10,
                }}>
                  <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={autoAdvance}
                      onChange={(e) => setAutoAdvance(e.target.checked)}
                    />
                    <span>Automatically advance batches to next semester</span>
                  </label>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 22 }}>
                    Increments all batch semesters (e.g., Sem 1 $\to$ Sem 2, Sem 5 $\to$ Sem 6) for the new term.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create & Switch Term'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Backup & Data Sync */}
      {backupModalOpen && (
        <div className="modal-overlay" onClick={() => setBackupModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Sync &amp; Database Backup</div>
              <button className="btn btn-icon btn-secondary" onClick={() => setBackupModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="modal-body">
              {backupStatus && (
                <div className="alert alert-success" style={{ marginBottom: 12, fontSize: 12 }}>
                  {backupStatus}
                </div>
              )}
              {backupError && (
                <div className="alert alert-error" style={{ marginBottom: 12, fontSize: 12 }}>
                  {backupError}
                </div>
              )}

              {/* Export Section */}
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 14,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Download size={15} style={{ color: 'var(--primary)' }} />
                  1. Export Local Data Backup
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Download a complete backup JSON containing all current courses, timetable entries, faculty, and room allocations.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleExportBackup}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={13} /> Download Backup (.json)
                </button>
              </div>

              {/* Import Section */}
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '14px 16px',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Upload size={15} style={{ color: 'var(--emerald)' }} />
                  2. Restore / Preload Data
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Upload a downloaded backup JSON onto your live deployment to preload or sync your database instantly.
                </p>
                <label className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <Upload size={13} /> Choose Backup File &amp; Restore
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportBackup}
                    disabled={importing}
                  />
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setBackupModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

