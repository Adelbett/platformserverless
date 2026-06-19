import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, UserCheck, RefreshCw, Users as UsersIcon, AlertCircle } from 'lucide-react';
import { usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── Role config ────────────────────────────────────────────────────────────────
// Global platform roles only. Per-member feature permissions (deploy, billing,
// Kafka, etc.) are managed by each CLIENT_ADMIN on their own team — see /team.

const ROLES = ['ADMIN', 'CLIENT_ADMIN', 'MEMBER'];

const ROLE_META = {
    ADMIN:        { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  icon: Shield,    desc: 'Full platform access'        },
    CLIENT_ADMIN: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', icon: UserCheck, desc: 'Manages their own team'      },
    MEMBER:       { color: '#00D4FF', bg: 'rgba(0,212,255,0.10)',  icon: UserCheck, desc: 'Deploys within their team'   },
};

const RoleBadge = ({ role }) => {
    const m = ROLE_META[role] || ROLE_META.MEMBER;
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
    const [saving,  setSaving]  = useState(null);
    const [error,   setError]   = useState(null);

    // Redirect non-admins
    useEffect(() => {
        if (me && me.role !== 'ADMIN') navigate('/dashboard');
    }, [me, navigate]);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await usersApi.list();
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            const status = e?.response?.status;
            if (status === 403) setError('Access denied — you need ADMIN role to view users.');
            else if (status === 401) setError('Session expired — please log in again.');
            else setError(`Failed to load users (${status || 'network error'})`);
            setUsers([]);
        } finally { setLoading(false); }
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
                        Global platform roles — ADMIN only. Per-member feature permissions are managed on the Team page by each CLIENT_ADMIN.
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
                    <div style={{ padding: 48, textAlign: 'center' }}>
                        <RefreshCw size={20} style={{ color: '#4B5563', animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
                        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>Loading users…</p>
                    </div>
                ) : error ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                        <AlertCircle size={32} style={{ color: '#EF4444', margin: '0 auto 14px', display: 'block' }} />
                        <p style={{ color: '#EF4444', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>{error}</p>
                        <p style={{ color: '#6B7280', fontSize: 12, margin: '0 0 16px' }}>
                            Make sure your JWT token contains the ADMIN role and the backend is reachable.
                        </p>
                        <button onClick={load} className="btn-ghost" style={{ fontSize: 12, margin: '0 auto' }}>
                            <RefreshCw size={13} /> Retry
                        </button>
                    </div>
                ) : users.length === 0 ? (
                    <div style={{ padding: 56, textAlign: 'center' }}>
                        <UsersIcon size={36} style={{ color: '#374151', margin: '0 auto 14px', display: 'block' }} />
                        <p style={{ color: '#9CA3AF', fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>No users registered yet</p>
                        <p style={{ color: '#6B7280', fontSize: 12, margin: 0 }}>
                            Users appear here after they sign up and log in for the first time.
                        </p>
                    </div>
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
                                        <RoleBadge role={u.role || 'MEMBER'} />
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
                                                value={u.role || 'MEMBER'}
                                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                                style={{
                                                    padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                    border: `1px solid ${ROLE_META[u.role || 'MEMBER']?.color || '#9CA3AF'}40`,
                                                    background: dark ? '#1F2937' : '#F8FAFC',
                                                    color: ROLE_META[u.role || 'MEMBER']?.color || '#9CA3AF',
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
