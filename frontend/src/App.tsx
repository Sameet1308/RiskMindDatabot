import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PolicyAnalysis from './pages/PolicyAnalysis'
import Guidelines from './pages/Guidelines'

function App() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="analyze" element={<PolicyAnalysis />} />
                <Route path="guidelines" element={<Guidelines />} />
            </Route>
        </Routes>
    )
}

export default App
