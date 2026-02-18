import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { Shield, Briefcase, Bot, Bookmark, LogOut, User, BarChart3 } from 'lucide-react'

export default function Layout() {
    const navigate = useNavigate()

    const raw = localStorage.getItem('riskmind_user')
    const user = raw ? JSON.parse(raw) : null

    const handleLogout = () => {
        localStorage.removeItem('riskmind_user')
        navigate('/login')
    }

    const navItems = [
        { path: '/', icon: Bot, label: 'RiskMind' },
        { path: '/workbench', icon: Briefcase, label: 'Workbench' },
        { path: '/saved', icon: Bookmark, label: 'Saved Intelligence' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    ]

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <Link to="/" className="brand">
                        <div className="brand-icon">
                            <Shield style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} />
                        </div>
                        <div>
                            <h1 className="brand-title">RiskMind</h1>
                            <p className="brand-subtitle">Underwriting Co-Pilot</p>
                        </div>
                    </Link>

                    <nav className="nav">
                        {navItems.map(({ path, icon: Icon, label }) => (
                            <NavLink
                                key={path}
                                to={path}
                                end={path === '/'}
                                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                            >
                                <Icon className="nav-icon" />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* User Info + Logout */}
                    {user && (
                        <div className="header-user">
                            <div className="header-user-info">
                                <User style={{ width: '0.875rem', height: '0.875rem' }} />
                                <span className="header-user-name">{user.name}</span>
                                <span className="header-user-role">{user.role}</span>
                            </div>
                            <button className="header-logout-btn" onClick={handleLogout} title="Sign out">
                                <LogOut style={{ width: '0.875rem', height: '0.875rem' }} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>

        </div>
    )
}
