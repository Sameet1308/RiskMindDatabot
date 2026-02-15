import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Loader2, AlertTriangle, CheckCircle, Shield, FileCode, BookOpen, Database, ThumbsUp, ThumbsDown, FileText, X, Bot } from 'lucide-react'
import apiService, { AnalysisResponse, MemoResponse, DecisionItem, Claim } from '../services/api'

export default function PolicyAnalysis() {
    const [searchParams] = useSearchParams()
    const [policyNumber, setPolicyNumber] = useState(searchParams.get('policy') || '')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<AnalysisResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [policyClaims, setPolicyClaims] = useState<Claim[]>([])
    const [evidenceState, setEvidenceState] = useState<Record<string, { loading: boolean; analysis?: string; localUrl?: string; error?: string }>>({})
    const [selectedClaimId, setSelectedClaimId] = useState<number | ''>('')
    const [evidenceDescription, setEvidenceDescription] = useState('')
    const [uploadingEvidence, setUploadingEvidence] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Decision state
    const [decisionLoading, setDecisionLoading] = useState(false)
    const [decisionSaved, setDecisionSaved] = useState<string | null>(null)
    const [decisions, setDecisions] = useState<DecisionItem[]>([])
    const [decisionNote, setDecisionNote] = useState('')

    // Memo state
    const [memoLoading, setMemoLoading] = useState(false)
    const [memo, setMemo] = useState<MemoResponse | null>(null)
    const [showMemo, setShowMemo] = useState(false)

    const demoPolicies = ['COMM-2024-001', 'COMM-2024-002', 'COMM-2024-003', 'COMM-2024-005', 'COMM-2024-010']

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
        setDecisionSaved(null)
        setMemo(null)
        setShowMemo(false)
        setDecisionNote('')

        try {
            const [data, history, claims] = await Promise.all([
                apiService.analyzePolicy(policyToAnalyze),
                apiService.getDecisions(policyToAnalyze).catch(() => []),
                apiService.getClaimsByPolicy(policyToAnalyze).catch(() => [])
            ])
            setResult(data)
            setDecisions(history)
            setPolicyClaims(claims)
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to analyze policy. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }

    const handleDecision = async (decision: string) => {
        if (!policyNumber.trim() || !result) return
        setDecisionLoading(true)
        try {
            await apiService.recordDecision(policyNumber, decision, decisionNote || undefined, result.risk_level)
            setDecisionSaved(decision)
            const history = await apiService.getDecisions(policyNumber)
            setDecisions(history)
        } catch (err) {
            console.error('Failed to record decision:', err)
        } finally {
            setDecisionLoading(false)
        }
    }

    const handleViewMemo = async () => {
        if (!policyNumber.trim()) return
        setMemoLoading(true)
        try {
            const data = await apiService.getMemo(policyNumber)
            setMemo(data)
            setShowMemo(true)
        } catch (err) {
            console.error('Failed to load memo:', err)
        } finally {
            setMemoLoading(false)
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

    const evidenceItems = useMemo(() => {
        const items: Array<{ type: string; url: string; local_path?: string; description?: string; claim_number: string; claim_date: string }> = []
        policyClaims.forEach((claim) => {
            if (!claim.evidence_files) return
            try {
                const parsed = JSON.parse(claim.evidence_files) as Array<{ type: string; url: string; local_path?: string; description?: string }>
                parsed.forEach((ev) => {
                    if (!ev?.url) return
                    items.push({
                        type: ev.type || 'image',
                        url: ev.url,
                        local_path: ev.local_path,
                        description: ev.description,
                        claim_number: claim.claim_number,
                        claim_date: claim.claim_date
                    })
                })
            } catch {
                // ignore invalid evidence JSON
            }
        })
        return items
    }, [policyClaims])

    const sortedClaims = useMemo(() => (
        [...policyClaims].sort((a, b) => new Date(b.claim_date).getTime() - new Date(a.claim_date).getTime())
    ), [policyClaims])

    useEffect(() => {
        if (!selectedClaimId && sortedClaims.length > 0) {
            setSelectedClaimId(sortedClaims[0].id)
        }
    }, [selectedClaimId, sortedClaims])

    const aiActions = useMemo(() => {
        if (!result) return [] as string[]
        const actions: string[] = []
        const summary = result.claims_summary

        if (result.risk_level === 'high' || result.risk_level === 'refer') {
            actions.push('Escalate to senior underwriter and schedule a loss control review.')
        }

        if (summary.claim_count >= 5) {
            actions.push('Initiate a frequency review and consider pricing or deductible adjustments.')
        }

        if (summary.max_claim >= 100000) {
            actions.push('Notify claims leadership and validate reserve adequacy for high severity loss.')
        }

        if (!actions.length) {
            actions.push('Maintain current terms and monitor for adverse loss ratio shifts.')
        }

        actions.push('Review evidence package and confirm loss drivers with the insured.')

        return actions
    }, [result])

    const analyzeEvidence = async (url: string, prompt?: string) => {
        setEvidenceState(prev => ({
            ...prev,
            [url]: { ...(prev[url] || {}), loading: true, error: undefined }
        }))

        try {
            const response = await apiService.analyzeEvidenceUrl(url, prompt)
            setEvidenceState(prev => ({
                ...prev,
                [url]: { loading: false, analysis: response.analysis || 'Analysis complete.', localUrl: response.file_url }
            }))
        } catch (err: any) {
            setEvidenceState(prev => ({
                ...prev,
                [url]: { loading: false, error: err.response?.data?.detail || 'Failed to analyze evidence.' }
            }))
        }
    }

    const handleEvidenceUpload = async () => {
        if (!selectedClaimId || uploadingEvidence) return
        const file = fileInputRef.current?.files?.[0]
        if (!file) {
            setUploadError('Select a file to upload.')
            return
        }

        setUploadingEvidence(true)
        setUploadError(null)

        try {
            const response = await apiService.uploadClaimEvidence(
                Number(selectedClaimId),
                file,
                evidenceDescription
            )

            setPolicyClaims(prev => prev.map(claim => {
                if (claim.id !== Number(selectedClaimId)) return claim
                let existing: Array<{ type: string; url: string; local_path?: string; description?: string }> = []
                try {
                    existing = claim.evidence_files ? JSON.parse(claim.evidence_files) : []
                    if (!Array.isArray(existing)) existing = []
                } catch {
                    existing = []
                }
                existing.push({
                    type: response.file_type,
                    url: response.file_url,
                    local_path: response.local_path,
                    description: evidenceDescription || file.name
                })
                return { ...claim, evidence_files: JSON.stringify(existing) }
            }))

            setEvidenceState(prev => ({
                ...prev,
                [response.file_url]: {
                    loading: false,
                    analysis: response.analysis || 'Analysis complete.',
                    localUrl: response.file_url
                }
            }))

            setEvidenceDescription('')
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (err: any) {
            setUploadError(err.response?.data?.detail || 'Failed to upload evidence.')
        } finally {
            setUploadingEvidence(false)
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

                    {/* Evidence-Backed AI Blend */}
                    <div className="section">
                        <div className="card">
                            <div className="card-body">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Co-Pilot Evidence Blend</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                            Structured metrics + unstructured evidence + LLM reasoning
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span className="badge badge-secondary">{policyClaims.length} claims</span>
                                        <span className="badge badge-secondary">{evidenceItems.length} evidence items</span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                                    {/* Structured */}
                                    <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1rem', background: 'var(--surface-alt)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                                            <Database style={{ width: '1rem', height: '1rem' }} /> Structured Data
                                        </div>
                                        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                                            <div>Claims: <strong>{result.claims_summary.claim_count}</strong></div>
                                            <div>Total Incurred: <strong>${result.claims_summary.total_amount.toLocaleString()}</strong></div>
                                            <div>Avg Claim: <strong>${result.claims_summary.avg_amount.toLocaleString()}</strong></div>
                                            <div>Max Claim: <strong>${result.claims_summary.max_claim.toLocaleString()}</strong></div>
                                        </div>
                                        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Evidence query: SQL-backed glass box
                                        </div>
                                    </div>

                                    {/* Unstructured */}
                                    <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1rem', background: 'var(--surface-alt)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                                            <FileText style={{ width: '1rem', height: '1rem' }} /> Unstructured Evidence
                                        </div>
                                        {evidenceItems.length === 0 ? (
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No evidence media linked to claims.</div>
                                        ) : (
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                {evidenceItems.slice(0, 3).map((ev, idx) => (
                                                    <div key={`${ev.url}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>{ev.description || ev.type}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{ev.claim_number}</span>
                                                    </div>
                                                ))}
                                                {evidenceItems.length > 3 && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        +{evidenceItems.length - 3} more items
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* AI Insight */}
                                    <div style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1rem', background: 'var(--surface-alt)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                                            <Bot style={{ width: '1rem', height: '1rem' }} /> LLM Actionable Insight
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            {result.reason}
                                        </div>
                                        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem', fontSize: '0.8125rem' }}>
                                            {aiActions.map((a, i) => (
                                                <div key={`${a}-${i}`} style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <span>•</span>
                                                    <span>{a}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Upload Evidence</h4>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Attach to a specific claim
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                                        <div>
                                            <label className="input-label">Claim</label>
                                            <select
                                                value={selectedClaimId}
                                                onChange={(e) => setSelectedClaimId(e.target.value ? Number(e.target.value) : '')}
                                                className="input-field"
                                            >
                                                {sortedClaims.length === 0 && (
                                                    <option value="">No claims available</option>
                                                )}
                                                {sortedClaims.map((claim) => (
                                                    <option key={claim.id} value={claim.id}>
                                                        {claim.claim_number} · {new Date(claim.claim_date).toLocaleDateString()}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="input-label">Description</label>
                                            <input
                                                type="text"
                                                value={evidenceDescription}
                                                onChange={(e) => setEvidenceDescription(e.target.value)}
                                                placeholder="Optional evidence note"
                                                className="input-field"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">File</label>
                                            <input ref={fileInputRef} type="file" className="input-field" />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                            <button
                                                onClick={handleEvidenceUpload}
                                                disabled={uploadingEvidence || !selectedClaimId}
                                                className="btn btn-primary"
                                                style={{ width: '100%' }}
                                            >
                                                {uploadingEvidence ? 'Uploading...' : 'Upload & Analyze'}
                                            </button>
                                        </div>
                                    </div>
                                    {uploadError && (
                                        <div style={{ marginTop: '0.5rem', color: 'var(--danger)', fontSize: '0.75rem' }}>
                                            {uploadError}
                                        </div>
                                    )}
                                </div>

                                {evidenceItems.length > 0 && (
                                    <div style={{ marginTop: '1.5rem' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Evidence Gallery</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                            {evidenceItems.map((ev, idx) => {
                                                const state = evidenceState[ev.url]
                                                const mediaUrl = state?.localUrl || ev.url

                                                return (
                                                    <div key={`${ev.url}-${idx}`} style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden', background: 'white' }}>
                                                        {ev.type === 'video' ? (
                                                            <div style={{ background: '#000' }}>
                                                                <video src={mediaUrl} controls style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                                                            </div>
                                                        ) : (
                                                            <img src={mediaUrl} alt={ev.description || 'Evidence'} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                                                        )}
                                                        <div style={{ padding: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{ev.description || 'Evidence item'}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ev.claim_number} · {new Date(ev.claim_date).toLocaleDateString()}</div>
                                                                {ev.local_path && (
                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>Local path: {ev.local_path}</div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <button
                                                                    onClick={() => analyzeEvidence(ev.url)}
                                                                    disabled={state?.loading}
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                                                >
                                                                    {state?.loading ? 'Analyzing...' : 'Analyze with RiskMind'}
                                                                </button>
                                                                <a
                                                                    href={ev.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                                                >
                                                                    Open Source
                                                                </a>
                                                            </div>
                                                            {state?.analysis && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-alt)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                                                                    {state.analysis}
                                                                </div>
                                                            )}
                                                            {state?.error && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{state.error}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ===== DECISION PANEL ===== */}
                    <div className="section">
                        <div className="card">
                            <div className="card-body">
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    ⚖️ Underwriting Decision
                                </h3>

                                {decisionSaved ? (
                                    <div style={{
                                        background: decisionSaved === 'accept' ? '#f0fdf4' : decisionSaved === 'refer' ? '#f5f3ff' : '#fef2f2',
                                        border: `1px solid ${decisionSaved === 'accept' ? '#86efac' : decisionSaved === 'refer' ? '#c4b5fd' : '#fca5a5'}`,
                                        borderRadius: '0.75rem',
                                        padding: '1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem'
                                    }}>
                                        <CheckCircle style={{ width: '1.5rem', height: '1.5rem', color: 'var(--success)' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                                                Decision Recorded: <span style={{ textTransform: 'uppercase' }}>{decisionSaved}</span>
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                Policy {policyNumber} · {new Date().toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="input-label">Notes (optional)</label>
                                            <input
                                                type="text"
                                                value={decisionNote}
                                                onChange={(e) => setDecisionNote(e.target.value)}
                                                placeholder="Add a note about your decision..."
                                                className="input-field"
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => handleDecision('accept')}
                                                disabled={decisionLoading}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    padding: '0.75rem 1.5rem', borderRadius: '0.75rem',
                                                    fontWeight: 600, fontSize: '0.9375rem', border: 'none', cursor: 'pointer',
                                                    background: '#059669', color: 'white', transition: 'all 0.2s'
                                                }}
                                            >
                                                <ThumbsUp style={{ width: '1rem', height: '1rem' }} />
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => handleDecision('refer')}
                                                disabled={decisionLoading}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    padding: '0.75rem 1.5rem', borderRadius: '0.75rem',
                                                    fontWeight: 600, fontSize: '0.9375rem', border: 'none', cursor: 'pointer',
                                                    background: '#7c3aed', color: 'white', transition: 'all 0.2s'
                                                }}
                                            >
                                                <Shield style={{ width: '1rem', height: '1rem' }} />
                                                Refer to Senior
                                            </button>
                                            <button
                                                onClick={() => handleDecision('decline')}
                                                disabled={decisionLoading}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    padding: '0.75rem 1.5rem', borderRadius: '0.75rem',
                                                    fontWeight: 600, fontSize: '0.9375rem', border: 'none', cursor: 'pointer',
                                                    background: '#dc2626', color: 'white', transition: 'all 0.2s'
                                                }}
                                            >
                                                <ThumbsDown style={{ width: '1rem', height: '1rem' }} />
                                                Decline
                                            </button>

                                            <button
                                                onClick={handleViewMemo}
                                                disabled={memoLoading}
                                                className="btn btn-secondary"
                                                style={{ marginLeft: 'auto' }}
                                            >
                                                <FileText style={{ width: '1rem', height: '1rem' }} />
                                                {memoLoading ? 'Loading...' : 'View Memo'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Decision History */}
                    {decisions.length > 0 && (
                        <div className="section">
                            <div className="card">
                                <div className="card-body">
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
                                        Decision History
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {decisions.slice(0, 5).map((d) => (
                                            <div key={d.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.625rem 1rem', borderRadius: '0.5rem',
                                                background: 'var(--surface-alt)', fontSize: '0.875rem'
                                            }}>
                                                <span className={`badge ${getBadgeClass(d.decision === 'accept' ? 'low' : d.decision === 'refer' ? 'refer' : 'high')}`}
                                                    style={{ fontSize: '0.6875rem', padding: '0.25rem 0.625rem' }}>
                                                    {d.decision.toUpperCase()}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)' }}>
                                                    {d.decided_by} · {new Date(d.created_at).toLocaleString()}
                                                </span>
                                                {d.reason && <span style={{ color: 'var(--text-secondary)' }}>— {d.reason}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== MEMO MODAL ===== */}
                    {showMemo && memo && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '2rem'
                        }}
                            onClick={() => setShowMemo(false)}
                        >
                            <div style={{
                                background: 'white', borderRadius: '1rem', maxWidth: '700px', width: '100%',
                                maxHeight: '85vh', overflowY: 'auto', padding: '2rem'
                            }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h2 style={{ fontSize: '1.375rem', fontWeight: 700 }}>📝 Underwriting Memo</h2>
                                    <button onClick={() => setShowMemo(false)} style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem'
                                    }}>
                                        <X style={{ width: '1.25rem', height: '1.25rem' }} />
                                    </button>
                                </div>

                                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9375rem' }}>
                                        <div><strong>Policy:</strong> {memo.policy_number}</div>
                                        <div><strong>Date:</strong> {memo.memo_date}</div>
                                        <div><strong>Policyholder:</strong> {memo.policyholder}</div>
                                        <div><strong>Industry:</strong> {memo.industry}</div>
                                        <div><strong>Premium:</strong> ${memo.premium.toLocaleString()}</div>
                                        <div><strong>Risk Level:</strong> <span className={`badge ${getBadgeClass(memo.summary.risk_level)}`} style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem' }}>{memo.summary.risk_level.toUpperCase()}</span></div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)' }}>Recommendation</h3>
                                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>{memo.recommendation}</p>
                                    <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Pricing: {memo.pricing_action}</p>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)' }}>Key Reasons</h3>
                                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.9375rem', lineHeight: 1.7 }}>
                                        {memo.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </div>

                                {memo.guideline_references.length > 0 && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)' }}>Guideline References</h3>
                                        {memo.guideline_references.map((g, i) => (
                                            <div key={i} style={{ padding: '0.5rem 0.75rem', background: '#FFF1F1', borderRadius: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                                                <strong>{g.section}</strong>: {g.text}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                                    <button onClick={() => window.print()} className="btn btn-primary">
                                        Print / Save PDF
                                    </button>
                                    <button onClick={() => setShowMemo(false)} className="btn btn-secondary">
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Glass Box Evidence */}
                    <div className="section">
                        <div className="table-container">
                            <div className="table-header" style={{ background: 'linear-gradient(to right, #FFF1F1, white)' }}>
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
                                                <div className="stat-value">{(result.claims_summary as any).claim_count ?? (result.claims_summary as any).total_claims ?? '—'}</div>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-content">
                                                <div className="stat-label">Total Amount</div>
                                                <div className="stat-value">${result.claims_summary.total_amount?.toLocaleString() ?? '—'}</div>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-content">
                                                <div className="stat-label">Avg Claim</div>
                                                <div className="stat-value">${result.claims_summary.avg_amount?.toLocaleString() ?? '—'}</div>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-content">
                                                <div className="stat-label">Max Claim</div>
                                                <div className="stat-value">${result.claims_summary.max_claim?.toLocaleString() ?? '—'}</div>
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
