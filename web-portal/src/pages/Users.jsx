import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, UserCheck, Eye, RefreshCw } from 'lucide-react';
import { usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── Role config ────────────────────────────────────────────────────────────────

const ROLES = ['ADMIN', 'DEVELOPER', 'VIEWER'];

const ROLE_META = {
    ADMIN:     { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',    icon: Shield,    desc: 'Full platform access'           },
    DEVELOPER: { color: '#00D4FF', bg: 'rgba(0,212,255,0.10)',    icon: UserCheck, desc: 'Deploy & manage own services'   },
    VIEWER:    { color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)', icon: Eye,       desc: 'Read-only access'               },
};

const RoleBadge = ({ role }) => {
    const m = ROLE_META[role] || ROLE_META.VIEWER;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace",
            padding: '3px 8px', borderRadius: 5,
            color: m.color, background: m.bg,
        }}>
            <m.icon size={10} /> {role}
        </span>
    );
};

// ── Main page ──────────────────────────────────────────────────────────────────

const Users = () => {
    const navigate              = useNavigate();
    const { user: me }          = useAuth();
    const { dark }              = useTheme();
    const [users, setUsers]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(null); // userId being saved

    // Redirect non-admins
    useEffect(() => {
        if (me && me.role !== 'ADMIN') navigate('/dashboard');
    }, [me, navigate]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await usersApi.list();
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch { setUsers([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleRoleChange = async (userId, newRole) => {
        setSaving(userId);
        try {
            const res = await usersApi.updateRole(userId, newRole);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: res.data.role } : u));
        } catch (e) {
            console.error('Failed to update role', e);
        } finally { setSaving(null); }
    };

    const counts = ROLES.reduce((acc, r) => {
        acc[r] = users.filter(u => u.role === r).length;
        return acc;
    }, {});

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                        Team & Access
                    </h2>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }} className="text-secondary">
                        Manage user roles — ADMIN only
                    </p>
                </div>
                <button className="btn-ghost" onClick={load} disabled={loading} style={{ fontSize: 12 }}>
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
                </button>
            </div>

            {/* Role summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {ROLES.map(role => {
                    const m = ROLE_META[role];
                    return (
                        <div key={role} className="ns-card" style={{ padding: '18px 20px', borderLeft: `3px solid ${m.color}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <m.icon size={16} style={{ color: m.color }} />
                                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", color: m.color }}>{role}</span>
                            </div>
                            <p style={{ fontSize: 30, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: '0 0 4px' }} className="text-primary">{counts[role] ?? 0}</p>
                            <p style={{ fontSize: 11, margin: 0, color: '#9CA3AF' }}>{m.desc}</p>
                        </div>
                    );
                })}
            </div>

            {/* Users table */}
            <div className="ns-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                        All Users <span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF', marginLeft: 8 }}>{users.length} total</span>
                    </h3>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading users…</div>
                ) : users.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No users found.</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                                {['User', 'Email', 'Role', 'Joined', 'Change Role'].map(h => (
                                    <th key={h} style={{
                                        textAlign: 'left', padding: '10px 20px',
                                        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                                        letterSpacing: '0.07em', color: '#64748B',
                                        borderBottom: '1px solid rgba(0,0,0,0.07)',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u, i) => (
                                <motion.tr
                                    key={u.id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    style={{ transition: 'background 150ms' }}
                                    onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {/* Avatar + username */}
                                    <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                                background: 'linear-gradient(135deg, #00D4FF, #0066FF)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 11, fontWeight: 800, color: 'white',
                                                fontFamily: "'Outfit', sans-serif",
                                            }}>
                                                {(u.username || 'U').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }} className="text-primary">
                                                    {u.username}
                                                    {u.id === me?.id && (
                                                        <span style={{ fontSize: 9, marginLeft: 6, color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>you</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Email */}
                                    <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 12, color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>
                                        {u.email}
                                    </td>

                                    {/* Current role badge */}
                                    <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                        <RoleBadge role={u.role || 'VIEWER'} />
                                    </td>

                                    {/* Joined date */}
                                    <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 12, color: '#9CA3AF' }}>
                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                    </td>

                                    {/* Role selector */}
                                    <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                        {u.id === me?.id ? (
                                            <span style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>— your account</span>
                                        ) : saving === u.id ? (
                                            <RefreshCw size={14} style={{ color: '#9CA3AF', animation: 'spin 1s linear infinite' }} />
                                        ) : (
                                            <select
                                                value={u.role || 'VIEWER'}
                                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                                style={{
                                                    padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                    border: `1px solid ${ROLE_META[u.role || 'VIEWER']?.color || '#9CA3AF'}40`,
                                                    background: dark ? '#1F2937' : '#F8FAFC',
                                                    color: ROLE_META[u.role || 'VIEWER']?.color || '#9CA3AF',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        )}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Users;
