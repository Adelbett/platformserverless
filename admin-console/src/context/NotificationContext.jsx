import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { logsApi } from '../api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const NOTIF_META = {
    DEPLOYMENT_SUCCESS: { emoji: '🚀', color: '#10B981' },
    DEPLOYMENT_FAIL:    { emoji: '⚠️', color: '#EF4444' },
    KAFKA_WIRED:        { emoji: '⚡', color: '#F59E0B' },
    DELETE:             { emoji: '🗑️', color: '#6B7280' },
    UPDATE:             { emoji: '🔄', color: '#00D4FF' },
    ROLLBACK:           { emoji: '↩️', color: '#00D4FF' },
    BUDGET_ALERT:       { emoji: '💰', color: '#F59E0B' },
    CRASH_LOOP_ALERT:   { emoji: '💥', color: '#EF4444' },
};
const SHOW_TYPES = Object.keys(NOTIF_META);

const fmtTime = (iso) => {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const toNotif = (log, readIds) => ({
    id:      log.id,
    type:    log.type,
    appName: log.appName || log.appId?.slice(0, 8) || 'platform',
    message: log.message,
    time:    log.createdAt,
    read:    readIds.has(log.id),
    ...(NOTIF_META[log.type] || { emoji: '📋', color: '#64748B' }),
});

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [readIds, setReadIds] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('notif_read') || '[]')); }
        catch { return new Set(); }
    });

    const loadNotifications = useCallback(async (rids) => {
        if (!user?.username) return;
        try {
            const res = await logsApi.getMine();
            const logs = Array.isArray(res.data) ? res.data : [];
            setNotifications(
                logs
                    .filter(l => SHOW_TYPES.includes(l.type))
                    .slice(0, 20)
                    .map(l => toNotif(l, rids || readIds))
            );
        } catch {}
    }, [user?.username]);

    useEffect(() => { loadNotifications(readIds); }, [user?.username]);

    // SSE stream for real-time notifications
    useEffect(() => {
        if (!user?.username) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        const es = new EventSource(`/api/logs/stream?token=${token}`);
        es.addEventListener('log', (e) => {
            try {
                const log = JSON.parse(e.data);
                if (!SHOW_TYPES.includes(log.type)) return;
                setNotifications(prev => {
                    if (prev.find(n => n.id === log.id)) return prev;
                    return [toNotif(log, readIds), ...prev].slice(0, 20);
                });
            } catch {}
        });
        es.onerror = () => es.close();
        return () => es.close();
    }, [user?.username]);

    const markAllRead = () => {
        const newRids = new Set([...readIds, ...notifications.map(n => n.id)]);
        setReadIds(newRids);
        localStorage.setItem('notif_read', JSON.stringify([...newRids]));
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const markRead = (id) => {
        const newRids = new Set([...readIds, id]);
        setReadIds(newRids);
        localStorage.setItem('notif_read', JSON.stringify([...newRids]));
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, markRead, fmtTime }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);
