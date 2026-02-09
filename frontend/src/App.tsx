import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PolicyAnalysis from './pages/PolicyAnalysis'
import Guidelines from './pages/Guidelines'
import Chat from './pages/Chat'
import Login from './pages/Login'

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="analyze" element={<PolicyAnalysis />} />
                <Route path="chat" element={<Chat />} />
                <Route path="guidelines" element={<Guidelines />} />
            </Route>
        </Routes>
    )
}

export default App
