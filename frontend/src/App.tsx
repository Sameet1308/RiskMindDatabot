import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RiskMind from './pages/RiskMind'
import Workbench from './pages/Workbench'
import SavedIntelligence from './pages/SavedIntelligence'
import ClaimDetail from './components/ClaimDetail'
import Login from './pages/Login'
import Analytics from './pages/Analytics'

function RequireAuth({ children }: { children: React.ReactNode }) {
    const raw = localStorage.getItem('riskmind_user')
    if (!raw) return <Navigate to="/login" replace />
    try {
        const user = JSON.parse(raw)
        if (!user?.email) return <Navigate to="/login" replace />
    } catch {
        return <Navigate to="/login" replace />
    }
    return <>{children}</>
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                <Route index element={<RiskMind />} />
                <Route path="workbench" element={<Workbench />} />
                <Route path="saved" element={<SavedIntelligence />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="claims/:id" element={<ClaimDetail />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    )
}

export default App
