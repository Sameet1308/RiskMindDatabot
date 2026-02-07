import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Search, BookOpen, Shield } from 'lucide-react'

export default function Layout() {
    const location = useLocation()

    const navItems = [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/analyze', icon: Search, label: 'Analyze Policy' },
        { path: '/guidelines', icon: BookOpen, label: 'Guidelines' },
    ]

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                        <div className="w-11 h-11 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">RiskMind</h1>
                            <p className="text-xs text-slate-400 -mt-0.5">Underwriting Co-Pilot</p>
                        </div>
                    </Link>

                    <nav className="flex gap-1 sm:gap-2">
                        {navItems.map(({ path, icon: Icon, label }) => (
                            <Link
                                key={path}
                                to={path}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${location.pathname === path
                                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <div className="flex items-center justify-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span>RiskMind - Glass Box Underwriting Co-Pilot</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-blue-400">Built for Hackathon</span>
                </div>
            </footer>
        </div>
    )
}
