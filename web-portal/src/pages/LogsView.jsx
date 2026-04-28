import { useEffect, useMemo, useRef, useState } from 'react';
const DownloadIcon = () => <span>⬇</span>;
const WrapTextIcon = () => <span>⏎</span>;
const AddIcon      = () => <span>+</span>;
const RemoveIcon   = () => <span>−</span>;
const RefreshIcon  = () => <span>↻</span>;
import { logsApi } from '../api';
import { useAuth } from '../context/AuthContext';

const levelColor = (level) => {
    if (level === 'ERROR' || level === 'FAILED') return '#F85149';
    if (level === 'WARN') return '#E8A838';
    return '#4A9EF5';
};

const LogsView = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [appFilter, setAppFilter] = useState('all');
    const [levelFilters, setLevelFilters] = useState({ INFO: true, WARN: true, ERROR: true, FAILED: true });
    const [search, setSearch] = useState('');
    const [wordWrap, setWordWrap] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);
    const [fontSize, setFontSize] = useState(12);
    const [loading, setLoading] = useState(true);
    const logsEndRef = useRef(null);

    useEffect(() => {
        let active = true;

        const loadLogs = async () => {
            try {
                setLoading(true);
                const userId = user?.id || user?.username || 'admin';
                const response = await logsApi.getByUser(userId);
                if (!active) return;
                setLogs(Array.isArray(response.data) ? response.data : []);
            } catch {
                if (!active) return;
                setLogs([]);
            } finally {
                if (active) setLoading(false);
            }
        };

        loadLogs();
        return () => {
            active = false;
        };
    }, [user]);

    useEffect(() => {
        if (autoScroll) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs, autoScroll]);

    const apps = useMemo(() => {
        const uniqueApps = [...new Set(logs.map((log) => log.appId || log.appName || 'unknown'))];
        return ['all', ...uniqueApps];
    }, [logs]);

    const filtered = logs.filter((log) => {
        const appName = log.appId || log.appName || 'unknown';
        if (appFilter !== 'all' && appName !== appFilter) return false;
        if (!levelFilters[log.type || 'INFO']) return false;
        if (search) {
            const haystack = `${appName} ${log.message || ''} ${log.type || ''}`.toLowerCase();
            if (!haystack.includes(search.toLowerCase())) return false;
        }
        return true;
    });

    const handleExport = () => {
        const content = filtered.map((log) => {
            const appName = log.appId || log.appName || 'unknown';
            const timestamp = log.createdAt || '';
            return `[${timestamp}] [${log.type || 'INFO'}] [${appName}] ${log.message || ''}`;
        }).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'logs.txt';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 108px)', gap: '16px', overflow: 'hidden' }}>
            <div style={{
                width: '280px',
                minWidth: '280px',
                background: '#0D1117',
                border: '1px solid #1F2B3A',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #1F2B3A', fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: '14px', color: '#DDE6F0' }}>
                    Filters
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#5A7080', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                            Application
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {apps.map((app) => (
                                <button
                                    key={app}
                                    type="button"
                                    onClick={() => setAppFilter(app)}
                                    style={{
                                        padding: '8px 12px',
                                        background: appFilter === app ? 'rgba(74,158,245,0.08)' : 'transparent',
                                        border: `1px solid ${appFilter === app ? 'rgba(74,158,245,0.2)' : 'transparent'}`,
                                        borderRadius: '7px',
                                        color: appFilter === app ? '#4A9EF5' : '#5A7080',
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    {app === 'all' ? '● All Applications' : app}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#5A7080', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                            Log Level
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {Object.keys(levelFilters).map((level) => (
                                <label key={level} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '7px 10px', borderRadius: '6px', background: levelFilters[level] ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                    <input
                                        type="checkbox"
                                        checked={levelFilters[level]}
                                        onChange={() => setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }))}
                                        style={{ accentColor: levelColor(level), width: '14px', height: '14px', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: levelFilters[level] ? levelColor(level) : '#2D3D52' }}>
                                        {level}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#5A7080', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                            Search
                        </div>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="keyword..."
                            style={{
                                width: '100%', background: '#161B22', border: '1px solid #1F2B3A',
                                color: '#DDE6F0', padding: '8px 12px', borderRadius: '7px',
                                fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", outline: 'none',
                            }}
                        />
                    </div>
                </div>

                <div style={{ padding: '14px 16px', borderTop: '1px solid #1F2B3A', display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn-glass" style={{ flex: 1, padding: '8px', fontSize: '12px' }} onClick={() => {
                        setAppFilter('all');
                        setLevelFilters({ INFO: true, WARN: true, ERROR: true, FAILED: true });
                        setSearch('');
                    }}>
                        <RefreshIcon style={{ fontSize: '14px' }} /> Reset
                    </button>
                    <button type="button" className="btn-neon" style={{ flex: 1, padding: '8px', fontSize: '12px' }} onClick={handleExport}>
                        <DownloadIcon style={{ fontSize: '14px' }} /> Export
                    </button>
                </div>
            </div>

            <div style={{
                flex: 1,
                background: '#0D1117',
                border: '1px solid #1F2B3A',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minWidth: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#161B22', borderBottom: '1px solid #1F2B3A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F85149' }} />
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E8A838' }} />
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3FB950' }} />
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.25)', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#3FB950' }}>
                            LIVE
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#5A7080' }}>
                            {loading ? 'Loading logs...' : `${filtered.length} lines`}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" onClick={() => setWordWrap((value) => !value)} className="btn-glass" style={{ padding: '5px 10px', fontSize: '11px' }}>
                            <WrapTextIcon style={{ fontSize: '14px' }} /> Wrap
                        </button>
                        <button type="button" onClick={() => setAutoScroll((value) => !value)} className="btn-glass" style={{ padding: '5px 10px', fontSize: '11px' }}>
                            {autoScroll ? <AddIcon style={{ fontSize: '14px' }} /> : <RemoveIcon style={{ fontSize: '14px' }} />}
                            Auto
                        </button>
                    </div>
                </div>

                <div style={{ background: '#020408', fontFamily: "'JetBrains Mono', monospace", fontSize: `${fontSize}px`, minHeight: '400px', maxHeight: '600px', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {filtered.length === 0 ? (
                        <div style={{ color: '#5A7080' }}>No logs match the current filters.</div>
                    ) : (
                        filtered.map((log, index) => (
                            <div key={log.id || index} style={{ display: 'flex', gap: '14px', flexWrap: wordWrap ? 'wrap' : 'nowrap' }}>
                                <span style={{ color: '#2D3D52', flexShrink: 0 }}>{log.createdAt || ''}</span>
                                <span style={{ color: levelColor(log.type), fontWeight: 600, width: '60px', flexShrink: 0 }}>{log.type || 'INFO'}</span>
                                <span style={{ color: '#A8B8C8' }}>{log.message}</span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};

export default LogsView;
