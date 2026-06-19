import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, X, Check, Shield, Settings } from 'lucide-react';
import { teamApi } from '../api';
import { useTheme } from '../context/ThemeContext';

const MEMBER_COLOR = { color: '#00D4FF', bg: 'rgba(0,212,255,0.12)' };

// ── Granular feature permissions for MEMBER accounts ────────────────────────────
const PERMISSIONS = [
    { key: 'DEPLOY_APP',      label: 'Déployer une application' },
    { key: 'DELETE_APP',      label: 'Supprimer une application' },
    { key: 'MANAGE_KAFKA',    label: 'Gérer Kafka (créer/supprimer topics)' },
    { key: 'MANAGE_EVENTING', label: 'Gérer Eventing (KafkaSource / Triggers)' },
    { key: 'VIEW_LOGS',       label: 'Voir les logs' },
    { key: 'VIEW_MONITORING', label: 'Voir le monitoring' },
    { key: 'VIEW_BILLING',    label: 'Consulter la facturation' },
    { key: 'EXPORT_BILLING',  label: 'Exporter le rapport Excel' },
];

// ── Add Member Modal ───────────────────────────────────────────────────────────
const AddModal = ({ onClose, onAdded }) => {
    const [form, setForm] = useState({ username: '', email: '', password: '' });
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
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px',
                    fontFamily: "'Outfit', sans-serif" }}>Add Team Member</h2>
                <p style={{ fontSize: 11.5, color: '#64748B', margin: '0 0 20px' }}>
                    Created with role MEMBER — set their permissions afterwards
                </p>

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

                {error && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
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

// ── Permissions Modal ───────────────────────────────────────────────────────────
const PermissionsModal = ({ member, onClose, onSaved, dark }) => {
    const [draft, setDraft]   = useState(new Set(member.permissions || []));
    const [saving, setSaving] = useState(false);

    const toggle = (key) => {
        setDraft(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await teamApi.updatePermissions(member.id, Array.from(draft));
            onSaved(member.id, res.data.permissions);
            onClose();
        } catch (e) {
            console.error('Failed to update permissions', e);
        } finally { setSaving(false); }
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => !saving && onClose()}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                onClick={e => e.stopPropagation()}
                style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16, width: 460, maxWidth: '90vw', overflow: 'hidden' }}
            >
                <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                            Permissions — {member.username}
                        </h3>
                        <p style={{ fontSize: 11.5, margin: '3px 0 0', color: '#64748B' }}>
                            Contrôle individuel des fonctionnalités autorisées
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {PERMISSIONS.map(p => {
                        const checked = draft.has(p.key);
                        return (
                            <label key={p.key}
                                style={{ display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 8px', borderRadius: 8, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{
                                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: `1.5px solid ${checked ? '#00D4FF' : '#475569'}`,
                                    background: checked ? '#00D4FF' : 'transparent',
                                }}>
                                    {checked && <Check size={12} color="#07090E" strokeWidth={3} />}
                                </span>
                                <input type="checkbox" checked={checked} onChange={() => toggle(p.key)} style={{ display: 'none' }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{p.label}</span>
                            </label>
                        );
                    })}
                </div>

                <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={onClose} disabled={saving}
                        style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: 12.5 }}>
                        Annuler
                    </button>
                    <button onClick={save} disabled={saving}
                        style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3B82F6',
                            color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
                            display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                        <Check size={13} /> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ── Member Row ────────────────────────────────────────────────────────────────
const MemberRow = ({ member, onRemove, onManagePermissions }) => (
    <motion.tr initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td style={{ padding: '13px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{member.username}</p>
            <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>{member.email}</p>
        </td>
        <td style={{ padding: '13px 16px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MEMBER_COLOR.color,
                background: MEMBER_COLOR.bg, padding: '3px 10px', borderRadius: 999 }}>
                MEMBER
            </span>
        </td>
        <td style={{ padding: '13px 16px', fontSize: 11, color: '#475569' }}>
            {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}
        </td>
        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => onManagePermissions(member)}
                    style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)',
                        borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#00D4FF',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700 }}>
                    <Settings size={13} /> Permissions
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

// ── Main Page ─────────────────────────────────────────────────────────────────
const Team = () => {
    const { dark } = useTheme();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [permMember, setPermMember] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await teamApi.listMembers();
            setMembers(res.data || []);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleAdded  = (m)        => setMembers(p => [...p, m]);
    const handlePermsSaved = (id, permissions) =>
        setMembers(p => p.map(m => m.id === id ? { ...m, permissions } : m));
    const handleRemove = async (id) => {
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 7,
                    background: MEMBER_COLOR.bg, border: `1px solid ${MEMBER_COLOR.color}30`,
                    borderRadius: 8, padding: '6px 12px' }}>
                    <Shield size={11} color={MEMBER_COLOR.color} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: MEMBER_COLOR.color }}>MEMBER</span>
                    <span style={{ fontSize: 11, color: '#475569' }}>
                        — Deploy, logs, metrics, Kafka, Eventing, billing — chaque case est activable individuellement
                    </span>
                </div>
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
                                onRemove={handleRemove} onManagePermissions={setPermMember} />
                        ))}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
                {permMember && (
                    <PermissionsModal
                        member={permMember}
                        dark={dark}
                        onClose={() => setPermMember(null)}
                        onSaved={handlePermsSaved}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Team;
