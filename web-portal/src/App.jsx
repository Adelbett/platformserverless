import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
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

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return children;    
};

const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/dashboard" replace />;
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
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/apps" element={<AppsList />} />
                <Route path="/apps/new" element={<DeployApp />} />
                <Route path="/apps/:name" element={<AppDetails />} />
                <Route path="/kafka" element={<KafkaTopics />} />
                <Route path="/eventing" element={<Eventing />} />
                <Route path="/logs" element={<LogsView />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/billing" element={<Navigate to="/dashboard" replace />} />
                <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
                <Route path="/users" element={<Users />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
};

function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <AppRoutes />
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
