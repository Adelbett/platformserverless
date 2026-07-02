import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { eventApi, eventingApi, kafkaApi, appsApi, logsApi } from '../api';
import { useTheme } from '../context/ThemeContext';
import {
    Zap, Database, GitBranch, Box, RefreshCw, ChevronRight,
    Play, Trash2, Send, Clock, CheckCircle, XCircle, AlertTriangle,
    FileText, Radio, Copy, Check,
} from 'lucide-react';

// ── Status pill ────────────────────────────────────────────────────────────────
const StatusPill = ({ ready, active }) => {
    const ok = ready || active;
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            color: ok ? '#10B981' : '#F59E0B',
        }}>● {ok ? 'READY' : 'PENDING'}</span>
    );
};

// ── Arrow ──────────────────────────────────────────────────────────────────────
const Arrow = () => (
    <div style={{ display: 'flex', alignItems: 'center', color: '#3A4A5A', flexShrink: 0 }}>
        <div style={{ width: 20, height: 1, background: '#3A4A5A' }} />
        <ChevronRight size={11} />
    </div>
);

// ── Pipeline Node with stats ───────────────────────────────────────────────────
const PipelineNode = ({ icon: Icon, label, sublabel, color, statusEl, stat1, stat2 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 110 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Icon size={20} color={color} />
            {statusEl && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: typeof statusEl === 'string' ? statusEl : '#F59E0B', border: '2px solid #0D1117' }} />
            )}
        </div>
        <div style={{ textAlign: 'center', width: '100%' }}>
            <p style={{ fontSize: 11, fontWeight: 700, margin: 0, color: '#DDE6F0', fontFamily: "'JetBrains Mono', monospace", maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
            {sublabel && <p style={{ fontSize: 9, margin: '1px 0 0', color: '#5A7080' }}>{sublabel}</p>}
        </div>
        {/* Stats row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', minHeight: 32 }}>
            {stat1 && <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: color, background: `${color}12`, padding: '1px 6px', borderRadius: 999, whiteSpace: 'nowrap' }}>{stat1}</span>}
            {stat2 && <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: '#5A7080', whiteSpace: 'nowrap' }}>{stat2}</span>}
        </div>
    </div>
);

// ── Pipeline card ──────────────────────────────────────────────────────────────
const Pipeline = ({ source, triggers, topics, apps }) => {
    const topic = topics.find(t => t.id === source.kafkaTopicId || t.name === source.kafkaTopicId);
    const lag   = topic?.consumerLag;
    const msgs  = topic?.messageCount;

    return (
        <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", marginBottom: 20 }}>
                Pipeline — <span style={{ color: '#DDE6F0' }}>{source.name}</span>
                <span style={{ marginLeft: 12, color: source.ready ? '#10B981' : '#F59E0B' }}>● {source.ready ? 'READY' : 'PENDING'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 4 }}>
                {/* Topic */}
                <PipelineNode
                    icon={Database}
                    label={topic?.name || source.kafkaTopicId?.slice(0, 16) || 'topic'}
                    sublabel={`${topic?.partitions ?? '?'}p · ${topic?.replicas ?? '?'}r`}
                    color="#F59E0B"
                    statusEl="#10B981"
                    stat1={msgs != null ? `${msgs.toLocaleString()} msgs` : 'no data'}
                    stat2={lag != null ? `lag=${lag}` : ''}
                />
                <Arrow />
                {/* KafkaSource */}
                <PipelineNode
                    icon={Zap}
                    label="KafkaSource"
                    sublabel={source.namespace}
                    color="#8B5CF6"
                    statusEl={source.ready ? '#10B981' : '#F59E0B'}
                    stat1={source.ready ? '✅ READY' : '⏳ PENDING'}
                    stat2={source.consumerGroup ? source.consumerGroup.slice(0, 16) : ''}
                />
                <Arrow />
                {/* Broker */}
                <PipelineNode
                    icon={Box}
                    label="Broker"
                    sublabel="default"
                    color="#00D4FF"
                    statusEl="#10B981"
                    stat1={`${triggers.length} trigger${triggers.length !== 1 ? 's' : ''}`}
                    stat2="✅ READY"
                />
                {/* Triggers → Services */}
                {triggers.map(trigger => {
                    const app = apps.find(a =>
                        a.url === trigger.action ||
                        trigger.action?.includes(a.serviceName) ||
                        trigger.subscriberName?.includes(a.serviceName)
                    );
                    const appStatus = app?.status || 'UNKNOWN';
                    const dotColor = appStatus === 'RUNNING' ? '#10B981' : appStatus === 'FAILED' ? '#EF4444' : '#F59E0B';
                    return (
                        <div key={trigger.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                            <Arrow />
                            <PipelineNode
                                icon={GitBranch}
                                label={trigger.filter || 'trigger'}
                                sublabel="filter"
                                color="#10B981"
                                statusEl={trigger.active ? '#10B981' : '#EF4444'}
                                stat1={trigger.filter || '—'}
                                stat2={trigger.active ? '✅ active' : '❌ inactive'}
                            />
                            <Arrow />
                            <PipelineNode
                                icon={Box}
                                label={app?.name || trigger.subscriberName?.split('-').slice(0, 3).join('-') || 'service'}
                                sublabel={appStatus}
                                color="#0066FF"
                                statusEl={dotColor}
                                stat1={`${appStatus === 'RUNNING' ? '🟢' : '🔴'} ${appStatus}`}
                                stat2={app?.replicas != null ? `${app.replicas} pod${app.replicas !== 1 ? 's' : ''}` : ''}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Event templates ────────────────────────────────────────────────────────────
const TEMPLATES = [
    {
        label: 'order.created',
        type: 'order.created',
        data: '{\n  "orderId": "order-001",\n  "userId": "user-123",\n  "amount": 49.99,\n  "currency": "EUR"\n}',
    },
    {
        label: 'payment.done',
        type: 'payment.done',
        data: '{\n  "paymentId": "pay-001",\n  "orderId": "order-001",\n  "status": "SUCCESS",\n  "amount": 49.99\n}',
    },
    {
        label: 'user.signup',
        type: 'user.signup',
        data: '{\n  "userId": "user-123",\n  "email": "user@example.com",\n  "plan": "free"\n}',
    },
    {
        label: 'cloudevent.created',
        type: 'cloudevent.created',
        data: '{\n  "source": "platform",\n  "message": "Hello from NEXTSTEP"\n}',
    },
    {
        label: 'web.created',
        type: 'web.created',
        data: '{\n  "page": "/home",\n  "userId": "anon-001",\n  "referrer": "google"\n}',
    },
];

// ── Publish Event form ─────────────────────────────────────────────────────────
const PublishForm = ({ topics, triggers }) => {
    const [form, setForm]     = useState({ type: 'order.created', topicId: '', data: TEMPLATES[0].data });
    const [publishing, setPublishing] = useState(false);
    const [result, setResult] = useState(null); // {ok, message, duration}
    const [history, setHistory] = useState(() => {
        try { return JSON.parse(localStorage.getItem('event_publish_history') || '[]'); } catch { return []; }
    });
    const [copied, setCopied] = useState(false);
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const applyTemplate = (tpl) => setForm(p => ({ ...p, type: tpl.type, data: tpl.data }));

    const handlePublish = async (e) => {
        e.preventDefault();
        setResult(null); setPublishing(true);
        const t0 = Date.now();
        try {
            const topicName = topics.find(t => t.id === form.topicId)?.name;
            const payload = { type: form.type, topic: topicName || undefined, data: JSON.parse(form.data) };
            await eventApi.publish(payload);
            const duration = ((Date.now() - t0) / 1000).toFixed(2);

            // Find which app might be triggered
            const trigger = triggers.find(t => t.filter === form.type || t.filter?.includes(form.type));
            const appHint = trigger ? (trigger.subscriberName?.split('-').slice(0, 3).join('-') || 'service') : null;

            const entry = {
                id: crypto.randomUUID(),
                time: new Date().toLocaleTimeString([], { hour12: false }),
                timestamp: new Date().toISOString(),
                type: form.type,
                topic: topics.find(t => t.id === form.topicId)?.name || '—',
                appHint,
                duration,
                ok: true,
            };
            const newHistory = [entry, ...history].slice(0, 10);
            setHistory(newHistory);
            localStorage.setItem('event_publish_history', JSON.stringify(newHistory));
            localStorage.setItem('event_log', JSON.stringify(
                [entry, ...(JSON.parse(localStorage.getItem('event_log') || '[]'))].slice(0, 50)
            ));
            setResult({ ok: true, message: `✅ Event published in ${duration}s${appHint ? ` → triggered ${appHint}` : ''}`, duration });
        } catch (err) {
            const duration = ((Date.now() - t0) / 1000).toFixed(2);
            setResult({ ok: false, message: `✗ Failed: ${err?.response?.data?.message || err.message}`, duration });
        } finally {
            setPublishing(false);
        }
    };

    const copyPayload = () => {
        navigator.clipboard.writeText(form.data);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
            {/* Form */}
            <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #1F2B3A', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send size={15} color="#9B6FD8" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#DDE6F0' }}>Publish CloudEvent</span>
                </div>
                <form onSubmit={handlePublish} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Templates */}
                    <div>
                        <div style={{ fontSize: 10, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Quick Templates</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {TEMPLATES.map(tpl => (
                                <button key={tpl.label} type="button" onClick={() => applyTemplate(tpl)}
                                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${form.type === tpl.type ? '#8B5CF6' : '#1F2B3A'}`, background: form.type === tpl.type ? 'rgba(139,92,246,0.12)' : 'transparent', color: form.type === tpl.type ? '#8B5CF6' : '#5A7080', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace', transition: 'all 150ms'" }}>
                                    {tpl.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Event type + Topic */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 10, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Event Type *</div>
                            <input value={form.type} onChange={e => set('type', e.target.value)}
                                style={{ width: '100%', background: '#161B22', border: '1px solid #1F2B3A', color: '#DDE6F0', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 10, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Target Topic</div>
                            <select value={form.topicId} onChange={e => set('topicId', e.target.value)}
                                style={{ width: '100%', background: '#161B22', border: '1px solid #1F2B3A', color: form.topicId ? '#DDE6F0' : '#5A7080', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' }}>
                                <option value="">Auto (broker default)</option>
                                {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Payload */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <div style={{ fontSize: 10, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payload JSON</div>
                            <button type="button" onClick={copyPayload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#10B981' : '#5A7080', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                            </button>
                        </div>
                        <textarea value={form.data} onChange={e => set('data', e.target.value)} rows={7}
                            style={{ width: '100%', background: '#161B22', border: '1px solid #1F2B3A', color: '#DDE6F0', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>

                    {/* Response banner */}
                    <AnimatePresence>
                        {result && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                style={{ padding: '12px 14px', borderRadius: 8, background: result.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${result.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: 12, color: result.ok ? '#10B981' : '#EF4444', fontFamily: "'JetBrains Mono', monospace" }}>
                                {result.message}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div>
                        <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }} disabled={publishing}>
                            {publishing ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</> : <><Send size={13} /> Publish Event</>}
                        </button>
                    </div>
                </form>
            </div>

            {/* Recent history */}
            <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #1F2B3A' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#DDE6F0' }}>Recent publishes</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {history.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#5A7080', fontSize: 12 }}>
                            <Send size={24} style={{ margin: '0 auto 10px', display: 'block', color: '#2A3A4A' }} />
                            No events published yet
                        </div>
                    ) : history.map((h, i) => (
                        <div key={h.id || i} style={{ padding: '10px 16px', borderBottom: '1px solid #1A2330', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ marginTop: 2, flexShrink: 0 }}>
                                {h.ok ? <CheckCircle size={13} style={{ color: '#10B981' }} /> : <XCircle size={13} style={{ color: '#EF4444' }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, margin: 0, fontFamily: "'JetBrains Mono', monospace", color: '#A855F7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.type}</p>
                                {h.appHint && <p style={{ fontSize: 10, margin: '2px 0 0', color: '#00D4FF' }}>→ {h.appHint}</p>}
                                <p style={{ fontSize: 10, margin: '2px 0 0', color: '#5A7080' }}>{h.time} · {h.duration}s</p>
                            </div>
                        </div>
                    ))}
                </div>
                {history.length > 0 && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid #1A2330' }}>
                        <button onClick={() => { setHistory([]); localStorage.removeItem('event_publish_history'); }}
                            style={{ fontSize: 11, color: '#5A7080', background: 'none', border: 'none', cursor: 'pointer' }}>
                            Clear history
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Event Log ──────────────────────────────────────────────────────────────────
const EventLog = ({ triggers, apps }) => {
    const [log, setLog]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const load = async () => {
        try {
            const { data } = await logsApi.getMine();
            const events = (Array.isArray(data) ? data : [])
                .filter(e => e.type === 'EVENT_PUBLISHED' || e.type === 'EVENT_FAILED');
            setLog(events);
        } catch { setLog([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const filtered = log.filter(e =>
        !filter || e.message?.toLowerCase().includes(filter.toLowerCase()) ||
        e.type?.toLowerCase().includes(filter.toLowerCase())
    );

    const fmtTime = (iso) => {
        if (!iso) return '—';
        try { return new Date(iso).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
        catch { return '—'; }
    };

    return (
        <div className="ns-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                    <span style={{ fontSize: 13, fontWeight: 700 }} className="text-primary">Event Log</span>
                    <span style={{ fontSize: 11, marginLeft: 8, color: '#64748B' }}>{filtered.length} events</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="Filter events…" value={filter} onChange={e => setFilter(e.target.value)}
                        className="ns-input" style={{ height: 30, fontSize: 12, width: 180 }} />
                    {log.length > 0 && (
                        <button onClick={() => { setLog([]); localStorage.removeItem('event_log'); }}
                            style={{ fontSize: 11, color: '#EF4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                            Clear
                        </button>
                    )}
                </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        {['TIMESTAMP', 'MESSAGE', 'STATUS'].map(h => (
                            <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan={3} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>Loading…</td></tr>
                    ) : filtered.length === 0 ? (
                        <tr><td colSpan={3} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                            <FileText size={24} style={{ margin: '0 auto 10px', display: 'block', color: '#374151' }} />
                            No events logged yet — publish an event from the Publish tab
                        </td></tr>
                    ) : filtered.map((ev, i) => (
                        <tr key={ev.id || i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                            <td style={{ padding: '11px 16px', fontFamily: "'JetBrains Mono', monospace", color: '#64748B', whiteSpace: 'nowrap' }}>
                                {fmtTime(ev.createdAt)}
                            </td>
                            <td style={{ padding: '11px 16px', color: '#DDE6F0', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ev.message}
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                                {ev.type === 'EVENT_PUBLISHED'
                                    ? <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 999 }}>✅ OK</span>
                                    : <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 999 }}>✗ FAILED</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── Triggers table with actions ────────────────────────────────────────────────
const TriggersTable = ({ triggers, setTriggers, topics, sources, load }) => {
    const [testing, setTesting] = useState(null);
    const [testResult, setTestResult] = useState({});
    const [deleting, setDeleting] = useState(null);
    const { dark } = useTheme();
    const border = dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)';

    const handleDelete = async (t) => {
        if (!window.confirm(`Delete trigger "${t.name || t.filter}"?`)) return;
        setDeleting(t.id);
        try {
            await eventingApi.deleteTrigger(t.id);
            await load();
        } catch (e) {
            alert('Delete failed: ' + (e?.response?.data?.message || e.message));
        } finally { setDeleting(null); }
    };

    const handleTest = async (t) => {
        setTesting(t.id);
        setTestResult(p => ({ ...p, [t.id]: null }));
        const t0 = Date.now();
        try {
            await eventApi.publish({ type: t.filter || 'test.event', data: { test: true, triggerId: t.id } });
            const duration = ((Date.now() - t0) / 1000).toFixed(2);
            setTestResult(p => ({ ...p, [t.id]: { ok: true, msg: `✅ Test sent in ${duration}s`, duration } }));
        } catch (e) {
            setTestResult(p => ({ ...p, [t.id]: { ok: false, msg: '✗ ' + (e?.response?.data?.message || 'Failed') } }));
        } finally { setTesting(null); }
    };

    return (
        <div className="ns-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: border }}>
                <span style={{ fontSize: 13, fontWeight: 700 }} className="text-primary">Triggers ({triggers.length})</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: border }}>
                        {['NAME', 'BROKER', 'FILTER', 'SUBSCRIBER', 'STATUS', 'ACTIONS'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {triggers.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>No triggers configured</td></tr>
                    ) : triggers.map(t => (
                        <>
                            <tr key={t.id} style={{ borderBottom: border }}>
                                <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">
                                    {t.name || '—'}
                                </td>
                                <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#00D4FF' }}>
                                    {t.brokerName || 'default'}
                                </td>
                                <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#A855F7' }}>
                                    {t.filter || '—'}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 12, color: '#10B981', fontFamily: "'JetBrains Mono', monospace", maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t.subscriberName || t.action || '—'}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <StatusPill ready={t.ready} active={t.active} />
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {/* Test */}
                                        <button
                                            onClick={() => handleTest(t)}
                                            disabled={testing === t.id}
                                            title="Send a test event with this trigger's filter"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.07)', color: '#10B981', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            {testing === t.id
                                                ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                                                : <Play size={11} />}
                                            Test
                                        </button>
                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDelete(t)}
                                            disabled={deleting === t.id}
                                            title="Delete this trigger"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.07)', color: '#EF4444', cursor: 'pointer' }}
                                        >
                                            {deleting === t.id
                                                ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                                                : <Trash2 size={11} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {/* Test result inline */}
                            {testResult[t.id] && (
                                <tr key={`${t.id}-result`} style={{ borderBottom: border }}>
                                    <td colSpan={6} style={{ padding: '6px 16px 10px' }}>
                                        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: testResult[t.id].ok ? '#10B981' : '#EF4444', background: testResult[t.id].ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', padding: '4px 12px', borderRadius: 6 }}>
                                            {testResult[t.id].msg}
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── KafkaSources table ─────────────────────────────────────────────────────────
const SourcesTable = ({ sources, topics }) => {
    const { dark } = useTheme();
    const border = dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)';
    return (
        <div className="ns-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: border }}>
                <span style={{ fontSize: 13, fontWeight: 700 }} className="text-primary">KafkaSources ({sources.length})</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: border }}>
                        {['NAME', 'TOPIC', 'CONSUMER GROUP', 'NAMESPACE', 'STATUS'].map(h => (
                            <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sources.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No KafkaSources — deploy an app with Kafka Trigger enabled</td></tr>
                    ) : sources.map(s => {
                        const topic = topics.find(t => t.id === s.kafkaTopicId || t.name === s.kafkaTopicId);
                        return (
                            <tr key={s.id} style={{ borderBottom: border }}>
                                <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{s.name}</td>
                                <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#F59E0B' }}>{topic?.name || s.kafkaTopicId}</td>
                                <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} className="text-secondary">{s.consumerGroup || '—'}</td>
                                <td style={{ padding: '12px 20px', fontSize: 12 }} className="text-secondary">{s.namespace || '—'}</td>
                                <td style={{ padding: '12px 20px' }}><StatusPill ready={s.ready} /></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const Eventing = () => {
    const { dark } = useTheme();
    const [sources,  setSources]  = useState([]);
    const [triggers, setTriggers] = useState([]);
    const [topics,   setTopics]   = useState([]);
    const [apps,     setApps]     = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [tab,      setTab]      = useState('pipelines');

    const load = async () => {
        setLoading(true);
        try {
            const [sr, tr, tpc, ap] = await Promise.allSettled([
                eventingApi.listSources(),
                eventingApi.listTriggers(),
                kafkaApi.list(),
                appsApi.list(),
            ]);
            if (sr.status === 'fulfilled')  setSources(sr.value.data || []);
            if (tr.status === 'fulfilled')  setTriggers(tr.value.data || []);
            if (tpc.status === 'fulfilled') setTopics(tpc.value.data || []);
            if (ap.status === 'fulfilled')  setApps(ap.value.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const TABS = [
        { key: 'pipelines', label: 'Pipelines',    count: sources.length },
        { key: 'sources',   label: 'KafkaSources', count: sources.length },
        { key: 'triggers',  label: 'Triggers',     count: triggers.length },
        { key: 'publish',   label: 'Publish Event' },
        { key: 'eventlog',  label: 'Event Log',    count: null, icon: FileText },
    ];

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px' }}>Event-Driven</p>
                    <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, fontFamily: "'Outfit', sans-serif" }} className="text-primary">Eventing</h2>
                    <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Kafka → KafkaSource → Broker → Trigger → Service</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748B' }}>
                        <span><span style={{ color: '#F59E0B', fontWeight: 700 }}>{topics.length}</span> topics</span>
                        <span><span style={{ color: '#8B5CF6', fontWeight: 700 }}>{sources.length}</span> sources</span>
                        <span><span style={{ color: '#10B981', fontWeight: 700 }}>{triggers.length}</span> triggers</span>
                    </div>
                    <button onClick={load} disabled={loading} style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer', color: '#5A7080', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}>
                        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: dark ? '#111827' : '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: tab === t.key ? (dark ? '#1F2937' : '#FFFFFF') : 'transparent',
                        color: tab === t.key ? (dark ? '#F9FAFB' : '#0F172A') : '#9CA3AF',
                        transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    }}>
                        {t.icon && <t.icon size={12} />}
                        {t.label}
                        {t.count != null && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: tab === t.key ? 'rgba(139,92,246,0.15)' : 'rgba(100,116,139,0.1)', color: tab === t.key ? '#8B5CF6' : '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Pipelines */}
            {tab === 'pipelines' && (
                <div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 48, color: '#5A7080', fontSize: 13 }}>Loading pipelines…</div>
                    ) : sources.length === 0 ? (
                        <div style={{ background: '#0D1117', border: '1px dashed #1F2B3A', borderRadius: 12, padding: 48, textAlign: 'center' }}>
                            <Zap size={32} color="#3A4A5A" style={{ marginBottom: 12 }} />
                            <p style={{ color: '#DDE6F0', fontWeight: 700, margin: '0 0 6px', fontSize: 14 }}>No pipelines yet</p>
                            <p style={{ color: '#5A7080', fontSize: 12, margin: 0 }}>
                                Pipelines are created automatically when you deploy an app with Kafka enabled in <strong style={{ color: '#4A9EF5' }}>Deploy → Kafka Trigger</strong>
                            </p>
                        </div>
                    ) : (
                        <>
                            {sources.map(source => (
                                <Pipeline
                                    key={source.id}
                                    source={source}
                                    triggers={triggers.filter(t => t.kafkaSourceId === source.id)}
                                    topics={topics}
                                    apps={apps}
                                />
                            ))}
                            {/* Stats row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 8 }}>
                                {[
                                    { label: 'KafkaSources', value: sources.length,  color: '#8B5CF6' },
                                    { label: 'Triggers',     value: triggers.length, color: '#10B981' },
                                    { label: 'Topics',       value: topics.length,   color: '#F59E0B' },
                                    { label: 'Running Apps', value: apps.filter(a => a.status === 'RUNNING').length, color: '#00D4FF' },
                                ].map(s => (
                                    <div key={s.label} style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 10, padding: '14px 18px' }}>
                                        <p style={{ fontSize: 24, fontWeight: 900, margin: 0, color: s.color, fontFamily: "'Outfit', sans-serif" }}>{s.value}</p>
                                        <p style={{ fontSize: 11, margin: '3px 0 0', color: '#5A7080' }}>{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* KafkaSources */}
            {tab === 'sources' && <SourcesTable sources={sources} topics={topics} />}

            {/* Triggers */}
            {tab === 'triggers' && (
                <TriggersTable triggers={triggers} setTriggers={setTriggers} topics={topics} sources={sources} load={load} />
            )}

            {/* Publish */}
            {tab === 'publish' && <PublishForm topics={topics} triggers={triggers} />}

            {/* Event Log */}
            {tab === 'eventlog' && <EventLog triggers={triggers} apps={apps} />}
        </div>
    );
};

export default Eventing;
