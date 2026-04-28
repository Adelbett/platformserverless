import { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from './Sidebar';

const routeTitles = {
    '/dashboard':  { title: 'Dashboard',       sub: 'Platform overview & key metrics' },
    '/apps':       { title: 'Applications',    sub: 'Manage your deployed services' },
    '/apps/new':   { title: 'Deploy',          sub: 'Deploy a new application' },
    '/kafka':      { title: 'Scaling',         sub: 'Cluster scaling configuration' },
    '/eventing':   { title: 'Automations',     sub: 'Event streams & automations' },
    '/logs':       { title: 'Secrets & Config',sub: 'Environment & secret management' },
    '/monitoring': { title: 'Monitoring',      sub: 'Real-time cluster metrics' },
    '/settings':   { title: 'Settings',        sub: 'Platform configuration' },
    '/users':      { title: 'Team & Access',   sub: 'Manage users and permissions' },
    '/billing':    { title: 'Billing',         sub: 'Usage & subscription details' },
};

const MOCK_NOTIFICATIONS = [
    { id: 1, type: 'deploy', message: 'api-gateway deployed successfully',    time: '2m ago',  read: false },
    { id: 2, type: 'scale',  message: 'worker-service scaled to 4 replicas', time: '8m ago',  read: false },
    { id: 3, type: 'error',  message: 'auth-service: health check failed',   time: '15m ago', read: true  },
    { id: 4, type: 'deploy', message: 'frontend-app:v2.3.1 build complete',  time: '1h ago',  read: true  },
];

const typeEmoji = { deploy: '🚀', scale: '⚡', error: '⚠️' };

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
    const [open, setOpen]     = useState(false);
    const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);
    const ref                 = useRef(null);
    const unread              = notifs.filter(n => !n.read).length;

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
                {unread > 0 && (
                    <span style={{
                        position: 'absolute', top: -3, right: -3,
                        width: 17, height: 17, borderRadius: '50%',
                        background: '#00D4FF', fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#0A0E1A',
                    }} className="animate-pulse-dot">{unread}</span>
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
                        style={{
                            position: 'absolute', right: 0, top: '100%',
                            marginTop: 8, width: 300, zIndex: 100,
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }} className="text-primary">Notifications</span>
                            {unread > 0 && (
                                <button onClick={() => setNotifs(n => n.map(x => ({...x, read: true})))}
                                    style={{ fontSize: 11, color: '#00D4FF', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    Mark all read
                                </button>
                            )}
                        </div>
                        {notifs.map(n => (
                            <div key={n.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px',
                                borderBottom: '1px solid rgba(0,0,0,0.05)',
                                background: !n.read ? 'rgba(0,212,255,0.03)' : 'transparent',
                            }}>
                                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{typeEmoji[n.type] || '📋'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 12, margin: 0, fontWeight: !n.read ? 600 : 400 }} className="text-primary">{n.message}</p>
                                    <p style={{ fontSize: 10, margin: '2px 0 0', color: '#9CA3AF' }}>{n.time}</p>
                                </div>
                                {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D4FF', flexShrink: 0, marginTop: 4 }} />}
                            </div>
                        ))}
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
    const role     = user?.role || 'DEVELOPER';

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

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const baseRoute    = '/' + (pathSegments[0] || '');
    const isAppDetail  = pathSegments[0] === 'apps' && pathSegments[1] && pathSegments[1] !== 'new';

    const routeInfo = routeTitles[location.pathname] || routeTitles[baseRoute] || { title: 'Platform', sub: '' };
    const pageTitle = isAppDetail ? pathSegments[1] : routeInfo.title;
    const pageSub   = isAppDetail ? 'Application details & management' : routeInfo.sub;

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div className="app-shell">
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
    );
};

export default Layout;
