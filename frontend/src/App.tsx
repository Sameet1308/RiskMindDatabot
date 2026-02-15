import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RiskMind from './pages/RiskMind'
import Workbench from './pages/Workbench'
import SavedIntelligence from './pages/SavedIntelligence'
import ClaimDetail from './components/ClaimDetail'
import Login from './pages/Login'

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
                <Route index element={<RiskMind />} />
                <Route path="workbench" element={<Workbench />} />
                <Route path="saved" element={<SavedIntelligence />} />
                <Route path="claims/:id" element={<ClaimDetail />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
