import { useState, useEffect } from 'react'
import { Briefcase, TrendingUp, AlertTriangle, CheckCircle, Search, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiService, { PolicyItem } from '../services/api'

export default function Workbench() {
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        loadPolicies()
    }, [])

    const loadPolicies = async () => {
        try {
            const data = await apiService.getPolicies()
            setPolicies(data)
        } catch (err) {
            console.error('Failed to load policies:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredPolicies = policies.filter(p =>
        p.policy_number.toLowerCase().includes(search.toLowerCase()) ||
        p.policyholder_name.toLowerCase().includes(search.toLowerCase()) ||
        p.industry_type.toLowerCase().includes(search.toLowerCase())
    )

    const totalPremium = policies.reduce((sum, p) => sum + p.premium, 0)
    const totalClaims = policies.reduce((sum, p) => sum + p.total_claims, 0)
    const highRiskCount = policies.filter(p => p.risk_level === 'high').length
    const lowRiskCount = policies.filter(p => p.risk_level === 'low').length

    const riskBadge = (level: string) => {
        const styles: Record<string, { bg: string; color: string }> = {
            low: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
            medium: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
            high: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
        }
        const s = styles[level] || styles.low
        return (
            <span style={{
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                background: s.bg,
                color: s.color
            }}>
                {level}
            </span>
        )
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Underwriting Workbench</h1>
                    <p className="page-subtitle">Portfolio overview — {policies.length} active policies</p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card">
                    <div className="stat-icon"><Briefcase /></div>
                    <div>
                        <div className="stat-label">Total Policies</div>
                        <div className="stat-value">{policies.length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><TrendingUp /></div>
                    <div>
                        <div className="stat-label">Total Premium</div>
                        <div className="stat-value">${(totalPremium / 1000).toFixed(0)}K</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}><AlertTriangle /></div>
                    <div>
                        <div className="stat-label">High Risk</div>
                        <div className="stat-value" style={{ color: '#ef4444' }}>{highRiskCount}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}><CheckCircle /></div>
                    <div>
                        <div className="stat-label">Low Risk</div>
                        <div className="stat-value" style={{ color: '#22c55e' }}>{lowRiskCount}</div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <Search style={{
                    position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                    width: '1rem', height: '1rem', color: 'var(--text-secondary)'
                }} />
                <input
                    type="text"
                    placeholder="Search by policy number, name, or industry..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.75rem 1rem 0.75rem 2.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem'
                    }}
                />
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading policies...</div>
            ) : (
                <div className="card" style={{ overflow: 'auto', padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                <th style={thStyle}>Policy #</th>
                                <th style={thStyle}>Policyholder</th>
                                <th style={thStyle}>Industry</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Premium</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Claims</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Claims $</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Loss Ratio</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Risk</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPolicies.map(p => (
                                <tr key={p.policy_number} style={{
                                    borderBottom: '1px solid var(--border)',
                                    transition: 'background 0.15s',
                                    cursor: 'pointer'
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={tdStyle}>
                                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.policy_number}</span>
                                    </td>
                                    <td style={tdStyle}>{p.policyholder_name}</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            {p.industry_type}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>${p.premium.toLocaleString()}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>{p.claim_count}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>${p.total_claims.toLocaleString()}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>{p.loss_ratio.toFixed(1)}%</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>{riskBadge(p.risk_level)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <button
                                            onClick={() => navigate(`/analyze?policy=${p.policy_number}`)}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                        >
                                            <FileText style={{ width: '0.75rem', height: '0.75rem' }} />
                                            Analyze
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    letterSpacing: '0.03em'
}

const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem'
}
