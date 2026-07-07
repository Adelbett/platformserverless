import { useEffect, useState } from 'react';
import { RefreshCw, Plus, Trash2, Radio } from 'lucide-react';
import { adminApi, statusApi } from '../../api';

const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'];
const STATUSES = ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'];

const inputStyle = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, color: '#F1F5F9', fontSize: 12, padding: '8px 10px',
};

const emptyForm = { title: '', description: '', severity: 'MINOR', status: 'INVESTIGATING', startedAt: '', resolvedAt: '' };

const AdminIncidents = () => {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [creating, setCreating] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await statusApi.getIncidents();
            setIncidents(res.data || []);
        } catch (e) {
            setError(e.response?.status ? `HTTP ${e.response.status}` : 'Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const create = async () => {
        if (!form.title || !form.startedAt) return;
        setCreating(true);
        try {
            await adminApi.createIncident({ ...form, startedAt: new Date(form.startedAt).toISOString() });
            setForm(emptyForm);
            await load();
        } finally {
            setCreating(false);
        }
    };

    const updateStatus = async (incident, status) => {
        await adminApi.updateIncident(incident.id, {
            ...incident,
            status,
            resolvedAt: status === 'RESOLVED' ? new Date().toISOString() : incident.resolvedAt,
        });
        await load();
    };

    const remove = async (id) => {
        if (!window.confirm('Delete this incident from the public status page?')) return;
        await adminApi.deleteIncident(id);
        await load();
    };

    return (
        <div style={{ maxWidth: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
                <div>
                    <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', color: '#EF4444', margin: '0 0 5px' }}>Admin Console</p>
                    <h1 style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#F1F5F9', margin: 0 }}>Incidents</h1>
                    <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>Shown on the public status page</p>
                </div>
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: 12 }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
                    <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={inputStyle}>
                        {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="datetime-local" value={form.startedAt} onChange={e => setForm(f => ({ ...f, startedAt: e.target.value }))} style={inputStyle} />
                </div>
                <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ ...inputStyle, width: '100%', minHeight: 60, marginBottom: 10, fontFamily: 'inherit' }} />
                <button onClick={create} disabled={creating || !form.title || !form.startedAt} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
                    border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.12)', color: '#3B82F6',
                    cursor: creating ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, opacity: creating ? 0.5 : 1,
                }}>
                    <Plus size={13} /> Create incident
                </button>
            </div>

            {error && <p style={{ color: '#EF4444', fontSize: 13 }}>{error}</p>}

            {loading ? (
                <p style={{ color: '#475569', fontSize: 13 }}>Loading…</p>
            ) : incidents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                    <Radio size={28} style={{ color: '#334155', margin: '0 auto 10px' }} />
                    <p style={{ color: '#475569', fontSize: 13 }}>No incidents recorded.</p>
                </div>
            ) : incidents.map(inc => (
                <div key={inc.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{inc.title}</p>
                        <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{inc.severity} · started {new Date(inc.startedAt).toLocaleString()}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select value={inc.status} onChange={e => updateStatus(inc, e.target.value)} style={inputStyle}>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => remove(inc.id)} style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', cursor: 'pointer' }}>
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AdminIncidents;
