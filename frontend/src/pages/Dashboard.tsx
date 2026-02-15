import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, AlertTriangle, CheckCircle, FileText, ArrowRight, Sparkles, Shield } from 'lucide-react'
import apiService, { PolicyItem, AlertsSummary } from '../services/api'

export default function Dashboard() {
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [alertsSummary, setAlertsSummary] = useState<AlertsSummary>({ total: 0, critical: 0, warning: 0, info: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            const [policiesData, alertsData] = await Promise.all([
                apiService.getPolicies(),
                apiService.getAlertsSummary()
            ])
            setPolicies(policiesData)
            setAlertsSummary(alertsData)
        } catch (err) {
            console.error('Failed to load dashboard:', err)
        } finally {
            setLoading(false)
        }
    }

    const riskCounts = {
        low: policies.filter(p => p.risk_level === 'low').length,
        medium: policies.filter(p => p.risk_level === 'medium').length,
        high: policies.filter(p => p.risk_level === 'high' || p.risk_level === 'refer').length,
    }

    const getBadgeClass = (risk: string) => {
        switch (risk) {
            case 'low': return 'badge-success'
            case 'medium': return 'badge-warning'
            case 'high': return 'badge-danger'
            case 'refer': return 'badge-purple'
            default: return 'badge-success'
        }
    }

    const topPolicies = [...policies].sort((a, b) => b.loss_ratio - a.loss_ratio).slice(0, 8)

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Underwriting risk overview — real-time from database</p>
                </div>
                <Link to="/analyze" className="btn btn-primary">
                    <Sparkles style={{ width: '1rem', height: '1rem' }} />
                    Analyze Policy
                    <ArrowRight style={{ width: '1rem', height: '1rem' }} />
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="section">
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon blue">
                            <FileText style={{ width: '1.25rem', height: '1.25rem' }} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Total Policies</div>
                            <div className="stat-value">{loading ? '—' : policies.length}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon green">
                            <CheckCircle style={{ width: '1.25rem', height: '1.25rem' }} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Low Risk</div>
                            <div className="stat-value">{loading ? '—' : riskCounts.low}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon amber">
                            <TrendingUp style={{ width: '1.25rem', height: '1.25rem' }} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Medium Risk</div>
                            <div className="stat-value">{loading ? '—' : riskCounts.medium}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon red">
                            <AlertTriangle style={{ width: '1.25rem', height: '1.25rem' }} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Needs Review</div>
                            <div className="stat-value">{loading ? '—' : riskCounts.high}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts Summary */}
            <div className="section">
                <div className="card">
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="stat-icon red">
                                <Shield style={{ width: '1.25rem', height: '1.25rem' }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.0625rem' }}>Active Alerts</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    {alertsSummary.critical} critical · {alertsSummary.warning} warning · {alertsSummary.info} info
                                </div>
                            </div>
                        </div>
                        <Link to="/alerts" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                            View All Alerts
                            <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Policies Table — Real Data */}
            <div className="section">
                <div className="table-container">
                    <div className="table-header">
                        <h2>Top Policies by Risk</h2>
                        <p>Sorted by loss ratio — highest risk first ({policies.length} total in portfolio)</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Loading policies...
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Policy #</th>
                                        <th>Policyholder</th>
                                        <th>Industry</th>
                                        <th style={{ textAlign: 'right' }}>Premium</th>
                                        <th style={{ textAlign: 'center' }}>Claims</th>
                                        <th style={{ textAlign: 'right' }}>Loss Ratio</th>
                                        <th style={{ textAlign: 'center' }}>Risk</th>
                                        <th style={{ textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topPolicies.map((policy) => (
                                        <tr key={policy.policy_number}>
                                            <td>
                                                <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 500 }}>
                                                    {policy.policy_number}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 500 }}>{policy.policyholder_name}</span>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{policy.industry_type}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                                ${policy.premium.toLocaleString()}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{policy.claim_count}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: policy.loss_ratio > 80 ? 'var(--danger)' : policy.loss_ratio > 50 ? 'var(--warning)' : 'var(--success)' }}>
                                                {policy.loss_ratio.toFixed(1)}%
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`badge ${getBadgeClass(policy.risk_level)}`}>
                                                    {policy.risk_level}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <Link to={`/analyze?policy=${policy.policy_number}`} className="text-link">
                                                    Analyze
                                                    <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Glass Box Info */}
            <div className="section">
                <div className="card">
                    <div className="card-body">
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🔍 Glass Box Explainability
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.7 }}>
                            Every risk decision shows exactly <strong>what data was queried</strong>,
                            <strong> what the analysis found</strong>, and
                            <strong> which guideline</strong> drove the recommendation.
                        </p>
                        <div className="code-block">
                            <span className="keyword">SELECT</span> COUNT(*), SUM(claim_amount) <span className="keyword">FROM</span> claims <span className="keyword">WHERE</span> policy_id = ?<br />
                            <span className="comment">-- Results:</span> <span className="number">5 claims</span>, <span className="number">$75,500 total</span><br />
                            <span className="comment">-- Guideline:</span> <span className="string">Section 3.1.1 - High Frequency Threshold</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
