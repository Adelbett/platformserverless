import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
    ArrowLeft, ExternalLink, RefreshCw, Trash2, Edit3,
    ChevronDown, Eye, EyeOff, Search, Copy, Check,
    Minus, Plus, Sliders, Terminal, GitBranch,
    Shield, AlertTriangle
} from 'lucide-react';
import { appsApi, logsApi, metricsApi, adminApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_APP = {
    id: 'api-gateway', name: 'api-gateway', status: 'RUNNING',
    imageName: 'ghcr.io/nextstep', imageTag: 'v2.1.4',
    namespace: 'production', port: 8080,
    minReplicas: 2, maxReplicas: 8, replicas: 3,
    cpuRequest: '250m', memoryRequest: '512Mi',
    url: 'api-gateway.nextstep.app',
    createdAt: '2025-11-15T09:22:00Z',
    deployedAt: '2026-04-22T10:47:00Z',
};

const MOCK_ENV = [
    { key: 'DATABASE_URL',  value: 'postgresql://prod-db.nextstep.internal:5432/api', secret: true  },
    { key: 'REDIS_URL',     value: 'redis://cache.nextstep.internal:6379',            secret: true  },
    { key: 'JWT_SECRET',    value: 'sk-prod-xxxxxxxxxxxxxxxxxxxxxxxx',                secret: true  },
    { key: 'LOG_LEVEL',     value: 'info',                                            secret: false },
    { key: 'PORT',          value: '8080',                                            secret: false },
    { key: 'NODE_ENV',      value: 'production',                                      secret: false },
    { key: 'API_VERSION',   value: 'v2',                                              secret: false },
];

const MOCK_DEPLOYMENTS = [
    { id: 'd4', version: 'v2.1.4', status: 'active',  by: 'adelbettaieb97', time: '10 min ago',  hash: 'a3f9c12', msg: 'fix: improve auth token validation'  },
    { id: 'd3', version: 'v2.1.3', status: 'success', by: 'adelbettaieb97', time: '2 days ago',  hash: '8b2e741', msg: 'feat: add rate limiting middleware'   },
    { id: 'd2', version: 'v2.1.2', status: 'success', by: 'adelbettaieb97', time: '5 days ago',  hash: 'c91a034', msg: 'chore: bump dependencies'             },
    { id: 'd1', version: 'v2.0.0', status: 'success', by: 'system',          time: '2 weeks ago', hash: 'f5d3b89', msg: 'feat: major API v2 release'            },
];

const MOCK_LOGS = [
    { id:  1, level: 'INFO',  time: '10:54:23', msg: 'Server started on port 8080'                                                           },
    { id:  2, level: 'INFO',  time: '10:54:24', msg: 'Connected to PostgreSQL at prod-db.nextstep.internal'                                  },
    { id:  3, level: 'INFO',  time: '10:54:25', msg: 'Redis cache initialized, pool size: 10'                                                },
    { id:  4, level: 'INFO',  time: '10:54:30', msg: 'GET /health 200 2ms'                                                                   },
    { id:  5, level: 'WARN',  time: '10:55:01', msg: 'Rate limit threshold reached for IP 192.168.1.45 (450/500)'                            },
    { id:  6, level: 'INFO',  time: '10:55:14', msg: 'POST /api/v2/auth/token 200 18ms'                                                      },
    { id:  7, level: 'INFO',  time: '10:55:22', msg: 'GET /api/v2/users 200 34ms'                                                            },
    { id:  8, level: 'ERROR', time: '10:55:41', msg: 'Upstream timeout: service ml-inference did not respond within 5000ms'                  },
    { id:  9, level: 'INFO',  time: '10:55:42', msg: 'Retry 1/3 for ml-inference'                                                            },
    { id: 10, level: 'WARN',  time: '10:55:47', msg: 'Circuit breaker for ml-inference: HALF_OPEN'                                           },
    { id: 11, level: 'INFO',  time: '10:56:01', msg: 'GET /api/v2/metrics 200 8ms'                                                           },
    { id: 12, level: 'INFO',  time: '10:56:18', msg: 'DELETE /api/v2/sessions/xyz 204 6ms'                                                   },
];

const genSeries = (n, base, v) =>
    Array.from({ length: n }, (_, i) => ({
        t: `${String(Math.floor((60 - n + i) / 60)).padStart(2,'0')}:${String((60 - n + i) % 60).padStart(2,'0')}`,
        v: Math.max(0, base + (Math.random() - 0.5) * v),
    }));

// ── Metric formatters ──────────────────────────────────────────────────────────

const fmtReq  = v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1);
const fmtPct  = v => `${(v * 100).toFixed(2)}%`;
const fmtMs   = v => v < 1 ? `${(v * 1000).toFixed(0)}µs` : `${v.toFixed(1)}ms`;
const fmtMiB  = v => v >= 1024 ? `${(v / 1024).toFixed(1)}GiB` : `${v.toFixed(0)}MiB`;

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const cls = { RUNNING: 'badge-running', IDLE: 'badge-idle', ERROR: 'badge-error', PENDING: 'badge-pending' };
    const dot = { RUNNING: '#10B981', IDLE: '#F59E0B', ERROR: '#EF4444', PENDING: '#3B82F6' };
    return (
        <span className={cls[status] || 'badge-pending'}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot[status] || '#3B82F6', display: 'inline-block', ...(status === 'RUNNING' || status === 'ERROR' ? { animation: 'pulseDot 2s ease-in-out infinite' } : {}) }} />
            {status || 'PENDING'}
        </span>
    );
};

// ── Metric mini ────────────────────────────────────────────────────────────────

const MetricMini = ({ label, value, color }) => (
    <div className="ns-card" style={{ padding: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B', margin: '0 0 6px' }}>{label}</p>
        <p style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0, color }}>{value}</p>
    </div>
);

// ── Env row ────────────────────────────────────────────────────────────────────

const EnvRow = ({ item, dark }) => {
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied]     = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(item.value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    };
    return (
        <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 150ms' }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <span style={{ width: '38%', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#00D4FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.key}</span>
            <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-secondary">
                {item.secret && !revealed ? '•'.repeat(Math.min(item.value.length, 22)) : item.value}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {item.secret && (
                    <button className="btn-ghost" style={{ padding: '3px 6px' }} onClick={() => setRevealed(r => !r)} title={revealed ? 'Hide' : 'Reveal'}>
                        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                )}
                <button className="btn-ghost" style={{ padding: '3px 6px' }} onClick={copy} title="Copy">
                    {copied ? <Check size={13} style={{ color: '#10B981' }} /> : <Copy size={13} />}
                </button>
            </div>
        </div>
    );
};

// ── Deployment timeline ────────────────────────────────────────────────────────

const DeploymentTimeline = ({ deployments }) => (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
        <div style={{ position: 'absolute', left: 10, top: 8, bottom: 8, width: 1, background: 'rgba(0,0,0,0.08)' }} />
        {deployments.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 14, paddingBottom: i < deployments.length - 1 ? 24 : 0 }}>
                <div style={{
                    position: 'absolute', left: -15, width: 20, height: 20, borderRadius: '50%',
                    background: d.status === 'active' ? '#10B981' : d.status === 'failed' ? '#EF4444' : '#00D4FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid',
                    borderColor: d.status === 'active' ? '#047857' : d.status === 'failed' ? '#B91C1C' : '#0066FF',
                }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', opacity: 0.85 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }} className="text-primary">{d.version}</span>
                        {d.status === 'active' && <span className="badge-running" style={{ fontSize: 9, padding: '2px 7px' }}>Active</span>}
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{d.time} · by {d.by}</span>
                    </div>
                    <p style={{ fontSize: 12, margin: '3px 0 0' }} className="text-secondary">{d.msg}</p>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#9CA3AF' }}>{d.hash}</span>
                </div>
            </motion.div>
        ))}
    </div>
);

// ── Log viewer ─────────────────────────────────────────────────────────────────

const LogViewer = ({ logs, dark }) => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('ALL');
    const levelColor = { INFO: '#3B82F6', WARN: '#F59E0B', ERROR: '#EF4444' };
    const levelBg    = { INFO: 'transparent', WARN: 'rgba(245,158,11,0.04)', ERROR: 'rgba(239,68,68,0.04)' };

    const filtered = logs.filter(l =>
        (filter === 'ALL' || l.level === filter) &&
        ((l.msg ?? '').toLowerCase().includes(search.toLowerCase()) || (l.time ?? '').includes(search))
    );

    return (
        <div className="ns-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Terminal size={15} style={{ color: '#64748B' }} />
                    <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }} className="text-primary">Log Viewer</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>({filtered.length})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 2, background: dark ? '#1F2937' : '#F1F5F9', borderRadius: 7, padding: 3 }}>
                        {['ALL','INFO','WARN','ERROR'].map(f => (
                            <button key={f} onClick={() => setFilter(f)} style={{
                                padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                                fontSize: 10, fontWeight: 700, transition: 'all 150ms',
                                background: filter === f ? (dark ? '#111827' : '#FFFFFF') : 'transparent',
                                color: filter === f ? (f === 'ALL' ? '#00D4FF' : f === 'INFO' ? '#3B82F6' : f === 'WARN' ? '#F59E0B' : '#EF4444') : '#64748B',
                                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                            }}>{f}</button>
                        ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                        <input className="ns-input" style={{ paddingLeft: 28, height: 32, fontSize: 12, width: 160 }}
                            placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>
            </div>
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                {filtered.map((log, i) => (
                    <div key={log.id || i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '7px 20px',
                        borderBottom: '1px solid rgba(0,0,0,0.03)',
                        background: levelBg[log.level] || 'transparent',
                    }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#9CA3AF', flexShrink: 0, tabularNums: 'tabular-nums' }}>{log.time}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: levelColor[log.level] || '#9CA3AF', width: 44, flexShrink: 0 }}>{log.level}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, wordBreak: 'break-all' }} className="text-secondary">{log.msg}</span>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>No matching log entries</div>
                )}
            </div>
        </div>
    );
};

// ── Rollback confirm modal ───────────────────────────────────────────────────────

const RollbackModal = ({ revisionName, onConfirm, onClose, loading }) => (
    <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 50 }} onClick={onClose} />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 51, padding: 16 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="ns-card" style={{ width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GitBranch size={20} style={{ color: '#00D4FF' }} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Roll back traffic</h3>
                        <p style={{ fontSize: 12, margin: '2px 0 0' }} className="text-secondary">100% of traffic will be redirected.</p>
                    </div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: '#0EA5C4', margin: 0 }}>
                        Traffic will be routed to <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{revisionName}</strong>. No rebuild needed — this is instant.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="btn-primary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={onConfirm} disabled={loading}>
                        {loading ? 'Rolling back…' : <><GitBranch size={14} /> Confirm rollback</>}
                    </button>
                </div>
            </motion.div>
        </div>
    </>
);

// ── Revision history (Knative revisions + rollback) ─────────────────────────────

const RevisionHistory = ({ appId, dark }) => {
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [target, setTarget] = useState(null);
    const [rollingBack, setRollingBack] = useState(false);
    const [error, setError] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const res = await appsApi.listRevisions(appId);
            setRevisions(Array.isArray(res.data) ? res.data : []);
        } catch {
            setRevisions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [appId]);

    const handleConfirm = async () => {
        if (!target) return;
        setRollingBack(true);
        setError(null);
        try {
            await appsApi.rollback(appId, target);
            setTarget(null);
            await load();
        } catch {
            setError('Rollback failed. Check that the revision still exists on the cluster.');
        } finally {
            setRollingBack(false);
        }
    };

    return (
        <div className="ns-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GitBranch size={15} style={{ color: '#9CA3AF' }} />
                    <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Revisions &amp; Rollback</h3>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>({revisions.length})</span>
                </div>
                <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={load}>
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            {error && (
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{error}</p>
                </div>
            )}

            {loading ? (
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>Loading revisions…</p>
            ) : revisions.length === 0 ? (
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>No Knative revisions found for this app yet.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {revisions.map((rev, i) => (
                        <div key={rev.name} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 8,
                            background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            border: '1px solid rgba(0,0,0,0.05)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                    background: i === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                                    color: i === 0 ? '#10B981' : '#94A3B8',
                                }}>
                                    {i === 0 ? 'ACTIVE' : 'OLDER'}
                                </span>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} className="text-primary">{rev.name}</span>
                                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{rev.createdAt ? new Date(rev.createdAt).toLocaleString() : ''}</span>
                            </div>
                            {i !== 0 && (
                                <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setTarget(rev.name)}>
                                    Rollback here
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {target && (
                    <RollbackModal
                        revisionName={target}
                        onConfirm={handleConfirm}
                        onClose={() => !rollingBack && setTarget(null)}
                        loading={rollingBack}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// ── Container log viewer (live stdout/stderr via SSE) ──────────────────────────

const ContainerLogViewer = ({ appId, dark }) => {
    const [lines, setLines] = useState([]);
    const [connected, setConnected] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const endRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !appId) return;

        const es = new EventSource(`/api/logs/apps/${appId}/pod-logs/stream?token=${encodeURIComponent(token)}`);

        es.onopen = () => setConnected(true);
        es.onmessage = (e) => {
            setLines((prev) => [...prev.slice(-499), e.data]);
        };
        es.onerror = () => {
            setConnected(false);
            es.close();
        };

        return () => es.close();
    }, [appId]);

    useEffect(() => {
        if (autoScroll) endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lines, autoScroll]);

    return (
        <div className="ns-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Terminal size={15} style={{ color: '#64748B' }} />
                    <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }} className="text-primary">Container Logs</span>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20,
                        background: connected ? 'rgba(63,185,80,0.1)' : 'rgba(148,163,184,0.1)',
                        border: `1px solid ${connected ? 'rgba(63,185,80,0.25)' : 'rgba(148,163,184,0.25)'}`,
                        fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                        color: connected ? '#3FB950' : '#94A3B8',
                    }}>
                        {connected ? 'LIVE' : 'CONNECTING'}
                    </span>
                </div>
                <button onClick={() => setAutoScroll((v) => !v)} className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }}>
                    Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
                </button>
            </div>
            <div style={{
                background: '#020408', fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                minHeight: 240, maxHeight: 420, overflowY: 'auto', padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 2,
            }}>
                {lines.length === 0 ? (
                    <div style={{ color: '#5A7080' }}>Waiting for container output…</div>
                ) : (
                    lines.map((line, i) => (
                        <div key={i} style={{ color: '#A8B8C8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
                    ))
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
};

// ── Delete modal ───────────────────────────────────────────────────────────────

const DeleteModal = ({ appName, onConfirm, onClose }) => {
    const [input, setInput] = useState('');
    const ok = input === appName;
    return (
        <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 50 }} onClick={onClose} />
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 51, padding: 16 }}>
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="ns-card" style={{ width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <AlertTriangle size={20} style={{ color: '#EF4444' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Delete application</h3>
                            <p style={{ fontSize: 12, margin: '2px 0 0' }} className="text-secondary">This action cannot be undone.</p>
                        </div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
                        <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>All deployments, logs, and configuration for <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{appName}</strong> will be permanently destroyed.</p>
                    </div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B', marginBottom: 6 }}>
                        Type <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#EF4444' }}>{appName}</span> to confirm
                    </label>
                    <input className="ns-input" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginBottom: 16 }}
                        placeholder={appName} value={input} onChange={e => setInput(e.target.value)} autoFocus />
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button className="btn-danger"    style={{ flex: 1, opacity: ok ? 1 : 0.35, pointerEvents: ok ? 'auto' : 'none' }} onClick={onConfirm}>
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                </motion.div>
            </div>
        </>
    );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

const AppDetails = () => {
    const { name: id } = useParams();
    const navigate     = useNavigate();
    const { dark }     = useTheme();

    const { user } = useAuth();
    const [app,        setApp]        = useState(null);
    const [logs,       setLogs]       = useState([]);
    const [metrics,    setMetrics]    = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [replicas,      setReplicas]      = useState(0);
    const [applyingReplicas, setApplyingReplicas] = useState(false);
    const [envOpen,    setEnvOpen]    = useState(true);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [editOpen,   setEditOpen]   = useState(false);
    const [editForm,   setEditForm]   = useState({});
    const [editSaving, setEditSaving] = useState(false);

    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = dark ? '#4B5563' : '#94A3B8';

    // Fetch app info and logs once
    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const [appRes, logsRes] = await Promise.all([
                    appsApi.get(id).catch(() => ({ data: null })),
                    logsApi.getByApp(id).catch(() => ({ data: [] })),
                ]);
                if (!active) return;
                const a = appRes.data || MOCK_APP;
                setApp(a);
                setReplicas(a.minReplicas ?? 0);
                const rawLogs = Array.isArray(logsRes.data) ? logsRes.data : [];
                const mappedLogs = rawLogs.map(l => ({
                    id: l.id,
                    level: l.type?.includes('FAIL') || l.type?.includes('ERROR') ? 'ERROR'
                         : l.type?.includes('WARN') ? 'WARN' : 'INFO',
                    time: l.createdAt ? new Date(l.createdAt).toLocaleTimeString() : '',
                    msg: l.message || '',
                }));
                setLogs(mappedLogs.length > 0 ? mappedLogs : MOCK_LOGS);
            } catch { if (active) { setApp(MOCK_APP); setLogs(MOCK_LOGS); } }
            finally   { if (active) setLoading(false); }
        };
        load();
        return () => { active = false; };
    }, [id]);

    // SSE — métriques temps réel (token promu en header par SseTokenFilter côté backend)
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const es = new EventSource(`/api/metrics/apps/${id}/stream?token=${encodeURIComponent(token)}`);
        es.onmessage = (e) => {
            try {
                const m = JSON.parse(e.data);
                setMetrics(m);
                const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } catch {}
        };
        es.onerror = () => {
            es.close();
            // Fallback polling si SSE échoue
            metricsApi.getApp(id).then(r => setMetrics(r.data)).catch(() => {});
        };
        return () => es.close();
    }, [id]);

    const openEdit = () => {
        const a = app || MOCK_APP;
        setEditForm({
            imageName:     a.imageName     || '',
            imageTag:      a.imageTag      || 'latest',
            description:   a.description   || '',
            minReplicas:   a.minReplicas    ?? 0,
            maxReplicas:   a.maxReplicas    ?? 5,
            cpuRequest:    a.cpuRequest     || '100m',
            memoryRequest: a.memoryRequest  || '128Mi',
        });
        setEditOpen(true);
    };

    const saveEdit = async () => {
        setEditSaving(true);
        try {
            await appsApi.update(id, editForm);
            const res = await appsApi.get(id);
            setApp(res.data);
            setEditOpen(false);
        } catch (e) {
            alert('Update failed: ' + (e?.response?.data?.message || e.message));
        } finally {
            setEditSaving(false);
        }
    };

    const appData    = app || MOCK_APP;
    const appImage   = `${appData.imageName || 'nextstep/app'}${appData.imageTag ? `:${appData.imageTag}` : ''}`;
    const appUrl     = appData.url || '';
    const createdFmt = appData.createdAt
        ? new Date(appData.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="skeleton" style={{ height: 32, width: 180, borderRadius: 8 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />)}
                </div>
                <div className="skeleton" style={{ height: 256, borderRadius: 12 }} />
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>

            {/* Back */}
            <button className="btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={() => navigate(-1)}>
                <ArrowLeft size={14} /> Back
            </button>

            {/* App Header */}
            <div className="ns-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                            background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#00D4FF',
                        }}>
                            {(appData.name || appData.serviceName || 'AP').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <h1 style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                                    {appData.name || appData.serviceName || id}
                                </h1>
                                <StatusBadge status={appData.status} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} className="text-secondary">{appImage}</span>
                                <span style={{ fontSize: 12, color: '#9CA3AF' }}>ns: {appData.namespace || 'production'}</span>
                                <span style={{ fontSize: 12, color: '#9CA3AF' }}>Created {createdFmt}</span>
                                {appUrl && (
                                    <a href={appUrl.startsWith('http') ? appUrl : `https://${appUrl}`} target="_blank" rel="noreferrer"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#00D4FF', textDecoration: 'none' }}>
                                        <ExternalLink size={11} /> {appUrl}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button className="btn-secondary" style={{ fontSize: 12.5 }} onClick={openEdit}><Edit3 size={13} /> Edit</button>
                        <button className="btn-danger"    style={{ fontSize: 12.5 }} onClick={() => setDeleteOpen(true)}><Trash2 size={13} /> Delete</button>
                    </div>
                </div>
            </div>

            {/* Metrics row — real Prometheus data, falls back to "—" when cluster is unreachable */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <MetricMini label="Req / sec"   value={metrics ? fmtReq(metrics.reqPerSec)        : '—'} color="#00D4FF" />
                <MetricMini label="Error Rate"  value={metrics ? fmtPct(metrics.errorRate)        : '—'} color={metrics && metrics.errorRate > 0.05 ? '#EF4444' : '#10B981'} />
                <MetricMini label="P50 Latency" value={metrics ? fmtMs(metrics.p50LatencyMs)      : '—'} color={dark ? '#F9FAFB' : '#0F172A'} />
                <MetricMini label="P95 Latency" value={metrics ? fmtMs(metrics.p95LatencyMs)      : '—'} color="#F59E0B" />
                <MetricMini label="P99 Latency" value={metrics ? fmtMs(metrics.p99LatencyMs)      : '—'} color="#F97316" />
                <MetricMini label="Memory"      value={metrics ? fmtMiB(metrics.memoryMiB)        : '—'} color="#10B981" />
                <MetricMini label="CPU"         value={metrics?.cpuMillicores != null ? `${metrics.cpuMillicores}m` : appData.cpuRequest || '—'} color="#A855F7" />
                <MetricMini label="Uptime"      value={appData.deployedAt ? (() => {
                    const diff = Math.floor((Date.now() - new Date(appData.deployedAt)) / 1000);
                    if (diff < 3600)  return `${Math.floor(diff/60)}m`;
                    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
                    return `${Math.floor(diff/86400)}d`;
                })() : '—'} color="#3B82F6" />
            </div>

            {/* Replica slider */}
            <div className="ns-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0, display: 'flex', alignItems: 'center', gap: 8 }} className="text-primary">
                            <Sliders size={15} style={{ color: '#9CA3AF' }} /> Replica Control
                        </h3>
                        <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Adjust the number of running pods</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button className="btn-secondary" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={() => setReplicas(r => Math.max(0, r - 1))}><Minus size={14} /></button>
                        <span style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", width: 40, textAlign: 'center' }} className="text-primary">{replicas}</span>
                        <button className="btn-secondary" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }} onClick={() => setReplicas(r => Math.min(20, r + 1))}><Plus size={14} /></button>
                    </div>
                </div>
                <input type="range" min={0} max={20} value={replicas} onChange={e => setReplicas(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#00D4FF', cursor: 'pointer', height: 6 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>
                    <span>0</span>
                    <span style={{ color: '#00D4FF', fontWeight: 700 }}>{replicas} replica{replicas !== 1 ? 's' : ''}</span>
                    <span>20</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                    <button
                        className="btn-primary"
                        style={{ fontSize: 12.5, opacity: applyingReplicas ? 0.6 : 1 }}
                        disabled={applyingReplicas}
                        onClick={async () => {
                            setApplyingReplicas(true);
                            try {
                                await appsApi.update(id, { minReplicas: replicas });
                                const res = await appsApi.get(id);
                                setApp(res.data);
                            } catch (e) {
                                alert('Failed to update replicas: ' + (e?.response?.data?.message || e.message));
                            } finally {
                                setApplyingReplicas(false);
                            }
                        }}
                    >
                        <RefreshCw size={13} /> {applyingReplicas ? 'Applying...' : 'Apply'}
                    </button>
                </div>
            </div>

            {/* App Metadata & Environment Variables */}
            <div className="ns-card" style={{ overflow: 'hidden' }}>
                <button onClick={() => setEnvOpen(o => !o)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: envOpen ? '1px solid rgba(0,0,0,0.07)' : 'none', background: 'none', border: 'none', cursor: 'pointer', transition: 'background 150ms', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={15} style={{ color: '#9CA3AF' }} />
                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }} className="text-primary">App Configuration</span>
                    </div>
                    <ChevronDown size={16} style={{ color: '#9CA3AF', transform: envOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
                </button>
                <AnimatePresence initial={false}>
                    {envOpen && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                            {/* Section header: App Info */}
                            <div style={{ padding: '8px 20px', background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>Application Info</span>
                            </div>
                            {[
                                { key: 'APP_NAME',      value: appData.name || appData.serviceName || id,                      secret: false },
                                { key: 'IMAGE',         value: appImage,                                                        secret: false },
                                { key: 'PORT',          value: String(appData.port || '—'),                                     secret: false },
                                { key: 'NAMESPACE',     value: appData.namespace || '—',                                        secret: false },
                                { key: 'STATUS',        value: appData.status || '—',                                           secret: false },
                                { key: 'MIN_REPLICAS',  value: String(appData.minReplicas ?? '—'),                              secret: false },
                                { key: 'MAX_REPLICAS',  value: String(appData.maxReplicas ?? '—'),                              secret: false },
                                { key: 'CPU_REQUEST',   value: appData.cpuRequest || '—',                                       secret: false },
                                { key: 'MEMORY_REQUEST',value: appData.memoryRequest || '—',                                    secret: false },
                                { key: 'URL',           value: appData.url || '—',                                              secret: false },
                            ].map(item => <EnvRow key={item.key} item={item} dark={dark} />)}
                            {/* Section header: Kafka */}
                            <div style={{ padding: '8px 20px', background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.05)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>Kafka / Eventing</span>
                            </div>
                            {[
                                { key: 'KAFKA_TOPIC',          value: appData.kafkaTopic        || appData.kafkaTopicId  || '—', secret: false },
                                { key: 'KAFKA_CONSUMER_GROUP', value: appData.kafkaConsumerGroup || appData.serviceName  || '—', secret: false },
                                { key: 'KAFKA_SOURCE',         value: appData.kafkaSourceName   || '—',                         secret: false },
                                { key: 'TRIGGER_FILTER',       value: appData.triggerFilter     || '—',                         secret: false },
                            ].map(item => <EnvRow key={item.key} item={item} dark={dark} />)}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Deployment History — real logs filtered by DEPLOYMENT type */}
            <div className="ns-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <GitBranch size={15} style={{ color: '#9CA3AF' }} />
                    <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Deployment History</h3>
                </div>
                {(() => {
                    const deploys = logs.filter(l => l.type?.includes('DEPLOY') || l.type?.includes('DELETE') || l.msg?.toLowerCase().includes('deploy'));
                    if (deploys.length === 0) return <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>No deployment events recorded yet.</p>;
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: 20 }}>
                            <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 1, background: 'rgba(0,0,0,0.08)' }} />
                            {deploys.slice(0, 8).map((d, i) => {
                                const isSuccess = d.level === 'INFO' || d.type === 'DEPLOYMENT_SUCCESS';
                                const isError   = d.level === 'ERROR' || d.type?.includes('FAIL');
                                const dot = isError ? '#EF4444' : isSuccess ? '#10B981' : '#00D4FF';
                                return (
                                    <div key={d.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 16, position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: -14, width: 14, height: 14, borderRadius: '50%', background: dot, border: '2px solid', borderColor: isError ? '#B91C1C' : '#047857', flexShrink: 0, marginTop: 2 }} />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: 12, margin: 0, fontWeight: 600 }} className="text-primary">{d.msg}</p>
                                            <p style={{ fontSize: 10, margin: '3px 0 0', color: '#9CA3AF' }}>{d.time}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>

            {/* Revisions & Rollback */}
            <RevisionHistory appId={id} dark={dark} />

            {/* Log Viewer */}
            <LogViewer logs={logs.length > 0 ? logs : MOCK_LOGS} dark={dark} />

            {/* Container Logs (live stdout/stderr) */}
            <ContainerLogViewer appId={id} dark={dark} />

            {/* Danger Zone */}
            <div className="ns-card" style={{ padding: 20, borderColor: 'rgba(239,68,68,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <AlertTriangle size={16} style={{ color: '#EF4444' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0, color: '#EF4444' }}>Danger Zone</h3>
                            <p style={{ fontSize: 12, margin: '3px 0 0' }} className="text-secondary">Permanently delete this application and all its data. This cannot be undone.</p>
                        </div>
                    </div>
                    <button className="btn-danger" style={{ fontSize: 12.5, flexShrink: 0 }} onClick={() => setDeleteOpen(true)}>
                        <Trash2 size={13} /> Delete Application
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {deleteOpen && (
                    <DeleteModal
                        appName={appData.name || appData.serviceName || id}
                        onConfirm={async () => {
                            try {
                                await appsApi.delete(id);
                                setDeleteOpen(false);
                                navigate('/apps');
                            } catch (err) {
                                console.error('Delete failed:', err);
                                setDeleteOpen(false);
                            }
                        }}
                        onClose={() => setDeleteOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            {editOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9998 }} onClick={() => setEditOpen(false)} />
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
                        <div className="ns-card" style={{ width: '100%', maxWidth: 560, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, pointerEvents: 'auto', boxShadow: '0 25px 80px rgba(0,0,0,0.5)' }}>

                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }} className="text-primary">Edit Application</h2>
                                    <p style={{ margin: '3px 0 0', fontSize: 11 }} className="text-secondary">{appData.name || appData.serviceName} — changes trigger a redeploy</p>
                                </div>
                                <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 16 }} onClick={() => setEditOpen(false)}>✕</button>
                            </div>

                            {/* Image */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Image Name</label>
                                    <input className="ns-input" value={editForm.imageName || ''} onChange={e => setEditForm(f => ({ ...f, imageName: e.target.value }))}
                                        placeholder="e.g. adelbettaieb/myapp" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tag</label>
                                    <input className="ns-input" value={editForm.imageTag || ''} onChange={e => setEditForm(f => ({ ...f, imageTag: e.target.value }))}
                                        placeholder="latest" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                                </div>
                            </div>

                            {/* Description */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Description</label>
                                <input className="ns-input" value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="App description" style={{ fontSize: 13 }} />
                            </div>

                            {/* Replicas */}
                            <div>
                                <label style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Replicas</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4 }}>Min (0 = scale-to-zero)</label>
                                        <input className="ns-input" type="number" min="0" max="10" value={editForm.minReplicas ?? 0}
                                            onChange={e => setEditForm(f => ({ ...f, minReplicas: parseInt(e.target.value) || 0 }))} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4 }}>Max</label>
                                        <input className="ns-input" type="number" min="1" max="50" value={editForm.maxReplicas ?? 5}
                                            onChange={e => setEditForm(f => ({ ...f, maxReplicas: parseInt(e.target.value) || 1 }))} />
                                    </div>
                                </div>
                            </div>

                            {/* Resources */}
                            <div>
                                <label style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Resources</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4 }}>CPU Request</label>
                                        <input className="ns-input" value={editForm.cpuRequest || ''} onChange={e => setEditForm(f => ({ ...f, cpuRequest: e.target.value }))}
                                            placeholder="100m" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4 }}>Memory Request</label>
                                        <input className="ns-input" value={editForm.memoryRequest || ''} onChange={e => setEditForm(f => ({ ...f, memoryRequest: e.target.value }))}
                                            placeholder="128Mi" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                                    </div>
                                </div>
                            </div>

                            {/* Info box */}
                            <div style={{ padding: '10px 14px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8, fontSize: 11, color: '#5A7080' }}>
                                ⚡ Saving will trigger a new Knative deployment. The app will briefly restart.
                            </div>

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                                <button className="btn-primary" onClick={saveEdit} disabled={editSaving} style={{ opacity: editSaving ? 0.6 : 1 }}>
                                    {editSaving ? 'Saving...' : 'Save & Redeploy'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AppDetails;
