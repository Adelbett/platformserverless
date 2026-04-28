import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appsApi } from '../api';

/* ── Color tokens (matching the HTML reference design) ── */
const C = {
    bg:        '#0a0a0a',
    card:      '#111111',
    cardMid:   '#1a1a1a',
    border:    'rgba(255,255,255,0.06)',
    borderHov: 'rgba(255,255,255,0.12)',
    primary:   '#0070f3',
    primaryBg: 'rgba(0,112,243,0.10)',
    primaryBd: 'rgba(0,112,243,0.22)',
    textWhite: '#ffffff',
    textSub:   '#a1a1aa',
    textMuted: '#52525b',
    amber:     '#f59e0b',
    amberBg:   'rgba(245,158,11,0.10)',
    amberBd:   'rgba(245,158,11,0.22)',
    red:       '#ef4444',
    redBg:     'rgba(239,68,68,0.10)',
    redBd:     'rgba(239,68,68,0.22)',
};

const STATUS = {
    RUNNING: { color: C.primary,  bg: C.primaryBg, border: C.primaryBd,  glow: '0 0 8px rgba(0,112,243,0.6)',  bar: C.primary  },
    SCALING: { color: C.amber,    bg: C.amberBg,   border: C.amberBd,    glow: '0 0 8px rgba(245,158,11,0.5)', bar: C.amber    },
    FAILED:  { color: C.red,      bg: C.redBg,     border: C.redBd,      glow: '0 0 8px rgba(239,68,68,0.5)',  bar: 'rgba(239,68,68,0.3)' },
    default: { color: C.textMuted,bg:'rgba(255,255,255,0.04)', border: C.border, glow: 'none', bar: 'rgba(255,255,255,0.1)' },
};

const StatusBadge = ({ status }) => {
    const s = STATUS[status] || STATUS.default;
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px', borderRadius: '999px',
            background: s.bg, border: `1px solid ${s.border}`,
        }}>
            <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: s.color, boxShadow: s.glow,
            }} />
            <span style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: s.color,
                fontFamily: "'Space Grotesk', sans-serif",
            }}>{status || 'UNKNOWN'}</span>
        </div>
    );
};

/* ── Shared input style ── */
const inputStyle = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    color: C.textWhite,
    outline: 'none',
    fontFamily: "'Inter', sans-serif",
    fontSize: '13px',
    transition: 'border-color 0.15s',
};

const AppsList = () => {
    const navigate = useNavigate();
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All Status');

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                setLoading(true);
                const res = await appsApi.list();
                if (active) setApps(Array.isArray(res.data) ? res.data : []);
            } catch {
                if (active) setApps([]);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, []);

    const filtered = useMemo(() => {
        const lc = searchTerm.toLowerCase();
        return apps.filter(app => {
            const name = (app.serviceName || app.name || '').toLowerCase();
            const matchSearch = !searchTerm || name.includes(lc) ||
                (app.imageName || '').toLowerCase().includes(lc);
            const matchStatus = statusFilter === 'All Status' || app.status === statusFilter;
            return matchSearch && matchStatus;
        });
    }, [apps, searchTerm, statusFilter]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* ── Page Header ── */}
            <header>
                <p style={{
                    fontSize: '10px', fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: C.primary, marginBottom: '10px',
                }}>
                    Inventory Explorer
                </p>
                <h2 style={{
                    fontSize: '36px', fontWeight: 300, letterSpacing: '-0.02em',
                    color: C.textWhite, marginBottom: '12px', lineHeight: 1.1,
                }}>
                    Active Services
                </h2>
                <p style={{ color: C.textSub, maxWidth: '640px', lineHeight: 1.6, fontSize: '14px', fontWeight: 300 }}>
                    Manage and monitor your containerized workloads across global nodes.
                    Real-time telemetry is synced with Cloud Core v2.6 protocols.
                </p>
            </header>

            {/* ── Filter Bar ── */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ flex: '1 1 280px', position: 'relative' }}>
                    <span className="material-symbols-outlined" style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: C.textMuted, fontSize: '18px', pointerEvents: 'none',
                    }}>search</span>
                    <input
                        type="text"
                        placeholder="Search by service name, id, or host..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ ...inputStyle, width: '100%', padding: '11px 14px 11px 42px' }}
                        onFocus={e => e.target.style.borderColor = `${C.primary}80`}
                        onBlur={e => e.target.style.borderColor = C.border}
                    />
                </div>

                {/* Status filter */}
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{ ...inputStyle, padding: '11px 36px 11px 14px', minWidth: '150px', cursor: 'pointer' }}
                    onFocus={e => e.target.style.borderColor = `${C.primary}80`}
                    onBlur={e => e.target.style.borderColor = C.border}
                >
                    <option value="All Status">All Status</option>
                    <option value="RUNNING">Running</option>
                    <option value="SCALING">Scaling</option>
                    <option value="FAILED">Failed</option>
                </select>

                {/* Tags */}
                <button style={{
                    ...inputStyle, padding: '11px 16px',
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    color: C.textSub, whiteSpace: 'nowrap',
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>sell</span>
                    <span style={{ fontSize: '11px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tags</span>
                    <span style={{
                        width: '20px', height: '20px', borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700,
                        background: C.primaryBg, color: C.primary,
                    }}>3</span>
                </button>

                {/* Divider */}
                <div style={{ width: '1px', height: '32px', background: C.border }} />

                {/* Deploy */}
                <button
                    onClick={() => navigate('/apps/new')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '11px 24px', borderRadius: '8px', border: 'none',
                        background: C.primary, color: '#fff', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 600, fontFamily: "'Inter', sans-serif",
                        whiteSpace: 'nowrap', transition: 'filter 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
                    onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                    Deploy Service
                </button>
            </div>

            {/* ── Table ── */}
            <div style={{
                background: C.card, borderRadius: '12px',
                border: `1px solid ${C.border}`, overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.cardMid }}>
                            {['Service Name', 'Replicas', 'Resources', 'Status', 'Actions'].map((col, i) => (
                                <th key={col} style={{
                                    padding: '16px 28px',
                                    fontSize: '10px', fontFamily: "'Space Grotesk', sans-serif",
                                    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.18em',
                                    color: C.textMuted,
                                    textAlign: i === 2 ? 'center' : i === 4 ? 'right' : 'left',
                                }}>{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '60px 28px', textAlign: 'center', color: C.textMuted }}>
                                    <span style={{ fontSize: '10px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                        Loading services...
                                    </span>
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '60px 28px', textAlign: 'center', color: C.textMuted }}>
                                    <span style={{ fontSize: '10px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                        No services matching the criteria found
                                    </span>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((app, idx) => {
                                const s = STATUS[app.status] || STATUS.default;
                                const current = app.replicas ?? app.minReplicas ?? 1;
                                const total = app.maxReplicas ?? 5;
                                const pct = Math.min(100, Math.round((current / Math.max(total, 1)) * 100));
                                const appName = app.serviceName || app.name || 'Unnamed';
                                const nodeId = app.id ? app.id.toString().slice(0, 8).toUpperCase() : 'NODE_XX';
                                const location = `${app.namespace || 'default'} • ${nodeId}`;

                                return (
                                    <ServiceRow
                                        key={app.id ?? app.serviceName ?? app.name ?? idx}
                                        app={app}
                                        appName={appName}
                                        location={location}
                                        current={current}
                                        total={total}
                                        pct={pct}
                                        barColor={s.bar}
                                    />
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                <div style={{
                    padding: '16px 28px',
                    borderTop: `1px solid ${C.border}`,
                    background: `${C.cardMid}50`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <span style={{
                        fontSize: '10px', fontFamily: "'Space Grotesk', sans-serif",
                        letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textMuted,
                    }}>
                        Showing {filtered.length} of {apps.length} active services
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[
                            { label: null, icon: 'chevron_left' },
                            { label: '1', active: true },
                            { label: '2' },
                            { label: null, icon: 'chevron_right' },
                        ].map((btn, i) => (
                            <button key={i} style={{
                                width: '36px', height: '36px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: '8px', border: `1px solid ${btn.active ? 'transparent' : C.border}`,
                                background: btn.active ? C.primary : 'transparent',
                                color: btn.active ? '#fff' : C.textSub,
                                cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                            }}>
                                {btn.icon
                                    ? <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{btn.icon}</span>
                                    : btn.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Ghost stat cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', opacity: 0.25 }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{
                        height: '120px', borderRadius: '12px',
                        border: `1px solid ${C.border}`,
                        background: 'rgba(255,255,255,0.01)',
                        padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}>
                        <div style={{ height: '14px', width: '90px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                        <div style={{ height: '28px', width: '44px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ── Row with hover state ── */
const ServiceRow = ({ app, appName, location, current, total, pct, barColor }) => {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(false);

    return (
        <tr
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                borderBottom: `1px solid ${C.border}`,
                background: hovered ? 'rgba(255,255,255,0.012)' : 'transparent',
                transition: 'background 0.15s',
            }}
        >
            {/* Service Name */}
            <td style={{ padding: '22px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '10px',
                        border: `1px solid ${C.border}`, background: C.bg,
                        padding: '3px', flexShrink: 0, overflow: 'hidden',
                    }}>
                        <div style={{
                            width: '100%', height: '100%', borderRadius: '7px',
                            background: 'linear-gradient(135deg, #0070f3 0%, rgba(0,112,243,0.35) 100%)',
                        }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: C.textWhite, marginBottom: '3px' }}>
                            {appName}
                        </div>
                        <div style={{
                            fontSize: '10px', color: C.textMuted,
                            fontFamily: "'Space Grotesk', sans-serif",
                            letterSpacing: '0.12em', textTransform: 'uppercase',
                        }}>{location}</div>
                    </div>
                </div>
            </td>

            {/* Replicas */}
            <td style={{ padding: '22px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        fontSize: '13px', color: C.textSub,
                        fontFamily: "'Space Grotesk', sans-serif",
                    }}>{current} / {total}</span>
                    <div style={{
                        width: '88px', height: '4px',
                        background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%', borderRadius: '99px',
                            background: barColor, width: `${pct}%`,
                            transition: 'width 0.7s ease',
                        }} />
                    </div>
                </div>
            </td>

            {/* Resources */}
            <td style={{ padding: '22px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#d4d4d8', marginBottom: '2px' }}>
                    {app.cpuRequest || '—'} vCPU
                </div>
                <div style={{
                    fontSize: '10px', color: C.textMuted,
                    fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.08em',
                }}>
                    {app.memoryRequest || '—'} MEM
                </div>
            </td>

            {/* Status */}
            <td style={{ padding: '22px 28px' }}>
                <StatusBadge status={app.status} />
            </td>

            {/* Actions */}
            <td style={{ padding: '22px 28px', textAlign: 'right' }}>
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', gap: '8px',
                    opacity: hovered ? 1 : 0, transition: 'opacity 0.2s',
                }}>
                    {[
                        { icon: 'terminal', label: 'Logs', hoverColor: C.primary, hoverBg: C.primaryBg, action: () => navigate(`/apps/${app.id}`) },
                        { icon: 'edit',     label: 'Edit', hoverColor: C.textWhite, hoverBg: 'rgba(255,255,255,0.08)', action: () => navigate(`/apps/${app.id}`) },
                        { icon: 'stop_circle', label: 'Stop', hoverColor: C.red, hoverBg: C.redBg, action: () => {} },
                    ].map(btn => (
                        <ActionBtn key={btn.icon} {...btn} />
                    ))}
                </div>
            </td>
        </tr>
    );
};

const ActionBtn = ({ icon, label, hoverColor, hoverBg, action }) => {
    const [hov, setHov] = useState(false);
    return (
        <button
            onClick={action}
            title={label}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '36px', height: '36px', borderRadius: '8px', border: 'none',
                background: hov ? hoverBg : 'rgba(255,255,255,0.05)',
                color: hov ? hoverColor : C.textMuted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
            }}
        >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
        </button>
    );
};

export default AppsList;
