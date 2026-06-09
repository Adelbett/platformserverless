import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, Edit2, X, Check, Shield } from 'lucide-react';
import { teamApi } from '../api';
import { useTheme } from '../context/ThemeContext';

const ROLES = ['DEVELOPER', 'VIEWER', 'BILLING_MANAGER'];

const ROLE_COLOR = {
    DEVELOPER:       { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    VIEWER:          { color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
    BILLING_MANAGER: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
};

// ── Add Member Modal ───────────────────────────────────────────────────────────
const AddModal = ({ onClose, onAdded }) => {
    const [form, setForm] = useState({ username: '', email: '', password: '', role: 'DEVELOPER' });
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');

    const submit = async () => {
        setSaving(true); setError('');
        try {
            const res = await teamApi.addMember(form);
            onAdded(res.data);
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || 'Error adding member');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16, padding: 28, width: 420, position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16,
                    background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                    <X size={18} />
                </button>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9', margin: '0 0 20px',
                    fontFamily: "'Outfit', sans-serif" }}>Add Team Member</h2>

                {[
                    { key: 'username', label: 'Username', type: 'text' },
                    { key: 'email',    label: 'Email',    type: 'email' },
                    { key: 'password', label: 'Password', type: 'password' },
                ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 5,
                            textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</label>
                        <input type={f.type} value={form[f.key]}
                            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                                padding: '9px 12px', color: '#F1F5F9', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                ))}

                <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 5,
                        textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role</label>
                    <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                        style={{ width: '100%', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8, padding: '9px 12px', color: '#F1F5F9', fontSize: 13 }}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                {error && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                        color: '#94A3B8', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                    <button onClick={submit} disabled={saving}
                        style={{ padding: '9px 20px', borderRadius: 8, border: 'none',
                            background: '#3B82F6', color: '#fff', cursor: 'pointer',
                            fontWeight: 700, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                        {saving ? 'Adding…' : 'Add Member'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ── Member Row ────────────────────────────────────────────────────────────────
const MemberRow = ({ member, onRoleChange, onRemove }) => {
    const [editing, setEditing] = useState(false);
    const [role, setRole]       = useState(member.role);
    const [saving, setSaving]   = useState(false);

    const saveRole = async () => {
        if (role === member.role) { setEditing(false); return; }
        setSaving(true);
        try {
            await teamApi.changeRole(member.id, role);
            onRoleChange(member.id, role);
        } finally { setSaving(false); setEditing(false); }
    };

    const rc = ROLE_COLOR[member.role] || ROLE_COLOR.VIEWER;

    return (
        <motion.tr initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <td style={{ padding: '13px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{member.username}</p>
                <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>{member.email}</p>
            </td>
            <td style={{ padding: '13px 16px' }}>
                {editing ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={role} onChange={e => setRole(e.target.value)}
                            style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 6, padding: '4px 8px', color: '#F1F5F9', fontSize: 12 }}>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={saveRole} disabled={saving}
                            style={{ background: '#10B981', border: 'none', borderRadius: 6,
                                padding: '4px 8px', cursor: 'pointer', color: '#fff' }}>
                            <Check size={12} />
                        </button>
                        <button onClick={() => { setRole(member.role); setEditing(false); }}
                            style={{ background: 'rgba(255,255,255,0.06)', border: 'none',
                                borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#94A3B8' }}>
                            <X size={12} />
                        </button>
                    </div>
                ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: rc.color,
                        background: rc.bg, padding: '3px 10px', borderRadius: 999 }}>
                        {member.role}
                    </span>
                )}
            </td>
            <td style={{ padding: '13px 16px', fontSize: 11, color: '#475569' }}>
                {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}
            </td>
            <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(true)}
                        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                            borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#3B82F6' }}>
                        <Edit2 size={13} />
                    </button>
                    <button onClick={() => onRemove(member.id)}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#EF4444' }}>
                        <Trash2 size={13} />
                    </button>
                </div>
            </td>
        </motion.tr>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const Team = () => {
    const { dark } = useTheme();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await teamApi.listMembers();
            setMembers(res.data || []);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleAdded   = (m)          => setMembers(p => [...p, m]);
    const handleRole    = (id, role)    => setMembers(p => p.map(m => m.id === id ? { ...m, role } : m));
    const handleRemove  = async (id)   => {
        if (!window.confirm('Remove this member?')) return;
        await teamApi.removeMember(id);
        setMembers(p => p.filter(m => m.id !== id));
    };

    return (
        <div style={{ maxWidth: 900 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
                <div>
                    <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: '#3B82F6', margin: '0 0 5px' }}>Management</p>
                    <h1 style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif",
                        color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>Team</h1>
                    <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
                        {members.length} member{members.length !== 1 ? 's' : ''} — all deploy in your namespace
                    </p>
                </div>
                <button onClick={() => setShowAdd(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                        background: '#3B82F6', border: 'none', borderRadius: 10,
                        color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    <Plus size={15} /> Add Member
                </button>
            </div>

            {/* Role legend */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                {[
                    { role: 'DEVELOPER',       desc: 'Deploy, logs, metrics, Kafka' },
                    { role: 'VIEWER',           desc: 'Read-only access' },
                    { role: 'BILLING_MANAGER',  desc: 'Billing page only' },
                ].map(({ role, desc }) => {
                    const rc = ROLE_COLOR[role];
                    return (
                        <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 7,
                            background: rc.bg, border: `1px solid ${rc.color}30`,
                            borderRadius: 8, padding: '6px 12px' }}>
                            <Shield size={11} color={rc.color} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: rc.color }}>{role}</span>
                            <span style={{ fontSize: 11, color: '#475569' }}>— {desc}</span>
                        </div>
                    );
                })}
            </div>

            {/* Table */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Member', 'Role', 'Joined', ''].map((h, i) => (
                                <th key={i} style={{ padding: '11px 16px', fontSize: 9, fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155',
                                    textAlign: i === 3 ? 'right' : 'left',
                                    background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ padding: 48, textAlign: 'center', color: '#475569' }}>
                                Loading…
                            </td></tr>
                        ) : members.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: 52, textAlign: 'center' }}>
                                <Users size={32} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>
                                    No members yet. Add your first team member.
                                </p>
                            </td></tr>
                        ) : members.map(m => (
                            <MemberRow key={m.id} member={m}
                                onRoleChange={handleRole} onRemove={handleRemove} />
                        ))}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
            </AnimatePresence>
        </div>
    );
};

export default Team;
