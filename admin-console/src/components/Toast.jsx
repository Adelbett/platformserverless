import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
};

const TOAST_VARIANTS = {
    success: { bg: 'rgba(63, 185, 80, 0.1)',   border: 'rgba(63, 185, 80, 0.3)',   color: '#3FB950', icon: '✓' },
    error:   { bg: 'rgba(248, 81, 73, 0.1)',   border: 'rgba(248, 81, 73, 0.3)',   color: '#F85149', icon: '✕' },
    warning: { bg: 'rgba(232, 168, 56, 0.1)',  border: 'rgba(232, 168, 56, 0.3)',  color: '#E8A838', icon: '⚠' },
    info:    { bg: 'rgba(74, 158, 245, 0.1)',  border: 'rgba(74, 158, 245, 0.3)',  color: '#4A9EF5', icon: 'ℹ' },
};

const ToastItem = ({ toast, onDismiss }) => {
    const [exiting, setExiting] = useState(false);
    const variant = TOAST_VARIANTS[toast.type] || TOAST_VARIANTS.info;

    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
    }, [toast.id, onDismiss]);

    useEffect(() => {
        if (toast.type !== 'error') {
            const t = setTimeout(dismiss, toast.duration || 4000);
            return () => clearTimeout(t);
        }
    }, [dismiss, toast.type, toast.duration]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '14px 16px',
            background: variant.bg,
            border: `1px solid ${variant.border}`,
            borderRadius: '10px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            minWidth: '300px',
            maxWidth: '420px',
            animation: exiting
                ? 'slideInRight 0.3s ease reverse forwards'
                : 'slideInRight 0.3s ease forwards',
            position: 'relative',
        }}>
            <span style={{ color: variant.color, fontSize: '16px', flexShrink: 0, marginTop: '1px', fontWeight: 700 }}>{variant.icon}</span>
            <div style={{ flex: 1 }}>
                {toast.title && (
                    <div style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: variant.color,
                        marginBottom: toast.message ? '2px' : 0,
                        fontFamily: "'Syne', sans-serif",
                    }}>{toast.title}</div>
                )}
                {toast.message && (
                    <div style={{ fontSize: '0.82rem', color: '#A8B8C8', lineHeight: 1.5 }}>{toast.message}</div>
                )}
            </div>
            <button
                onClick={dismiss}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#5A7080',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                }}
            >
                <span style={{ fontSize: '14px', lineHeight: 1 }}>✕</span>
            </button>
        </div>
    );
};

export const ToastContainer = ({ toasts, onDismiss }) => {
    if (!toasts.length) return null;
    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none',
        }}>
            {toasts.map(t => (
                <div key={t.id} style={{ pointerEvents: 'all' }}>
                    <ToastItem toast={t} onDismiss={onDismiss} />
                </div>
            ))}
        </div>
    );
};

let _id = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = useCallback((type, title, message, opts = {}) => {
        const id = ++_id;
        setToasts(prev => [...prev, { id, type, title, message, ...opts }]);
        return id;
    }, []);

    const success = useCallback((title, message, opts) => toast('success', title, message, opts), [toast]);
    const error   = useCallback((title, message, opts) => toast('error', title, message, opts), [toast]);
    const warning = useCallback((title, message, opts) => toast('warning', title, message, opts), [toast]);
    const info    = useCallback((title, message, opts) => toast('info', title, message, opts), [toast]);

    return (
        <ToastContext.Provider value={{ success, error, warning, info, dismiss }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
};

export default ToastProvider;
