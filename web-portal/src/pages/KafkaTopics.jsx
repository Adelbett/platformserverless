import { useEffect, useMemo, useRef, useState } from 'react';
import { kafkaApi } from '../api';

/* ── Design tokens ── */
const C = {
    bg:          '#0a0a0a',
    card:        '#1c1b1b',
    cardMid:     '#201f1f',
    cardLow:     '#0e0e0e',
    border:      'rgba(255,255,255,0.05)',
    borderHov:   'rgba(0,112,243,0.30)',
    primary:     '#0070f3',
    primaryBg:   'rgba(0,112,243,0.10)',
    primaryBd:   'rgba(0,112,243,0.22)',
    amber:       '#e9c349',
    amberBg:     'rgba(233,195,73,0.10)',
    textWhite:   '#ffffff',
    textSub:     '#a1a1aa',
    textMuted:   '#52525b',
    red:         '#ef4444',
    redBg:       'rgba(239,68,68,0.10)',
    redBd:       'rgba(239,68,68,0.25)',
};

/* ── Stable sparkline heights based on topic name hash ── */
const sparkHeights = (seed) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
    return Array.from({ length: 12 }, (_, i) => 20 + ((h * (i + 7) * 2654435761) & 0xffff) % 80);
};

/* ── Reusable label style ── */
const labelStyle = {
    fontSize: '10px', fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textMuted,
    display: 'block', marginBottom: '8px',
};

/* ── Metric card ── */
const MetricCard = ({ label, value, valueColor, sub, barPct, bars, footnote }) => (
    <div style={{
        background: C.card, padding: '24px', borderRadius: '12px',
        border: `1px solid ${C.border}`,
    }}>
        <p style={labelStyle}>{label}</p>
        <p style={{ fontSize: '30px', fontWeight: 700, color: valueColor || C.textWhite, lineHeight: 1.1 }}>
            {value}
        </p>
        {sub && (
            <p style={{ fontSize: '11px', color: C.amber, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
                {sub}
            </p>
        )}
        {barPct !== undefined && (
            <div style={{ height: '4px', background: C.cardMid, borderRadius: '99px', overflow: 'hidden', marginTop: '16px' }}>
                <div style={{ height: '100%', background: C.primary, width: `${barPct}%`, borderRadius: '99px' }} />
            </div>
        )}
        {bars && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '4px', alignItems: 'flex-end', height: '32px' }}>
                {bars.map((h, i) => (
                    <div key={i} style={{
                        flex: 1, borderRadius: '2px 2px 0 0',
                        background: `rgba(0,112,243,${0.3 + i * 0.15})`,
                        height: `${h}px`,
                    }} />
                ))}
            </div>
        )}
        {footnote && (
            <p style={{ fontSize: '11px', color: C.textMuted, marginTop: '8px' }}>{footnote}</p>
        )}
    </div>
);

/* ── Topic card ── */
const TopicCard = ({ topic, onDelete }) => {
    const [hov, setHov] = useState(false);
    const heights = useMemo(() => sparkHeights(topic.name || 'default'), [topic.name]);
    const retentionLabel = topic.retention
        ? topic.retention
        : topic.config?.['retention.ms'] === '-1'
            ? 'Infinite'
            : topic.config?.['retention.ms']
                ? `${Math.round(Number(topic.config['retention.ms']) / 3600000)}h`
                : '168h';

    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: C.cardMid, padding: '20px', borderRadius: '12px',
                border: `1px solid ${hov ? C.borderHov : C.border}`,
                transition: 'border-color 0.3s',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                {/* Left: icon + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '8px',
                        background: C.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: C.primary,
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>dataset</span>
                    </div>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: C.textWhite }}>{topic.name}</p>
                        <p style={{ ...labelStyle, marginBottom: 0, marginTop: '2px' }}>
                            {topic.createdAt ? `Created ${topic.createdAt}` : 'Recently created'}
                        </p>
                    </div>
                </div>

                {/* Right: stats + menu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '11px', color: C.textSub }}>Partitions</p>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: C.textWhite }}>{topic.partitions || 0}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '11px', color: C.textSub }}>Retention</p>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: C.textWhite }}>{retentionLabel}</p>
                    </div>
                    <button
                        onClick={() => onDelete(topic)}
                        title="Delete topic"
                        style={{
                            padding: '8px', background: 'transparent', border: 'none',
                            color: C.textMuted, cursor: 'pointer', borderRadius: '6px',
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = C.red}
                        onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                    </button>
                </div>
            </div>

            {/* Sparkline */}
            <div style={{
                display: 'flex', alignItems: 'flex-end', gap: '3px',
                height: '32px', padding: '0 8px',
                opacity: hov ? 1 : 0.5, transition: 'opacity 0.3s',
            }}>
                {heights.map((h, i) => (
                    <div key={i} style={{
                        flex: 1, borderRadius: '2px 2px 0 0',
                        background: `rgba(0,112,243,${0.15 + (i / heights.length) * 0.85})`,
                        height: `${h}%`,
                    }} />
                ))}
            </div>
        </div>
    );
};

/* ── Live flow chart bars ── */
const FLOW_BARS = [50, 67, 33, 75, 50, 80, 25, 67, 83, 100, 75, 67, 50, 75, 67];

/* ── Module-scope constants (never change) ── */
const CLI_SNIPPETS = [
    { comment: '# Create new topic', code: 'kafka-topics --create --bootstrap-server localhost:9092 \\\n  --replication-factor 3 --partitions 3 --topic <name>', color: C.primary },
    { comment: '# List all groups',  code: 'kafka-consumer-groups --bootstrap-server localhost:9092 --list', color: C.amber },
];
const ALL_SNIPPETS_TEXT = CLI_SNIPPETS.map(s => `${s.comment}\n${s.code}`).join('\n\n');
const inputCls = {
    width: '100%', background: C.card, border: '1px solid transparent',
    borderRadius: '8px', color: C.textWhite, padding: '12px', fontSize: '13px',
    outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'border-color 0.15s',
};

/* ── Main component ── */
const KafkaTopics = () => {
    const [topics, setTopics]     = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState('');
    const [creating, setCreating] = useState(false);
    const [searchTerm, setSearch] = useState('');
    const [copied, setCopied]     = useState(false);
    const [clock, setClock]       = useState(() => new Date().toISOString().substring(11, 19));
    const [form, setForm]         = useState({
        name: '', partitions: 12, replicationFactor: 3, retentionMs: '604800000',
    });
    const copyTimerRef = useRef(null);

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    useEffect(() => {
        const id = setInterval(() => setClock(new Date().toISOString().substring(11, 19)), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => () => clearTimeout(copyTimerRef.current), []);

    const loadTopics = async () => {
        try {
            setLoading(true); setError('');
            const res = await kafkaApi.list();
            setTopics(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to load Kafka topics.');
            setTopics([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTopics(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name) return;
        setCreating(true); setError('');
        try {
            await kafkaApi.create({
                name: form.name,
                partitions: Number(form.partitions),
                replicas: Number(form.replicationFactor),
                config: `retention.ms=${form.retentionMs}`,
            });
            setForm({ name: '', partitions: 12, replicationFactor: 3, retentionMs: '604800000' });
            await loadTopics();
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to create topic.');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (topic) => {
        if (!window.confirm(`Delete topic "${topic.name}"? This is irreversible.`)) return;
        try {
            await kafkaApi.delete(topic.id || topic.name);
            await loadTopics();
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to delete topic.');
        }
    };

    const totalPartitions = topics.reduce((s, t) => s + (t.partitions || 0), 0);
    const filtered = useMemo(() => {
        const lc = searchTerm.toLowerCase();
        return topics.filter(t => t.name.toLowerCase().includes(lc));
    }, [topics, searchTerm]);

    const handleCopy = () => {
        navigator.clipboard?.writeText(ALL_SNIPPETS_TEXT);
        setCopied(true);
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

            {/* ── Header ── */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
                    <div>
                        <span style={{
                            fontSize: '11px', fontFamily: "'Space Grotesk', sans-serif",
                            letterSpacing: '0.18em', textTransform: 'uppercase', color: C.primary,
                        }}>System Status: Optimal</span>
                        <h2 style={{ fontSize: '36px', fontWeight: 700, color: C.textWhite, marginTop: '6px', letterSpacing: '-0.02em' }}>
                            Kafka Pipelines
                        </h2>
                    </div>
                    <button
                        onClick={() => document.getElementById('topic-name-input')?.focus()}
                        style={{
                            background: C.primary, color: '#fff', padding: '10px 22px',
                            borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                            fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                            boxShadow: '0 0 15px rgba(0,112,243,0.3)', transition: 'filter 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
                        onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                        Create Topic
                    </button>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                    <MetricCard label="Active Clusters" value="04" barPct={75} />
                    <MetricCard
                        label="Total Partitions"
                        value={loading ? '...' : totalPartitions.toLocaleString()}
                        bars={[4, 6, 5, 8, 4]}
                    />
                    <MetricCard
                        label="Messages / Sec"
                        value="84.2k"
                        valueColor={C.amber}
                        sub="+12% from peak"
                    />
                    <MetricCard label="Storage Usage" value="12.8 TB" footnote="Capacity: 45.0 TB" />
                </div>
            </div>

            {/* ── Main content: topics list + side panel ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '28px', alignItems: 'start' }}>

                {/* Topics List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Sub-header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, color: C.textWhite }}>Managed Topics</h3>
                        <div style={{ position: 'relative' }}>
                            <span className="material-symbols-outlined" style={{
                                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                                fontSize: '16px', color: C.textMuted, pointerEvents: 'none',
                            }}>search</span>
                            <input
                                type="text"
                                placeholder="Filter topics..."
                                value={searchTerm}
                                onChange={e => setSearch(e.target.value)}
                                style={{
                                    background: C.cardLow, border: `1px solid ${C.border}`,
                                    borderRadius: '8px', color: C.textWhite, outline: 'none',
                                    padding: '7px 14px 7px 32px', fontSize: '12px',
                                    fontFamily: "'Inter', sans-serif", width: '180px',
                                }}
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            padding: '12px 16px', background: C.redBg, border: `1px solid ${C.redBd}`,
                            borderRadius: '8px', color: C.red, fontSize: '13px',
                        }}>{error}</div>
                    )}

                    {/* Topics */}
                    {loading ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>
                            <span style={{ fontSize: '11px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                Loading topics...
                            </span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: C.textMuted }}>
                            <span style={{ fontSize: '11px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                No Kafka topics found
                            </span>
                        </div>
                    ) : (
                        filtered.map(topic => (
                            <TopicCard key={topic.id || topic.name} topic={topic} onDelete={handleDelete} />
                        ))
                    )}
                </div>

                {/* Side Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* CLI Terminal */}
                    <div style={{
                        background: C.cardLow, borderRadius: '12px',
                        border: `1px solid ${C.border}`, overflow: 'hidden',
                        boxShadow: '0 0 15px rgba(0,112,243,0.12)',
                    }}>
                        {/* Terminal bar */}
                        <div style={{
                            background: C.cardMid, padding: '10px 16px',
                            borderBottom: `1px solid ${C.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
                                    <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: `${c}80` }} />
                                ))}
                            </div>
                            <span style={{ ...labelStyle, marginBottom: 0 }}>Quick CLI Commands</span>
                        </div>

                        {/* Commands */}
                        <div style={{ padding: '20px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {CLI_SNIPPETS.map((s, i) => (
                                <div key={i}>
                                    <p style={{ color: C.textMuted, marginBottom: '6px' }}>{s.comment}</p>
                                    <code style={{ color: s.color, lineHeight: 1.6, display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                        {s.code}
                                    </code>
                                </div>
                            ))}
                            <button
                                onClick={handleCopy}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.05)', border: 'none',
                                    color: copied ? C.primary : C.textSub, cursor: 'pointer',
                                    fontFamily: "'Space Grotesk', sans-serif",
                                    fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                                    transition: 'all 0.15s', marginTop: '4px',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                {copied ? '✓ Copied!' : 'Copy All Snippets'}
                            </button>
                        </div>
                    </div>

                    {/* Create Topic Form */}
                    <div style={{
                        background: 'rgba(53,53,52,0.20)', backdropFilter: 'blur(24px)',
                        borderRadius: '12px', border: `1px solid rgba(255,255,255,0.10)`, padding: '24px',
                    }}>
                        <h3 style={{
                            fontWeight: 700, color: C.textWhite, marginBottom: '22px',
                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px',
                        }}>
                            <span className="material-symbols-outlined" style={{ color: C.primary, fontSize: '20px' }}>add_circle</span>
                            Instant Deployment
                        </h3>

                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            <div>
                                <label style={labelStyle}>Topic Identity</label>
                                <input
                                    id="topic-name-input"
                                    type="text"
                                    placeholder="e.g. user-events-v1"
                                    value={form.name}
                                    onChange={e => set('name', e.target.value)}
                                    style={inputCls}
                                    onFocus={e => e.target.style.borderColor = C.primary}
                                    onBlur={e => e.target.style.borderColor = 'transparent'}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Partitions</label>
                                    <input
                                        type="number" min={1} value={form.partitions}
                                        onChange={e => set('partitions', e.target.value)}
                                        style={inputCls}
                                        onFocus={e => e.target.style.borderColor = C.primary}
                                        onBlur={e => e.target.style.borderColor = 'transparent'}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Replication</label>
                                    <input
                                        type="number" min={1} value={form.replicationFactor}
                                        onChange={e => set('replicationFactor', e.target.value)}
                                        style={inputCls}
                                        onFocus={e => e.target.style.borderColor = C.primary}
                                        onBlur={e => e.target.style.borderColor = 'transparent'}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Retention Policy</label>
                                <select
                                    value={form.retentionMs}
                                    onChange={e => set('retentionMs', e.target.value)}
                                    style={{ ...inputCls, cursor: 'pointer' }}
                                    onFocus={e => e.target.style.borderColor = C.primary}
                                    onBlur={e => e.target.style.borderColor = 'transparent'}
                                >
                                    <option value="86400000">24 Hours (Volatile)</option>
                                    <option value="604800000">7 Days (Standard)</option>
                                    <option value="-1">Infinite (Permanent)</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={creating || !form.name}
                                style={{
                                    width: '100%', background: creating ? '#ccc' : C.textWhite,
                                    color: '#000', fontWeight: 700, fontSize: '13px',
                                    padding: '12px', borderRadius: '8px', border: 'none',
                                    cursor: creating || !form.name ? 'not-allowed' : 'pointer',
                                    opacity: !form.name ? 0.5 : 1, transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { if (!creating && form.name) e.currentTarget.style.background = '#e4e4e7'; }}
                                onMouseLeave={e => e.currentTarget.style.background = creating ? '#ccc' : C.textWhite}
                            >
                                {creating ? 'Provisioning...' : 'Provision Resources'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* ── Live Message Flow ── */}
            <div style={{
                background: C.card, borderRadius: '16px',
                border: `1px solid ${C.border}`, padding: '32px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
                    <div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, color: C.textWhite }}>Live Message Flow</h3>
                        <p style={{ fontSize: '13px', color: C.textSub, marginTop: '4px' }}>
                            Aggregated cluster ingestion rates (Real-time)
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        {[
                            { color: C.primary, label: 'Produced' },
                            { color: C.amber,   label: 'Consumed' },
                        ].map(l => (
                            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }} />
                                <span style={{ ...labelStyle, marginBottom: 0, color: C.textSub }}>{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bar chart */}
                <div style={{ height: '192px', display: 'flex', alignItems: 'flex-end', gap: '10px', position: 'relative' }}>
                    {FLOW_BARS.map((pct, i) => {
                        const opacity = 0.10 + (i / FLOW_BARS.length) * 0.90;
                        const isLast = i === FLOW_BARS.length - 1;
                        return (
                            <div
                                key={i}
                                style={{
                                    flex: 1, borderRadius: '4px 4px 0 0',
                                    background: `rgba(0,112,243,${opacity})`,
                                    height: `${pct}%`,
                                    transition: 'background 0.2s',
                                    boxShadow: isLast ? '0 0 20px rgba(0,112,243,0.35)' : 'none',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = `rgba(0,112,243,${Math.min(1, opacity + 0.2)})`}
                                onMouseLeave={e => e.currentTarget.style.background = `rgba(0,112,243,${opacity})`}
                            />
                        );
                    })}

                    {/* Dashed consumed line */}
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                        pointerEvents: 'none',
                    }}>
                        <div style={{
                            width: '100%', borderBottom: `2px dashed rgba(233,195,73,0.35)`,
                        }} />
                    </div>
                </div>

                {/* X-axis */}
                <div style={{
                    marginTop: '20px', paddingTop: '14px',
                    borderTop: `1px solid ${C.border}`,
                    display: 'flex', justifyContent: 'space-between',
                }}>
                    <span style={{ ...labelStyle, marginBottom: 0, fontSize: '9px' }}>T-minus 60s</span>
                    <span style={{ ...labelStyle, marginBottom: 0, fontSize: '9px' }}>
                        Current Time: {clock} UTC
                    </span>
                </div>
            </div>
        </div>
    );
};

export default KafkaTopics;
