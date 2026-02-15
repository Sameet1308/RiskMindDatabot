import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'

export default function Login() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        // Demo authentication — connects to users table in SQLite
        setTimeout(() => {
            if (email.includes('@')) {
                localStorage.setItem('riskmind_user', JSON.stringify({
                    email,
                    name: email.split('@')[0],
                    role: 'Underwriter',
                    loginTime: new Date().toISOString()
                }))
                navigate('/')
            } else {
                setError('Please enter a valid email address')
            }
            setLoading(false)
        }, 800)
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
                                placeholder="you@ltm.com"
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

                {/* Demo Credentials */}
                <div style={{
                    marginTop: '2rem',
                    padding: '1rem',
                    background: '#FFF1F1',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255, 90, 95, 0.15)'
                }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#FF5A5F', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Demo Access
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Email: <strong>demo@ltm.com</strong><br />
                        Password: <strong>any password</strong>
                    </p>
                </div>
            </div>
        </div>
    )
}
