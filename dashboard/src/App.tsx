import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import TracesPage from './pages/Traces'
import TraceDetailPage from './pages/TraceDetail'
import IncidentsPage from './pages/Incidents'
import AnalyticsPage from './pages/Analytics'
import ReplayPage from './pages/Replay'
import StatusPage from './pages/Status'
import SettingsPage from './pages/Settings'

export default function App() {
    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Navigate to="/traces" replace />} />
                <Route path="/traces" element={<TracesPage />} />
                <Route path="/traces/:traceId" element={<TraceDetailPage />} />
                <Route path="/incidents" element={<IncidentsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/replay" element={<ReplayPage />} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Routes>
        </Layout>
    )
}
