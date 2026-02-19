import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, ArrowRight, Loader2, User } from 'lucide-react'
import apiService from '../services/api'

const USERS = [
    { email: 'sarah@apexuw.com', masked: 'sa***@apexuw.com', name: 'Sarah Mitchell', initials: 'SM', role: 'Senior Underwriter' },
    { email: 'james@apexuw.com', masked: 'ja***@apexuw.com', name: 'James Cooper', initials: 'JC', role: 'Underwriter' },
]

export default function Login() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [selectedUser, setSelectedUser] = useState<string | null>(null)

    const selectUser = (userEmail: string) => {
        setEmail(userEmail)
        setSelectedUser(userEmail)
        setError('')
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const data = await apiService.login(email.trim().toLowerCase(), password)
            localStorage.setItem('riskmind_user', JSON.stringify({
                email: data.email,
                name: data.full_name,
                role: data.role,
                assigned_policies: data.assigned_policies,
                loginTime: new Date().toISOString(),
            }))
            // Clear connector flag so Data Connector shows on fresh login
            sessionStorage.removeItem('riskmind_connected')
            navigate('/')
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Login failed. Please check your credentials.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-container">
            <div className="login-card animate-slideUp">
                {/* Logo */}
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <Shield style={{ width: '1.5rem', height: '1.5rem' }} />
                    </div>
                    <h1 style={{ color: '#FF5A5F' }}>RiskMind</h1>
                </div>

                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
                        Welcome back
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                        Sign in to your underwriting account
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        background: 'var(--danger-light)',
                        borderRadius: '0.5rem',
                        padding: '0.875rem 1rem',
                        marginBottom: '1.5rem',
                        color: 'var(--danger)',
                        fontSize: '0.875rem',
                        fontWeight: 500
                    }}>
                        {error}
                    </div>
                )}

                {/* User Selection */}
                <div className="login-users">
                    {USERS.map(u => (
                        <button
                            key={u.email}
                            type="button"
                            className={`login-user-tile${selectedUser === u.email ? ' active' : ''}`}
                            onClick={() => selectUser(u.email)}
                        >
                            <div className="login-user-avatar">
                                <span>{u.initials}</span>
                            </div>
                            <div className="login-user-info">
                                <span className="login-user-name">{u.name}</span>
                                <span className="login-user-email">{u.masked}</span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Form */}
                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label className="input-label">Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{
                                position: 'absolute',
                                left: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '1.125rem',
                                height: '1.125rem',
                                color: 'var(--text-light)'
                            }} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@apexuw.com"
                                className="input-field"
                                style={{ paddingLeft: '2.75rem' }}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock style={{
                                position: 'absolute',
                                left: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '1.125rem',
                                height: '1.125rem',
                                color: 'var(--text-light)'
                            }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="input-field"
                                style={{ paddingLeft: '2.75rem' }}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '0.5rem' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} />
                                Signing in...
                            </>
                        ) : (
                            <>
                                Sign in
                                <ArrowRight style={{ width: '1.125rem', height: '1.125rem' }} />
                            </>
                        )}
                    </button>
                </form>

            </div>
        </div>
    )
}
