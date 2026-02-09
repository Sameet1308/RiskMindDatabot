import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, AlertTriangle, CheckCircle, FileText, ArrowRight, Sparkles } from 'lucide-react'

const demoPolicies = [
    { number: 'COMM-2024-001', name: 'ABC Manufacturing Inc.', risk: 'low', claims: 2, amount: '$23,500' },
    { number: 'COMM-2024-002', name: 'XYZ Restaurant Group', risk: 'high', claims: 5, amount: '$75,500' },
    { number: 'COMM-2024-003', name: 'SafeBuild Construction', risk: 'refer', claims: 1, amount: '$175,000' },
]

export default function Dashboard() {
    const getBadgeClass = (risk: string) => {
        switch (risk) {
            case 'low': return 'badge-success'
            case 'medium': return 'badge-warning'
            case 'high': return 'badge-danger'
            case 'refer': return 'badge-purple'
            default: return 'badge-success'
        }
    }

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Underwriting risk overview and quick analysis</p>
                </div>
                <Link to="/analyze" className="btn btn-primary">
                    <Sparkles className="w-4 h-4" />
                    Analyze Policy
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="section">
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon blue">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Total Policies</div>
                            <div className="stat-value">3</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon green">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Low Risk</div>
                            <div className="stat-value">1</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon amber">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Medium Risk</div>
                            <div className="stat-value">0</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon red">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Needs Review</div>
                            <div className="stat-value">2</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Policies Table */}
            <div className="section">
                <div className="table-container">
                    <div className="table-header">
                        <h2>Demo Policies</h2>
                        <p>Click on any policy to run a full risk analysis</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Policy #</th>
                                    <th>Policyholder</th>
                                    <th style={{ textAlign: 'center' }}>Claims</th>
                                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                                    <th style={{ textAlign: 'center' }}>Risk Level</th>
                                    <th style={{ textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {demoPolicies.map((policy) => (
                                    <tr key={policy.number}>
                                        <td>
                                            <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 500 }}>
                                                {policy.number}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{policy.name}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{policy.claims}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }}>{policy.amount}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${getBadgeClass(policy.risk)}`}>
                                                {policy.risk}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <Link to={`/analyze?policy=${policy.number}`} className="text-link">
                                                Full Analysis
                                                <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
