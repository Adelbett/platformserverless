import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { appsApi, adminApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    Search, Plus, LayoutGrid, List, RefreshCw,
    ExternalLink, Terminal, Trash2, Zap,
    Cpu, MemoryStick, Activity, ChevronRight,
    Package, Server, Users, FolderOpen,
    ChevronDown, AlertTriangle,
} from 'lucide-react';

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
    RUNNING:          { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  glow: '0 0 10px rgba(16,185,129,0.4)',  label: 'Running'        },
    SCALING:          { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  glow: '0 0 10px rgba(245,158,11,0.4)',  label: 'Scaling'        },
    DEPLOYING:        { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  glow: '0 0 10px rgba(59,130,246,0.4)',  label: 'Deploying'      },
    FAILED:           { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   glow: '0 0 10px rgba(239,68,68,0.4)',   label: 'Failed'         },
    SUSPENDED:        { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)',  glow: 'none', label: 'Suspended'      },
    'SCALED TO ZERO': { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.22)', glow: 'none', label: 'Scaled to zero' },
    IDLE:             { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.22)', glow: 'none', label: 'Scaled to zero'  },
    DELETED:          { color: '#EF4444', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)',   glow: 'none', label: 'Deleted'        },
    default:          { color: '#6B7280', bg: 'rgba(107,114,128,0.07)', border: 'rgba(107,114,128,0.15)', glow: 'none', label: 'Unknown'        },
};

const getStatus = (app) => {
    if (!app.status) return 'UNKNOWN';
    // Backend now sends IDLE directly — treat same as SCALED TO ZERO
    if (app.status === 'IDLE') return 'IDLE';
    if (app.status === 'RUNNING' && (app.replicas === 0 || app.replicas == null)) return 'SCALED TO ZERO';
    return app.status;
};

// ── Avatar gradient ────────────────────────────────────────────────────────────
const GRADIENTS = [
    ['#6366F1','#8B5CF6'], ['#3B82F6','#06B6D4'], ['#10B981','#059669'],
    ['#F59E0B','#EF4444'], ['#EC4899','#8B5CF6'], ['#0EA5E9','#3B82F6'],
    ['#14B8A6','#10B981'], ['#F97316','#EF4444'],
];
const gradientFor = (name = '') => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];

const AppAvatar = ({ name, size = 40 }) => {
    const [g0, g1] = gradientFor(name);
    return (
        <div style={{ width: size, height: size, borderRadius: size * 0.25, background: `linear-gradient(135deg, ${g0}, ${g1})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 3px 10px ${g0}40` }}>
            <span style={{ fontSize: size * 0.4, fontWeight: 900, color: '#fff', fontFamily: "'Outfit', sans-serif" }}>{(name || '?')[0].toUpperCase()}</span>
        </div>
    );
};

const UserAvatar = ({ name, size = 36 }) => {
    const colors = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#F97316'];
    const color = colors[name.charCodeAt(0) % colors.length];
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', background: `${color}20`, border: `2px solid ${color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: size * 0.38, fontWeight: 900, color, fontFamily: "'Outfit', sans-serif" }}>{(name || '?')[0].toUpperCase()}</span>
        </div>
    );
};

// ── Status badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status, pulse, small }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.default;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: small ? '2px 7px' : '3px 10px', borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, whiteSpace: 'nowrap' }}>
            <span style={{ width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: '50%', background: cfg.color, boxShadow: cfg.glow, animation: pulse && status === 'RUNNING' ? 'pulse 2s infinite' : 'none' }} />
            {cfg.label || status}
        </span>
    );
};

const Chip = ({ icon: Icon, label, color = '#64748B' }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color, background: `${color}10`, border: `1px solid ${color}22`, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>
        {Icon && <Icon size={9} />}{label}
    </span>
);

const CardAction = ({ icon: Icon, label, color, onClick }) => (
    <button onClick={onClick} title={label}
        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${color}30`, background: `${color}12`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = `${color}25`; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; }}>
        <Icon size={11} />
    </button>
);

// ── App row (used inside user group table) ─────────────────────────────────────
const AdminAppRow = ({ app, onDelete, navigate }) => {
    const [hov, setHov] = useState(false);
    const status = getStatus(app);
    const cfg = STATUS_CFG[status] || STATUS_CFG.default;
    const name = app.serviceName || app.name || 'Unnamed';
    const replicas = app.replicas ?? 0;
    const maxReplicas = app.maxReplicas ?? 5;
    const pct = Math.min(100, Math.round((replicas / Math.max(maxReplicas, 1)) * 100));

    return (
        <tr
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            onClick={() => navigate(`/apps/${app.id}`)}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: hov ? 'rgba(255,255,255,0.025)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}
        >
            {/* Service name */}
            <td style={{ padding: '11px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AppAvatar name={name} size={32} />
                    <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: "'Outfit', sans-serif" }}>{name}</p>
                        {app.imageName && (
                            <p style={{ fontSize: 9, color: '#334155', margin: '1px 0 0', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                                {app.imageName.split('/').pop()}
                            </p>
                        )}
                    </div>
                </div>
            </td>
            {/* Namespace */}
            <td style={{ padding: '11px 16px' }}>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: 5 }}>
                    {app.namespace || 'default'}
                </span>
            </td>
            {/* Status */}
            <td style={{ padding: '11px 16px' }}><StatusBadge status={status} pulse small /></td>
            {/* Replicas */}
            <td style={{ padding: '11px 16px' }}>
                {replicas === 0 ? (
                    <span style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>scale-to-zero</span>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{replicas}/{maxReplicas}</span>
                        <div style={{ width: 50, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 99 }} />
                        </div>
                    </div>
                )}
            </td>
            {/* Resources */}
            <td style={{ padding: '11px 16px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                    <Chip icon={Cpu} label={app.cpuRequest || '100m'} color="#3B82F6" />
                    <Chip icon={MemoryStick} label={app.memoryRequest || '128Mi'} color="#8B5CF6" />
                </div>
            </td>
            {/* URL */}
            <td style={{ padding: '11px 16px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {app.url ? (
                    <a href={app.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#3B82F6', fontFamily: "'JetBrains Mono', monospace", textDecoration: 'none' }}>
                        {app.url.replace(/^https?:\/\//, '')}
                    </a>
                ) : <span style={{ fontSize: 10, color: '#334155' }}>—</span>}
            </td>
            {/* Actions */}
            <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', opacity: hov ? 1 : 0, transition: 'opacity 0.2s' }}>
                    <CardAction icon={Terminal} label="Details" color="#3B82F6" onClick={e => { e.stopPropagation(); navigate(`/apps/${app.id}`); }} />
                    <CardAction icon={ExternalLink} label="Open" color="#10B981" onClick={e => { e.stopPropagation(); if (app.url) window.open(app.url, '_blank'); }} />
                    <CardAction icon={Trash2} label="Force Delete" color="#EF4444" onClick={e => { e.stopPropagation(); onDelete(app.id, app.serviceName || app.name); }} />
                </div>
            </td>
        </tr>
    );
};

// ── User group card (admin view) ───────────────────────────────────────────────
const UserGroup = ({ userId, apps, onDelete, navigate }) => {
    const [collapsed, setCollapsed] = useState(false);
    const username = userId.replace(/^user-/, '');
    const running  = apps.filter(a => getStatus(a) === 'RUNNING').length;
    const failed   = apps.filter(a => getStatus(a) === 'FAILED').length;
    const idle     = apps.filter(a => ['SCALED TO ZERO', 'IDLE'].includes(getStatus(a))).length;
    const ns       = [...new Set(apps.map(a => a.namespace).filter(Boolean))];
    const colors   = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4'];
    const color    = colors[username.charCodeAt(0) % colors.length];

    return (
        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
            {/* Group header */}
            <div
                onClick={() => setCollapsed(c => !c)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', background: collapsed ? 'transparent' : `${color}08`, borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)', transition: 'background 0.2s' }}
            >
                <UserAvatar name={username} size={38} />
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}>{username}</span>
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>·</span>
                        {ns.map(n => (
                            <span key={n} style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '1px 6px', borderRadius: 4 }}>
                                {n}
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#475569' }}>{apps.length} service{apps.length > 1 ? 's' : ''}</span>
                        {running  > 0 && <span style={{ fontSize: 10, color: '#10B981' }}>● {running} running</span>}
                        {idle     > 0 && <span style={{ fontSize: 10, color: '#6B7280' }}>● {idle} idle</span>}
                        {failed   > 0 && <span style={{ fontSize: 10, color: '#EF4444' }}><AlertTriangle size={10} style={{ verticalAlign: 'middle' }} /> {failed} failed</span>}
                    </div>
                </div>

                {/* Health bar */}
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {apps.map((a, i) => {
                        const st = getStatus(a);
                        const c = st === 'RUNNING' ? '#10B981' : st === 'FAILED' ? '#EF4444' : '#475569';
                        return <div key={i} title={a.serviceName} style={{ width: 6, height: 20, borderRadius: 3, background: c, opacity: 0.8 }} />;
                    })}
                </div>

                <ChevronDown size={16} style={{ color: '#475569', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
            </div>

            {/* Apps table */}
            <AnimatePresence>
                {!collapsed && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    {['Service', 'Namespace', 'Status', 'Replicas', 'Resources', 'URL', 'Actions'].map((h, i, arr) => (
                                        <th key={h} style={{ padding: '8px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i === arr.length - 1 ? 'right' : 'left', background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {apps.map(app => (
                                    <AdminAppRow key={app.id} app={app} onDelete={onDelete} navigate={navigate} />
                                ))}
                            </tbody>
                        </table>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ── App CARD (client view) ─────────────────────────────────────────────────────
const AppCard = ({ app, onDelete, navigate }) => {
    const [hov, setHov] = useState(false);
    const status = getStatus(app);
    const cfg = STATUS_CFG[status] || STATUS_CFG.default;
    const name = app.serviceName || app.name || 'Unnamed';
    const replicas = app.replicas ?? 0;
    const maxReplicas = app.maxReplicas ?? 5;
    const pct = Math.min(100, Math.round((replicas / Math.max(maxReplicas, 1)) * 100));
    const [g0] = gradientFor(name);

    return (
        <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            onClick={() => navigate(`/apps/${app.id}`)}
            style={{ background: hov ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.02)', border: hov ? `1px solid ${g0}50` : '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden', boxShadow: hov ? `0 8px 32px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${g0}00, ${g0}CC, ${g0}00)`, opacity: hov ? 1 : 0.4, transition: 'opacity 0.3s' }} />
            {status === 'RUNNING' && <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: cfg.color, boxShadow: cfg.glow, animation: 'pulse 2s infinite' }} />}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <AppAvatar name={name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: '#F1F5F9', margin: '0 0 3px', fontFamily: "'Outfit', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16 }}>{name}</h3>
                    {app.imageName && <p style={{ fontSize: 10, margin: '0 0 6px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.imageName.split('/').pop()?.split(':')[0]}</p>}
                    <StatusBadge status={status} pulse />
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{replicas === 0 ? 'Scale to zero' : `${replicas} / ${maxReplicas} pods`}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, fontFamily: "'JetBrains Mono', monospace" }}>{replicas === 0 ? '—' : `${pct}%`}</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 99, boxShadow: replicas > 0 ? `0 0 6px ${cfg.color}80` : 'none' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <Chip icon={Cpu} label={`${app.cpuRequest || '100m'} CPU`} color="#3B82F6" />
                    <Chip icon={MemoryStick} label={`${app.memoryRequest || '128Mi'} RAM`} color="#8B5CF6" />
                    {app.namespace && <Chip icon={Server} label={app.namespace} color="#F59E0B" />}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                <span style={{ fontSize: 10, color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>{app.id?.toString().slice(0, 8).toUpperCase()}</span>
                <div style={{ display: 'flex', gap: 5, opacity: hov ? 1 : 0, transform: hov ? 'translateX(0)' : 'translateX(6px)', transition: 'all 0.2s' }}>
                    <CardAction icon={Terminal} label="Logs" color="#3B82F6" onClick={e => { e.stopPropagation(); navigate(`/apps/${app.id}`); }} />
                    <CardAction icon={ExternalLink} label="Open" color="#10B981" onClick={e => { e.stopPropagation(); navigate(`/apps/${app.id}`); }} />
                </div>
            </div>
        </motion.div>
    );
};

// ── App TABLE ROW (client list view) ──────────────────────────────────────────
const AppRow = ({ app, navigate }) => {
    const [hov, setHov] = useState(false);
    const status = getStatus(app);
    const cfg = STATUS_CFG[status] || STATUS_CFG.default;
    const name = app.serviceName || app.name || 'Unnamed';
    const replicas = app.replicas ?? 0;
    const maxReplicas = app.maxReplicas ?? 5;
    const pct = Math.min(100, Math.round((replicas / Math.max(maxReplicas, 1)) * 100));
    return (
        <motion.tr layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            onClick={() => navigate(`/apps/${app.id}`)}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: hov ? 'rgba(255,255,255,0.025)' : 'transparent', transition: 'background 0.15s', cursor: 'pointer' }}>
            <td style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AppAvatar name={name} size={34} />
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{name}</p>
                        <p style={{ fontSize: 10, color: '#334155', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>{app.id?.toString().slice(0, 8).toUpperCase()}</p>
                    </div>
                </div>
            </td>
            <td style={{ padding: '14px 20px' }}><StatusBadge status={status} pulse /></td>
            <td style={{ padding: '14px 20px' }}>
                {replicas === 0 ? <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>Scale to zero</span>
                : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{replicas}/{maxReplicas}</span>
                    <div style={{ width: 56, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 99 }} />
                    </div>
                </div>}
            </td>
            <td style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                    <Chip icon={Cpu} label={app.cpuRequest || '100m'} color="#3B82F6" />
                    <Chip icon={MemoryStick} label={app.memoryRequest || '128Mi'} color="#8B5CF6" />
                </div>
            </td>
            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', opacity: hov ? 1 : 0, transition: 'opacity 0.2s' }}>
                    <CardAction icon={Terminal} label="Logs" color="#3B82F6" onClick={e => { e.stopPropagation(); navigate(`/apps/${app.id}`); }} />
                    <CardAction icon={ExternalLink} label="Open" color="#10B981" onClick={e => { e.stopPropagation(); navigate(`/apps/${app.id}`); }} />
                    <CardAction icon={ChevronRight} label="Details" color="#94A3B8" onClick={e => { e.stopPropagation(); navigate(`/apps/${app.id}`); }} />
                </div>
            </td>
        </motion.tr>
    );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const AppsList = () => {
    const navigate   = useNavigate();
    const { user }   = useAuth();
    const { dark }   = useTheme();
    const isAdmin    = user?.role === 'ADMIN';
    const [apps, setApps]           = useState([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [statusFilter, setStatus] = useState('ALL');
    const [viewMode, setViewMode]   = useState(isAdmin ? 'grouped' : 'grid');
    const [refreshing, setRefreshing] = useState(false);

    const load = async (silent = false) => {
        if (!silent) setLoading(true); else setRefreshing(true);
        try {
            const res = isAdmin ? await adminApi.getAllApps() : await appsApi.list();
            setApps(Array.isArray(res.data) ? res.data : []);
        } catch { setApps([]); }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { load(); }, [isAdmin]);

    // Filtered list
    const filtered = useMemo(() => {
        const lc = search.toLowerCase();
        return apps.filter(app => {
            const name = (app.serviceName || app.name || '').toLowerCase();
            const matchSearch = !search || name.includes(lc) || (app.imageName || '').toLowerCase().includes(lc) || (app.userId || '').toLowerCase().includes(lc) || (app.namespace || '').toLowerCase().includes(lc);
            const appStatus = getStatus(app);
            const matchStatus = statusFilter === 'ALL' || appStatus === statusFilter;
            return matchSearch && matchStatus;
        });
    }, [apps, search, statusFilter]);

    // Group by userId (admin view)
    const grouped = useMemo(() => {
        const map = {};
        filtered.forEach(app => {
            const key = app.userId || app.namespace || 'unknown';
            if (!map[key]) map[key] = [];
            map[key].push(app);
        });
        return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
    }, [filtered]);

    const running   = apps.filter(a => getStatus(a) === 'RUNNING').length;
    const idle      = apps.filter(a => getStatus(a) === 'SCALED TO ZERO').length;
    const failed    = apps.filter(a => getStatus(a) === 'FAILED').length;
    const tenants   = [...new Set(apps.map(a => a.userId).filter(Boolean))].length;

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Force delete "${name}"?`)) return;
        try { await adminApi.forceDelete(id); load(true); } catch {}
    };

    const STATUS_FILTERS = [
        { key: 'ALL',            label: 'All',            count: apps.length  },
        { key: 'RUNNING',        label: 'Running',        count: running       },
        { key: 'SCALED TO ZERO', label: 'Idle',           count: idle          },
        { key: 'FAILED',         label: 'Failed',         count: failed        },
    ];

    return (
        <div style={{ maxWidth: 1200 }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', color: isAdmin ? '#EF4444' : '#3B82F6', margin: '0 0 6px' }}>
                    {isAdmin ? 'Admin · All Tenants' : 'My Services'}
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#F1F5F9', margin: '0 0 3px', letterSpacing: '-0.02em' }}>
                            {isAdmin ? 'Platform Services' : 'Applications'}
                        </h1>
                        <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                            {isAdmin ? `${apps.length} services across ${tenants} tenant${tenants > 1 ? 's' : ''}` : 'Your deployed services and serverless functions.'}
                        </p>
                    </div>
                    {!isAdmin && (
                        <button onClick={() => navigate('/apps/new')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}>
                            <Plus size={15} /> Deploy New Service
                        </button>
                    )}
                </div>
            </div>

            {/* ── Suspension banner (client only) ── */}
            {!isAdmin && user?.suspended && (
                <div style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 12, padding: '14px 18px', marginBottom: 20,
                }}>
                    <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                    <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#FCA5A5', margin: '0 0 2px' }}>
                            Votre compte est suspendu
                        </p>
                        <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>
                            Vos services ne sont plus accessibles. Veuillez contacter le support pour régulariser votre situation.
                        </p>
                    </div>
                </div>
            )}

            {/* ── KPI bar ── */}
            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                    {[
                        { label: 'Total',    value: apps.length, color: '#94A3B8', icon: Package   },
                        { label: 'Running',  value: running,     color: '#10B981', icon: Activity  },
                        { label: 'Idle',     value: idle,        color: '#6B7280', icon: Zap       },
                        { label: 'Failed',   value: failed,      color: '#EF4444', icon: Server    },
                        ...(isAdmin ? [{ label: 'Tenants', value: tenants, color: '#8B5CF6', icon: Users }] : []),
                    ].map(k => (
                        <div key={k.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${k.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <k.icon size={14} color={k.color} />
                            </div>
                            <div>
                                <p style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
                                <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                    <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isAdmin ? 'Search by name, user, namespace…' : 'Search apps…'}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F5F9', borderRadius: 9, padding: '8px 11px 8px 32px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                </div>

                <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: 3, flexWrap: 'wrap' }}>
                    {STATUS_FILTERS.filter(f => f.count > 0 || f.key === 'ALL').map(f => {
                        const active = statusFilter === f.key;
                        return (
                            <button key={f.key} onClick={() => setStatus(f.key)} style={{ fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', color: active ? '#F1F5F9' : '#475569', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {f.label}
                                <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", padding: '1px 5px', borderRadius: 999, background: active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)', color: active ? '#A5B4FC' : '#475569' }}>{f.count}</span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ flex: 1 }} />

                <button onClick={() => load(true)} disabled={refreshing} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                </button>

                {/* View toggle — admin: Grouped + List | client: Grid + List */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 2, gap: 2 }}>
                    {(isAdmin
                        ? [{ mode: 'grouped', Icon: FolderOpen, tip: 'By user' }, { mode: 'list', Icon: List, tip: 'Table' }]
                        : [{ mode: 'grid', Icon: LayoutGrid, tip: 'Grid' }, { mode: 'list', Icon: List, tip: 'List' }]
                    ).map(({ mode, Icon, tip }) => (
                        <button key={mode} onClick={() => setViewMode(mode)} title={tip} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: viewMode === mode ? 'rgba(255,255,255,0.1)' : 'transparent', color: viewMode === mode ? '#F1F5F9' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            <Icon size={12} />
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ height: 160, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '70px 24px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 16 }}>
                    <Package size={36} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: 14 }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#475569', margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" }}>
                        {search || statusFilter !== 'ALL' ? 'No services match your filters' : 'No services yet'}
                    </h3>
                    {!isAdmin && (
                        <button onClick={() => navigate('/apps/new')} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 9, background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                            <Plus size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Deploy your first service
                        </button>
                    )}
                </div>

            ) : isAdmin && viewMode === 'grouped' ? (
                /* ── ADMIN GROUPED VIEW ── */
                <div>
                    {grouped.map(([userId, userApps]) => (
                        <UserGroup key={userId} userId={userId} apps={userApps} onDelete={handleDelete} navigate={navigate} />
                    ))}
                    <div style={{ marginTop: 8, fontSize: 11, color: '#334155', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }}>
                        {filtered.length} services · {grouped.length} tenant{grouped.length > 1 ? 's' : ''}
                    </div>
                </div>

            ) : isAdmin && viewMode === 'list' ? (
                /* ── ADMIN FLAT TABLE ── */
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                {['Service', 'Tenant / User', 'Namespace', 'Status', 'Replicas', 'Resources', 'Actions'].map((h, i, arr) => (
                                    <th key={h} style={{ padding: '11px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i === arr.length - 1 ? 'right' : 'left', background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {filtered.map(app => (
                                    <AdminAppRow key={app.id} app={app} onDelete={handleDelete} navigate={navigate} />
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                    <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#334155', fontFamily: "'JetBrains Mono', monospace", display: 'flex', justifyContent: 'space-between' }}>
                        <span>{filtered.length} / {apps.length} services</span>
                        <span>{running} running · {idle} idle · {failed} failed</span>
                    </div>
                </div>

            ) : viewMode === 'grid' ? (
                /* ── CLIENT GRID VIEW ── */
                <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
                    <AnimatePresence>
                        {filtered.map(app => <AppCard key={app.id ?? app.serviceName} app={app} onDelete={handleDelete} navigate={navigate} />)}
                    </AnimatePresence>
                </motion.div>

            ) : (
                /* ── CLIENT LIST VIEW ── */
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                {['Service', 'Status', 'Replicas', 'Resources', 'Actions'].map((h, i, arr) => (
                                    <th key={h} style={{ padding: '11px 20px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i === arr.length - 1 ? 'right' : 'left', background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {filtered.map(app => <AppRow key={app.id ?? app.serviceName} app={app} navigate={navigate} />)}
                            </AnimatePresence>
                        </tbody>
                    </table>
                    <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: '#334155', fontFamily: "'JetBrains Mono', monospace", display: 'flex', justifyContent: 'space-between' }}>
                        <span>{filtered.length} / {apps.length} services</span>
                        <span>{running} running · {idle} idle · {failed} failed</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppsList;
