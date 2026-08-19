import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import ClusterManagement from './pages/admin/ClusterManagement';
import AdminApps from './pages/admin/AdminApps';
import AdminBilling from './pages/admin/AdminBilling';
import AdminClients from './pages/admin/AdminClients';
import AdminAuditLog from './pages/admin/AdminAuditLog';
import AdminUsers from './pages/admin/AdminUsers';

const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/dashboard" replace />;
    return children;
};

// Every route in this app is admin-only — there is no client-facing surface
// here, so this simply gates on "authenticated with the ADMIN role" rather
// than distinguishing tiers the way web-portal's AdminRoute does.
const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'ADMIN') return <Navigate to="/login" replace />;
    return children;
};

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/login" element={
                <PublicRoute><Login /></PublicRoute>
            } />

            <Route element={<AdminRoute><Layout /></AdminRoute>}>
                <Route path="/dashboard" element={<AdminDashboard />} />
                <Route path="/cluster" element={<ClusterManagement />} />
                <Route path="/apps" element={<AdminApps />} />
                <Route path="/billing" element={<AdminBilling />} />
                <Route path="/clients" element={<AdminClients />} />
                <Route path="/audit-log" element={<AdminAuditLog />} />
                <Route path="/users" element={<AdminUsers />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
};

function App() {
    return (
        <AuthProvider>
            <NotificationProvider>
                <ToastProvider>
                    <AppRoutes />
                </ToastProvider>
            </NotificationProvider>
        </AuthProvider>
    );
}

export default App;
