import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './components/Overview'
import Workbench from './components/Workbench'
import Guidelines from './pages/Guidelines'
import Chat from './pages/Chat'
import ClaimDetail from './components/ClaimDetail'
import PolicyAnalysis from './pages/PolicyAnalysis'
import RiskMap from './components/RiskMap'
import Alerts from './pages/Alerts'

function App() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="workbench" element={<Workbench />} />
                <Route path="claims/:id" element={<ClaimDetail />} />
                <Route path="analyze" element={<PolicyAnalysis />} />
                <Route path="map" element={<RiskMap />} />
                <Route path="guidelines" element={<Guidelines />} />
                <Route path="chat" element={<Chat />} />
                <Route path="alerts" element={<Alerts />} />
            </Route>
        </Routes>
    )
}

export default App
