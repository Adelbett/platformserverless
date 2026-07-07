import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AppsList from './pages/AppsList';
import DeployApp from './pages/DeployApp';
import AppDetails from './pages/AppDetails';
import KafkaTopics from './pages/KafkaTopics';
import Eventing from './pages/Eventing';
import LogsView from './pages/LogsView';
import Monitoring from './pages/Monitoring';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Team from './pages/Team';
import AdminDashboard from './pages/admin/AdminDashboard';
import ClusterManagement from './pages/admin/ClusterManagement';
import AdminBilling from './pages/admin/AdminBilling';
import AdminClients from './pages/admin/AdminClients';
import AdminAuditLog from './pages/admin/AdminAuditLog';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'} replace />;
    return children;
};

const DashboardRedirect = () => {
    const { user } = useAuth();
    if (user?.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    return <Dashboard />;
};

const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
    return children;
};

const ClientAdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'CLIENT_ADMIN') return <Navigate to="/dashboard" replace />;
    return children;
};

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/login" element={
                <PublicRoute><Login /></PublicRoute>
            } />

            <Route path="/register" element={
                <PublicRoute><Register /></PublicRoute>
            } />

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<DashboardRedirect />} />
                <Route path="/apps" element={<AppsList />} />
                <Route path="/apps/new" element={<DeployApp />} />
                <Route path="/apps/:name" element={<AppDetails />} />
                <Route path="/kafka" element={<KafkaTopics />} />
                <Route path="/eventing" element={<Eventing />} />
                <Route path="/logs" element={<LogsView />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/team" element={
                    <ClientAdminRoute><Team /></ClientAdminRoute>
                } />
                <Route path="/settings" element={<Settings />} />
                <Route path="/users" element={<Users />} />
                {/* Admin-only routes */}
                <Route path="/admin/dashboard" element={
                    <AdminRoute><AdminDashboard /></AdminRoute>
                } />
                <Route path="/admin/cluster" element={
                    <AdminRoute><ClusterManagement /></AdminRoute>
                } />
                <Route path="/admin/billing" element={
                    <AdminRoute><AdminBilling /></AdminRoute>
                } />
                <Route path="/admin/users" element={
                    <AdminRoute><Users /></AdminRoute>
                } />
                <Route path="/admin/clients" element={
                    <AdminRoute><AdminClients /></AdminRoute>
                } />
                <Route path="/admin/audit-log" element={
                    <AdminRoute><AdminAuditLog /></AdminRoute>
                } />
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
