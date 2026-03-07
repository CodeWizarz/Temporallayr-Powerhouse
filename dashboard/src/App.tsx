import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import TracesPage from './pages/Traces'
import TraceDetailPage from './pages/TraceDetail'
import IncidentsPage from './pages/Incidents'
import AnalyticsPage from './pages/Analytics'
import ReplayPage from './pages/Replay'
import SettingsPage from './pages/Settings'
import StatusPage from './pages/Status'

import SignupPage from './pages/Signup'

export default function App() {
    return (
        <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<Navigate to="/traces" replace />} />
            <Route path="/traces" element={<Layout><TracesPage /></Layout>} />
            <Route path="/traces/:traceId" element={<Layout><TraceDetailPage /></Layout>} />
            <Route path="/incidents" element={<Layout><IncidentsPage /></Layout>} />
            <Route path="/analytics" element={<Layout><AnalyticsPage /></Layout>} />
            <Route path="/replay" element={<Layout><ReplayPage /></Layout>} />
            <Route path="/status" element={<Layout><StatusPage /></Layout>} />
            <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
        </Routes>
    )
}