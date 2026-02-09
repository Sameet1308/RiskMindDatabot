import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Search, BookOpen, Shield, MessageSquare, LogOut } from 'lucide-react'

export default function Layout() {
    const location = useLocation()

    const navItems = [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/analyze', icon: Search, label: 'Analyze' },
        { path: '/chat', icon: MessageSquare, label: 'Chat' },
        { path: '/guidelines', icon: BookOpen, label: 'Guidelines' },
    ]

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
                        <div style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                            borderRadius: '0.625rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Shield style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>RiskMind</h1>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-2px' }}>Underwriting Co-Pilot</p>
                        </div>
                    </Link>

                    <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {navItems.map(({ path, icon: Icon, label }) => {
                            const isActive = location.pathname === path
                            return (
                                <Link
                                    key={path}
                                    to={path}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: isActive ? 'white' : 'var(--text-secondary)',
                                        background: isActive ? 'var(--primary)' : 'transparent',
                                        textDecoration: 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'var(--surface-alt)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent'
                                        }
                                    }}
                                >
                                    <Icon style={{ width: '1rem', height: '1rem' }} />
                                    <span className="hidden sm:inline">{label}</span>
                                </Link>
                            )
                        })}

                        <div style={{ width: '1px', height: '1.5rem', background: 'var(--border)', margin: '0 0.5rem' }} />

                        <Link
                            to="/login"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                                textDecoration: 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <LogOut style={{ width: '1rem', height: '1rem' }} />
                            <span className="hidden sm:inline">Logout</span>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}
