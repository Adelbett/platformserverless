import { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import Sidebar from './Sidebar';

const routeTitles = {
    '/dashboard':  { title: 'Overview',   sub: 'Global platform health and utilization' },
    '/cluster':    { title: 'Cluster',    sub: 'Nodes, namespaces, pods, Knative, Kafka' },
    '/clients':    { title: 'Clients',    sub: 'Suspend, restore, and set quotas per tenant' },
    '/billing':    { title: 'Revenue',    sub: 'Platform-wide billing and invoices' },
    '/audit-log':  { title: 'Audit Log',  sub: 'Every suspend, restore, and force-delete action' },
    '/incidents':  { title: 'Incidents',  sub: 'Shown on the public status page' },
    '/anomalies':  { title: 'Anomalies',  sub: 'Cost and traffic spikes detected automatically' },
};

const ADMIN_BANNER_HEIGHT = 32;

const fmtTime = (iso) => {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const ThemeToggle = () => {
    const { dark, toggleTheme } = useTheme();
    return (
        <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
                width: 38, height: 38, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#64748B', transition: 'background 200ms, color 200ms',
            }}
            className="theme-btn"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; }}
        >
            <AnimatePresence mode="wait" initial={false}>
                {dark ? (
                    <motion.span key="sun"
                        initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                        animate={{ opacity: 1, rotate: 0,   scale: 1   }}
                        exit={{    opacity: 0, rotate:  90, scale: 0.5 }}
                        transition={{ duration: 0.18 }}
                        style={{ display: 'flex', color: '#F9FAFB' }}
                    >
                        <Sun size={17} />
                    </motion.span>
                ) : (
                    <motion.span key="moon"
                        initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
                        animate={{ opacity: 1, rotate: 0,  scale: 1   }}
                        exit={{    opacity: 0, rotate: -90, scale: 0.5 }}
                        transition={{ duration: 0.18 }}
                        style={{ display: 'flex' }}
                    >
                        <Moon size={17} />
                    </motion.span>
                )}
            </AnimatePresence>
        </button>
    );
};

const NotificationsPanel = () => {
    const [open, setOpen] = useState(false);
    const ref             = useRef(null);
    const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const notifColor = (type) => {
        if (type === 'DEPLOYMENT_SUCCESS') return '#10B981';
        if (type === 'DEPLOYMENT_FAIL')    return '#EF4444';
        if (type === 'KAFKA_WIRED')        return '#F59E0B';
        if (type === 'UPDATE')             return '#00D4FF';
        return '#6B7280';
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: 38, height: 38, borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#64748B', position: 'relative', transition: 'background 200ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <Bell size={17} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -3, right: -3,
                        minWidth: 17, height: 17, borderRadius: 999,
                        background: '#EF4444', fontSize: 9, fontWeight: 700, padding: '0 4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', animation: 'pulseDot 2s ease-in-out infinite',
                    }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="ns-card"
                        style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 320, zIndex: 200, overflow: 'hidden', maxHeight: 420, display: 'flex', flexDirection: 'column' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700 }} className="text-primary">Notifications</span>
                                {unreadCount > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#EF4444', padding: '1px 7px', borderRadius: 999 }}>{unreadCount} new</span>
                                )}
                            </div>
                            {unreadCount > 0 && (
                                <button onClick={markAllRead}
                                    style={{ fontSize: 11, color: '#00D4FF', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    Mark all read
                                </button>
                            )}
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {notifications.length === 0 ? (
                                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: 12 }}>
                                    <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>🔔</span>
                                    No notifications yet
                                </div>
                            ) : notifications.map(n => (
                                <div key={n.id}
                                    onClick={() => markRead(n.id)}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px',
                                        borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer',
                                        background: !n.read ? 'rgba(0,212,255,0.03)' : 'transparent',
                                        transition: 'background 150ms',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                                    onMouseLeave={e => e.currentTarget.style.background = !n.read ? 'rgba(0,212,255,0.03)' : 'transparent'}
                                >
                                    <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{n.emoji || '📋'}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 1px', fontFamily: "'JetBrains Mono', monospace", color: notifColor(n.type) }}>{n.appName}</p>
                                        <p style={{ fontSize: 11.5, margin: 0, fontWeight: !n.read ? 600 : 400, lineHeight: 1.4 }} className="text-primary">{n.message}</p>
                                        <p style={{ fontSize: 10, margin: '3px 0 0', color: '#9CA3AF' }}>{fmtTime(n.time)}</p>
                                    </div>
                                    {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D4FF', flexShrink: 0, marginTop: 5 }} />}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const UserMenu = ({ user, onLogout }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const { dark } = useTheme();

    const email    = user?.email || user?.username || 'user@nextstep.io';
    const username = email.split('@')[0];
    const initials = username.slice(0, 2).toUpperCase();
    const role     = user?.role || 'MEMBER';

    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', borderRadius: 8, border: 'none',
                    background: 'transparent', cursor: 'pointer',
                    transition: 'background 200ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'linear-gradient(135deg, #00D4FF, #0066FF)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: 'white',
                    fontFamily: "'Outfit', sans-serif", flexShrink: 0,
                }}>
                    {initials}
                </div>
                <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, margin: 0, lineHeight: 1 }} className="text-primary">{username}</p>
                    <p style={{ fontSize: 10, margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace", color: '#9CA3AF' }}>{role}</p>
                </div>
                <ChevronDown size={13} style={{ color: '#9CA3AF', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="ns-card"
                        style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 220, zIndex: 100, overflow: 'hidden' }}
                    >
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }} className="text-primary">{username}</p>
                            <p style={{ fontSize: 11, margin: '2px 0 0', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
                        </div>
                        <div style={{ padding: '6px' }}>
                            {[{ icon: <User size={14}/>, label: 'Profile' }, { icon: <Settings size={14}/>, label: 'Settings' }].map(item => (
                                <button key={item.label} className="btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13 }}>
                                    {item.icon} {item.label}
                                </button>
                            ))}
                        </div>
                        <div style={{ padding: '6px', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <button onClick={onLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#EF4444', transition: 'background 150ms' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                                <LogOut size={14} /> Sign out
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Layout = () => {
    const location  = useLocation();
    const navigate  = useNavigate();
    const { user, logout } = useAuth();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const routeInfo = routeTitles[location.pathname] || { title: 'Admin', sub: '' };
    const pageTitle = routeInfo.title;
    const pageSub   = routeInfo.sub;

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
            {/* Visually distinct banner — never let this app be mistaken for the public client portal */}
            <div style={{
                height: ADMIN_BANNER_HEIGHT, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'repeating-linear-gradient(135deg, #7F1D1D, #7F1D1D 10px, #991B1B 10px, #991B1B 20px)',
                color: '#FEE2E2', fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                borderBottom: '1px solid rgba(0,0,0,0.25)',
            }}>
                ⚠ Admin Console — Internal Use Only ⚠
            </div>

            <div className="app-shell" style={{ height: `calc(100vh - ${ADMIN_BANNER_HEIGHT}px)` }}>
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

                <div className="app-main">
                {/* Header */}
                <div className="app-header">
                    {/* Left: page title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="text-primary">
                                {pageTitle}
                            </h1>
                            <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">{pageSub}</p>
                        </div>
                    </div>

                    {/* Center: search */}
                    <div style={{ flex: 1, maxWidth: 300, margin: '0 24px', display: 'flex' }}>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                placeholder="Search apps, logs…"
                                className="ns-input"
                                style={{ paddingLeft: 32, paddingTop: 7, paddingBottom: 7, fontSize: 12 }}
                            />
                        </div>
                    </div>

                    {/* Right: actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <NotificationsPanel />
                        <ThemeToggle />
                        <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.08)', margin: '0 4px' }} />
                        <UserMenu user={user} onLogout={handleLogout} />
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="app-content">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22 }}
                    >
                        <Outlet />
                    </motion.div>
                </div>
                </div>
            </div>
        </div>
    );
};

export default Layout;
