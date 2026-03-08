import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import AuthGuard from './components/AuthGuard'
import TracesPage from './pages/Traces'
import TraceDetailPage from './pages/TraceDetail'
import IncidentsPage from './pages/Incidents'
import AnalyticsPage from './pages/Analytics'
import ReplayPage from './pages/Replay'
import SettingsPage from './pages/Settings'
import StatusPage from './pages/Status'
import NewService from './pages/NewService'

import SignupPage from './pages/auth/Signup'
import LoginPage from './pages/auth/Login'

export default function App() {
    return (
        <>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/" element={<Navigate to="/traces" replace />} />

                <Route element={<AuthGuard><Layout><Outlet /></Layout></AuthGuard>}>
                    <Route path="/new" element={<NewService />} />
                    <Route path="/traces" element={<TracesPage />} />
                    <Route path="/traces/:traceId" element={<TraceDetailPage />} />
                    <Route path="/incidents" element={<IncidentsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/replay" element={<ReplayPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/status" element={<StatusPage />} />
                </Route>
            </Routes>
            <Toaster
                position="bottom-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#1e1e1e',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontSize: '13px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                    },
                    success: {
                        iconTheme: {
                            primary: '#4ade80',
                            secondary: '#1e1e1e',
                        },
                    },
                }}
            />
        </>
    )
}