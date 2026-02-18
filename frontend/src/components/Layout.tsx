import { Outlet, Link, NavLink } from 'react-router-dom'
import { Shield, Briefcase, Bot, Bookmark } from 'lucide-react'

export default function Layout() {
    const navItems = [
        { path: '/', icon: Bot, label: 'RiskMind' },
        { path: '/workbench', icon: Briefcase, label: 'Workbench' },
        { path: '/saved', icon: Bookmark, label: 'Saved Intelligence' },
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
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>

        </div>
    )
}
