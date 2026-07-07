import React, { useEffect, useRef } from 'react';

const Terminal = ({ logs = [], height = '300px' }) => {
    const endOfLogsRef = useRef(null);

    useEffect(() => {
        endOfLogsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const getLogColor = (level) => {
        switch (level) {
            case 'ERROR': return 'var(--status-red)';
            case 'WARN': return 'var(--status-orange)';
            case 'INFO': return 'var(--status-green)';
            default: return 'var(--text-dark)';
        }   
    };

    return (
        <div style={{
            background: '#040608',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-glass)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            height: height,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
        }}>
            <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
            }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--status-red)' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--status-orange)' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--status-green)' }} />
                <span style={{ marginLeft: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Live Logs WebSocket</span>
            </div>
            
            <div style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                {logs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>Waiting for logs...</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} style={{ display: 'flex', gap: '16px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
                            <span style={{ color: getLogColor(log.level), fontWeight: 'bold', width: '45px' }}>{log.level}</span>
                            <span style={{ color: 'var(--text-dark)' }}>{log.message}</span>
                        </div>
                    ))
                )}
                <div ref={endOfLogsRef} />
            </div>
        </div>
    );
};

export default Terminal;
