import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Loader2, AlertTriangle, CheckCircle, Shield, FileCode, BookOpen, Database } from 'lucide-react'
import apiService, { AnalysisResponse } from '../services/api'

export default function PolicyAnalysis() {
    const [searchParams] = useSearchParams()
    const [policyNumber, setPolicyNumber] = useState(searchParams.get('policy') || '')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<AnalysisResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const demoPolicies = ['COMM-2024-001', 'COMM-2024-002', 'COMM-2024-003']

    useEffect(() => {
        const policy = searchParams.get('policy')
        if (policy) {
            setPolicyNumber(policy)
            handleAnalyze(policy)
        }
    }, [searchParams])

    const handleAnalyze = async (policy?: string) => {
        const policyToAnalyze = policy || policyNumber
        if (!policyToAnalyze.trim()) return

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const data = await apiService.analyzePolicy(policyToAnalyze)
            setResult(data)
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to analyze policy. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }

    const getRiskIcon = (level: string) => {
        const iconStyle = { width: '2rem', height: '2rem' }
        switch (level) {
            case 'low': return <CheckCircle style={{ ...iconStyle, color: 'var(--success)' }} />
            case 'medium': return <Shield style={{ ...iconStyle, color: 'var(--warning)' }} />
            case 'high': return <AlertTriangle style={{ ...iconStyle, color: 'var(--danger)' }} />
            case 'refer': return <AlertTriangle style={{ ...iconStyle, color: 'var(--purple)' }} />
            default: return <Shield style={{ ...iconStyle, color: 'var(--text-light)' }} />
        }
    }

    const getRiskStyles = (level: string) => {
        switch (level) {
            case 'low': return { borderColor: '#86efac', background: '#f0fdf4' }
            case 'medium': return { borderColor: '#fcd34d', background: '#fefce8' }
            case 'high': return { borderColor: '#fca5a5', background: '#fef2f2' }
            case 'refer': return { borderColor: '#c4b5fd', background: '#f5f3ff' }
            default: return { borderColor: 'var(--border)', background: 'var(--surface)' }
        }
    }

    const getBadgeClass = (level: string) => {
        switch (level) {
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
                    <h1 className="page-title">Policy Risk Analysis</h1>
                    <p className="page-subtitle">Enter a policy number for full Glass Box analysis</p>
                </div>
            </div>

            {/* Search Section */}
            <div className="section">
                <div className="card">
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '250px' }}>
                                    <label className="input-label">Policy Number</label>
                                    <input
                                        type="text"
                                        value={policyNumber}
                                        onChange={(e) => setPolicyNumber(e.target.value)}
                                        placeholder="Enter policy number (e.g., COMM-2024-001)"
                                        className="input-field"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button
                                        onClick={() => handleAnalyze()}
                                        disabled={loading || !policyNumber.trim()}
                                        className="btn btn-primary"
                                    >
                                        {loading ? (
                                            <Loader2 style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} />
                                        ) : (
                                            <Search style={{ width: '1.125rem', height: '1.125rem' }} />
                                        )}
                                        {loading ? 'Analyzing...' : 'Analyze'}
                                    </button>
                                </div>
                            </div>

                            <div className="divider" />

                            <div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Quick select:</p>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {demoPolicies.map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => {
                                                setPolicyNumber(p)
                                                handleAnalyze(p)
                                            }}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="section">
                    <div style={{
                        background: 'var(--danger-light)',
                        border: '1px solid #fca5a5',
                        borderRadius: '0.75rem',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: 'var(--danger)'
                    }}>
                        <AlertTriangle style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>{error}</span>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="section">
                    <div className="card">
                        <div className="card-body" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <Loader2 style={{ width: '3rem', height: '3rem', color: 'var(--primary)', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                            <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '1.125rem' }}>Analyzing policy...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <>
                    {/* Recommendation Banner */}
                    <div className="section">
                        <div className="card" style={{ borderWidth: '2px', ...getRiskStyles(result.risk_level) }}>
                            <div className="card-body">
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
                                    <div style={{
                                        padding: '0.75rem',
                                        borderRadius: '0.75rem',
                                        background: 'white',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}>
                                        {getRiskIcon(result.risk_level)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
                                            {result.recommendation}
                                        </h2>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
                                            {result.reason}
                                        </p>
                                        <div style={{ marginTop: '1rem' }}>
                                            <span className={`badge ${getBadgeClass(result.risk_level)}`} style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}>
                                                {result.risk_level.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Glass Box Evidence */}
                    <div className="section">
                        <div className="table-container">
                            <div className="table-header" style={{ background: 'linear-gradient(to right, #dbeafe, white)' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🔍 Glass Box Evidence
                                </h2>
                                <p>Complete transparency into the analysis</p>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {/* SQL Query */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <div className="stat-icon blue" style={{ width: '2.5rem', height: '2.5rem' }}>
                                            <FileCode style={{ width: '1.25rem', height: '1.25rem' }} />
                                        </div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>SQL Query Executed</h3>
                                    </div>
                                    <div className="code-block" style={{ whiteSpace: 'pre-wrap' }}>
                                        {result.evidence.sql_query}
                                    </div>
                                </div>

                                {/* Data Retrieved */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <div className="stat-icon amber" style={{ width: '2.5rem', height: '2.5rem' }}>
                                            <Database style={{ width: '1.25rem', height: '1.25rem' }} />
                                        </div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Data Retrieved</h3>
                                    </div>
                                    <div className="stats-grid">
                                        <div className="stat-card">
                                            <div className="stat-content">
                                                <div className="stat-label">Total Claims</div>
                                                <div className="stat-value">{result.claims_summary.claim_count}</div>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-content">
                                                <div className="stat-label">Total Amount</div>
                                                <div className="stat-value">${result.claims_summary.total_amount.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-content">
                                                <div className="stat-label">Avg Claim</div>
                                                <div className="stat-value">${result.claims_summary.avg_amount.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-content">
                                                <div className="stat-label">Max Claim</div>
                                                <div className="stat-value">${result.claims_summary.max_claim.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Guideline Citation */}
                                {result.evidence.guideline_citation && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                            <div className="stat-icon purple" style={{ width: '2.5rem', height: '2.5rem' }}>
                                                <BookOpen style={{ width: '1.25rem', height: '1.25rem' }} />
                                            </div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Guideline Citation</h3>
                                        </div>
                                        <div style={{
                                            background: 'var(--purple-light)',
                                            border: '1px solid #c4b5fd',
                                            borderRadius: '0.75rem',
                                            padding: '1.25rem'
                                        }}>
                                            <p style={{ color: 'var(--purple)', fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
                                                {result.evidence.guideline_section}
                                            </p>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontStyle: 'italic', lineHeight: 1.6 }}>
                                                "{result.evidence.guideline_citation}"
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
