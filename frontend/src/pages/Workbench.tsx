import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
    Briefcase, AlertTriangle, CheckCircle, Search, FileText,
    ShieldCheck, Sparkles, XCircle, Clock, TrendingUp,
    RefreshCw, Send, DollarSign, Users, BarChart3,
    ArrowUpRight, ArrowDownRight, Minus, MessageSquare,
    Calendar, MapPin, Zap, X, Download, Save, ThumbsUp,
    ThumbsDown, Loader2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiService, { PolicyItem, DecisionItem, MemoResponse, Claim } from '../services/api'
import { exportElementAsPdf } from '../utils/exportPdf'

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

/**
 * AI pricing engine — guideline-driven (refs: 5.1.1, 5.1.2, 5.1.3, 3.1.1)
 * LR < 50%: loyalty credit -3%  |  50-65%: +5-10%  |  > 65%: +15-25%
 * 5+ claims: additional +15% surcharge
 */
function suggestPremium(p: { premium: number; loss_ratio: number; claim_count: number; total_claims: number }) {
    if (p.total_claims === 0) return p.premium // no claims = no change

    // Guideline-based rate adjustment
    let adjustment = 0
    if (p.loss_ratio < 50) {
        adjustment = -0.03 // 5.1.1: loyalty credit
    } else if (p.loss_ratio <= 65) {
        adjustment = 0.05 + (p.loss_ratio - 50) / 15 * 0.05 // 5.1.2: 5-10% scaled
    } else {
        adjustment = 0.15 + Math.min((p.loss_ratio - 65) / 35, 1) * 0.10 // 5.1.3: 15-25% scaled
    }

    // 3.1.1: 5+ claims surcharge 15%
    if (p.claim_count >= 5) adjustment += 0.15

    return Math.round(p.premium * (1 + adjustment))
}

/** Guideline citation for a pricing recommendation */
function pricingCitation(p: { loss_ratio: number; claim_count: number }): string {
    const parts: string[] = []
    if (p.loss_ratio < 50) parts.push('Guideline 5.1.1: Favorable loss ratio — standard renewal')
    else if (p.loss_ratio <= 65) parts.push('Guideline 5.1.2: Moderate loss ratio — 5-10% rate increase')
    else parts.push('Guideline 5.1.3: Adverse loss ratio — 15-25% mandatory rate increase')
    if (p.claim_count >= 5) parts.push('Guideline 3.1.1: High frequency — 15% surcharge applied')
    return parts.join('. ')
}

type WorkbenchTab = 'overview' | 'submissions' | 'renewals' | 'quotes' | 'communications'
type ModalType = 'memo' | 'decision' | 'intel' | null

export default function Workbench() {
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [decisionMap, setDecisionMap] = useState<Record<string, DecisionItem[]>>({})
    const [activeTab, setActiveTab] = useState<WorkbenchTab>('overview')
    const navigate = useNavigate()

    // --- Modal state ---
    const [modalType, setModalType] = useState<ModalType>(null)
    const [modalPolicy, setModalPolicy] = useState<string>('')
    const [memoData, setMemoData] = useState<MemoResponse | null>(null)
    const [modalLoading, setModalLoading] = useState(false)
    const [decisionNotes, setDecisionNotes] = useState('')
    const [decisionRecorded, setDecisionRecorded] = useState<string | null>(null)
    const [saveConfirm, setSaveConfirm] = useState(false)
    const modalRef = useRef<HTMLDivElement>(null)

    const openModal = useCallback(async (type: ModalType, policyNumber: string) => {
        setModalType(type)
        setModalPolicy(policyNumber)
        setMemoData(null)
        setDecisionNotes('')
        setDecisionRecorded(null)
        setSaveConfirm(false)

        if (type === 'memo') {
            setModalLoading(true)
            try {
                const data = await apiService.getMemo(policyNumber)
                setMemoData(data)
            } catch (err) {
                console.error('Failed to load memo:', err)
            } finally {
                setModalLoading(false)
            }
        }
    }, [])

    const closeModal = () => {
        setModalType(null)
        setModalPolicy('')
        setMemoData(null)
        setDecisionRecorded(null)
    }

    const handleDecisionAction = async (action: string) => {
        const policy = policies.find(p => p.policy_number === modalPolicy)
        try {
            await apiService.recordDecision(modalPolicy, action, decisionNotes || undefined, policy?.risk_level || undefined)
            setDecisionRecorded(action.toUpperCase())
            // Refresh decisions
            const fresh = await apiService.getDecisions(modalPolicy).catch(() => [])
            setDecisionMap(prev => ({ ...prev, [modalPolicy]: fresh }))
        } catch (err) {
            console.error('Failed to record decision:', err)
        }
    }

    const handleModalSave = () => {
        const policy = policies.find(p => p.policy_number === modalPolicy)
        const saved = JSON.parse(localStorage.getItem('riskmind_saved') || '[]')
        const item: any = {
            id: `wb-${Date.now()}`,
            timestamp: new Date().toISOString(),
            policy_number: modalPolicy,
            policyholder: policy?.policyholder_name || '',
        }
        if (modalType === 'memo' && memoData) {
            item.type = 'memo'
            item.title = `Memo: ${modalPolicy}`
            item.content = memoData.memo_text
            item.data = memoData
        } else if (modalType === 'decision') {
            item.type = 'decision'
            item.title = `Decision: ${modalPolicy}`
            item.content = decisionRecorded ? `Decision: ${decisionRecorded}` : 'Pending'
            item.data = { policy_number: modalPolicy, decision: decisionRecorded, notes: decisionNotes }
        } else {
            item.type = 'summary'
            item.title = `Intel: ${modalPolicy}`
            item.content = `Quick intel for ${policy?.policyholder_name || modalPolicy}`
            item.data = policy
        }
        saved.unshift(item)
        if (saved.length > 50) saved.length = 50
        localStorage.setItem('riskmind_saved', JSON.stringify(saved))
        setSaveConfirm(true)
        setTimeout(() => setSaveConfirm(false), 2000)
    }

    const handleModalExportPdf = async () => {
        if (!modalRef.current) return
        const filename = `riskmind-${modalType}-${modalPolicy}.pdf`
        await exportElementAsPdf(modalRef.current, filename)
    }

    // Get logged-in user's email for filtering
    const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('riskmind_user') || '{}') } catch { return {} }
    })()

    useEffect(() => {
        loadPolicies()
    }, [])

    const loadPolicies = async () => {
        try {
            const data = await apiService.getPolicies(currentUser.email)
            setPolicies(data)
            const decisions = await Promise.all(
                data.map((policy) => apiService.getDecisions(policy.policy_number).catch(() => []))
            )
            const map: Record<string, DecisionItem[]> = {}
            data.forEach((policy, index) => {
                map[policy.policy_number] = decisions[index] || []
            })
            setDecisionMap(map)
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

    const stats = useMemo(() => {
        const pendingDecisions = policies.filter(p => (decisionMap[p.policy_number] || []).length === 0).length
        const needsReview = policies.filter(p => p.risk_level === 'high' || p.risk_level === 'refer').length
        const evidenceMissing = policies.filter(p => !(p.claims || []).some(c => c.evidence_files)).length
        const highRisk = policies.filter(p => p.risk_level === 'high').length
        const mediumRisk = policies.filter(p => p.risk_level === 'medium').length
        const lowRisk = policies.filter(p => p.risk_level === 'low').length
        const total = policies.length || 1
        const totalPremium = policies.reduce((s, p) => s + (p.premium || 0), 0)
        const totalClaims = policies.reduce((s, p) => s + (p.total_claims || 0), 0)
        const avgLossRatio = policies.length > 0 ? policies.reduce((s, p) => s + (p.loss_ratio || 0), 0) / policies.length : 0
        return { pendingDecisions, needsReview, evidenceMissing, highRisk, mediumRisk, lowRisk, total, totalPremium, totalClaims, avgLossRatio }
    }, [policies, decisionMap])

    // Submissions — derived from real policy data
    const submissions = useMemo(() => {
        return policies.map(p => {
            const hasDec = (decisionMap[p.policy_number] || []).length > 0
            const status = hasDec ? 'quoted' : p.risk_level === 'high' ? 'in_review' : 'new'
            const riskScore = Math.min(95, Math.round(
                40 + (p.loss_ratio * 0.35) + (p.claim_count * 3) + (p.total_claims >= 100000 ? 10 : 0)
            ))
            return {
                policy_number: p.policy_number,
                policyholder: p.policyholder_name,
                industry: p.industry_type,
                premium: p.premium,
                status,
                priority: p.risk_level === 'high' ? 'urgent' : p.risk_level === 'medium' ? 'normal' : 'low',
                submitted_date: p.effective_date || '',
                ai_score: riskScore,
                ai_insight: p.loss_ratio > 65
                    ? `Loss ratio ${p.loss_ratio.toFixed(0)}% exceeds Guideline 5.1.3 threshold (65%). ${p.claim_count} claims totaling ${fmt(p.total_claims)}.`
                    : p.loss_ratio > 50
                        ? `Guideline 5.1.2 review: ${p.loss_ratio.toFixed(0)}% loss ratio. ${p.claim_count} claims, ${fmt(p.total_claims)} incurred.`
                        : `Guideline 5.1.1 met: Favorable ${p.loss_ratio.toFixed(0)}% loss ratio. ${p.claim_count} claim(s), ${fmt(p.total_claims)} incurred.`,
            }
        })
    }, [policies, decisionMap])

    // Renewals — real dates + guideline-driven pricing
    const renewals = useMemo(() => {
        return policies.map(p => {
            const suggested = suggestPremium(p)
            const changePct = p.premium > 0 ? ((suggested - p.premium) / p.premium * 100) : 0
            const expiry = p.expiration_date || ''
            const daysLeft = expiry ? Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000)) : 0
            return {
                policy_number: p.policy_number,
                policyholder: p.policyholder_name,
                industry: p.industry_type,
                current_premium: p.premium,
                suggested_premium: suggested,
                premium_change: changePct === 0 ? '0%' : `${changePct > 0 ? '+' : ''}${changePct.toFixed(0)}%`,
                expiry_date: expiry,
                days_to_expiry: daysLeft,
                risk_level: p.risk_level,
                ai_recommendation: pricingCitation(p),
                claim_trend: p.claim_count > 3 ? 'increasing' : p.claim_count > 1 ? 'stable' : 'decreasing',
            }
        })
    }, [policies])

    // Broker comms — derived from real policy data (high risk → renewal notice, missing evidence → request, pending → quote follow-up)
    const brokerComms = useMemo(() => {
        const msgs: { policy: string; broker: string; subject: string; status: string; date: string; priority: string; ai_draft: string }[] = []

        policies.forEach(p => {
            const dec = (decisionMap[p.policy_number] || [])[0]
            const hasEvidence = (p.claims || []).some(c => c.evidence_files && c.evidence_files !== '[]')

            // High risk with no decision → urgent renewal discussion
            if (p.risk_level === 'high' && !dec) {
                msgs.push({
                    policy: p.policy_number,
                    broker: `Broker: ${p.policyholder_name}`,
                    subject: `${p.policy_number} — Renewal pricing discussion required`,
                    status: 'unread',
                    date: p.expiration_date || '',
                    priority: 'urgent',
                    ai_draft: `Loss ratio at ${p.loss_ratio.toFixed(0)}% with ${p.claim_count} claims (${fmt(p.total_claims)} incurred). Per Guideline 5.1.3, recommend ${suggestPremium(p) > p.premium ? fmt(suggestPremium(p)) : 'current'} premium with enhanced risk controls.`,
                })
            }

            // Missing evidence → request
            if (!hasEvidence && p.claim_count > 0) {
                msgs.push({
                    policy: p.policy_number,
                    broker: `Claims: ${p.policyholder_name}`,
                    subject: `${p.policy_number} — Evidence documentation missing for ${p.claim_count} claim(s)`,
                    status: p.risk_level === 'high' ? 'unread' : 'read',
                    date: p.effective_date || '',
                    priority: p.risk_level === 'high' ? 'high' : 'normal',
                    ai_draft: `${p.claim_count} claim(s) totaling ${fmt(p.total_claims)} have no supporting evidence on file. Request inspection reports, photos, and adjuster estimates to complete underwriting review.`,
                })
            }

            // Pending decision with medium risk → follow-up
            if (p.risk_level === 'medium' && !dec) {
                msgs.push({
                    policy: p.policy_number,
                    broker: `UW Review: ${p.policyholder_name}`,
                    subject: `${p.policy_number} — Quote follow-up: ${p.loss_ratio.toFixed(0)}% loss ratio`,
                    status: 'draft',
                    date: p.expiration_date || '',
                    priority: 'normal',
                    ai_draft: `${p.industry_type} account with ${p.loss_ratio.toFixed(0)}% loss ratio. Per Guideline 5.1.2, recommend renewal at ${fmt(suggestPremium(p))} (${((suggestPremium(p) - p.premium) / p.premium * 100).toFixed(0)}% adjustment) with safety compliance conditions.`,
                })
            }
        })

        return msgs.slice(0, 8) // cap at 8 for UI clarity
    }, [policies, decisionMap])

    const lrColor = (lr: number) => lr > 80 ? 'wb-lr-high' : lr > 60 ? 'wb-lr-med' : 'wb-lr-low'

    const decisionBadge = (policyNumber: string) => {
        const dec = (decisionMap[policyNumber] || [])[0]?.decision
        if (!dec) return <span className="wb-dec-badge wb-dec-pending"><Clock size={11} /> Pending</span>
        const cls = dec === 'accept' ? 'wb-dec-accept' : dec === 'refer' ? 'wb-dec-refer' : 'wb-dec-decline'
        return <span className={`wb-dec-badge ${cls}`}>{dec.charAt(0).toUpperCase() + dec.slice(1)}</span>
    }

    const evidenceIcon = (policy: PolicyItem) => {
        const has = (policy.claims || []).some(c => c.evidence_files)
        return has
            ? <span className="wb-ev wb-ev-ok"><CheckCircle size={13} /> Complete</span>
            : <span className="wb-ev wb-ev-miss"><XCircle size={13} /> Missing</span>
    }

    const statusBadge = (status: string) => {
        const map: Record<string, { cls: string; label: string }> = {
            new: { cls: 'wb-status-new', label: 'New' },
            in_review: { cls: 'wb-status-review', label: 'In Review' },
            quoted: { cls: 'wb-status-quoted', label: 'Quoted' },
            bound: { cls: 'wb-status-bound', label: 'Bound' },
        }
        const s = map[status] || { cls: 'wb-status-new', label: status }
        return <span className={`wb-status-badge ${s.cls}`}>{s.label}</span>
    }

    const priorityDot = (priority: string) => {
        const cls = priority === 'urgent' ? 'wb-prio-urgent' : priority === 'normal' ? 'wb-prio-normal' : 'wb-prio-low'
        return <span className={`wb-prio-dot ${cls}`} />
    }

    const trendIcon = (trend: string) => {
        if (trend === 'increasing') return <ArrowUpRight size={14} className="wb-trend-up" />
        if (trend === 'decreasing') return <ArrowDownRight size={14} className="wb-trend-down" />
        return <Minus size={14} className="wb-trend-stable" />
    }

    if (loading) {
        return (
            <div className="wb-loading">
                <div className="spinner-lg" />
                <p>Loading workbench...</p>
            </div>
        )
    }

    const tabs: { key: WorkbenchTab; label: string; icon: React.ReactNode; count?: number }[] = [
        { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
        { key: 'submissions', label: 'Submissions', icon: <FileText size={14} />, count: submissions.filter(s => s.status === 'new').length },
        { key: 'renewals', label: 'Renewals', icon: <RefreshCw size={14} />, count: renewals.length },
        { key: 'quotes', label: 'Quote Decisions', icon: <DollarSign size={14} />, count: stats.pendingDecisions },
        { key: 'communications', label: 'Action Items', icon: <MessageSquare size={14} />, count: brokerComms.filter(c => c.status === 'unread').length },
    ]

    return (
        <div className="wb-wrap animate-fadeIn">
            {/* Header */}
            <div className="wb-header">
                <div>
                    <h1 className="wb-title">Underwriting Workbench</h1>
                    <p className="wb-subtitle">Submissions, renewals, quotes, and broker communications</p>
                </div>
                <div className="wb-header-stat">
                    <TrendingUp size={16} />
                    <span>{policies.length} Active Policies</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="wb-kpis">
                <div className="wb-kpi wb-kpi--coral">
                    <div className="wb-kpi-icon"><Briefcase size={16} /></div>
                    <div className="wb-kpi-data">
                        <span className="wb-kpi-label">Total Premium</span>
                        <span className="wb-kpi-val">{fmt(stats.totalPremium)}</span>
                    </div>
                </div>
                <div className="wb-kpi wb-kpi--red">
                    <div className="wb-kpi-icon"><AlertTriangle size={16} /></div>
                    <div className="wb-kpi-data">
                        <span className="wb-kpi-label">Needs Review</span>
                        <span className="wb-kpi-val">{stats.needsReview}</span>
                    </div>
                </div>
                <div className="wb-kpi wb-kpi--amber">
                    <div className="wb-kpi-icon"><Clock size={16} /></div>
                    <div className="wb-kpi-data">
                        <span className="wb-kpi-label">Pending Decisions</span>
                        <span className="wb-kpi-val">{stats.pendingDecisions}</span>
                    </div>
                </div>
                <div className="wb-kpi wb-kpi--blue">
                    <div className="wb-kpi-icon"><DollarSign size={16} /></div>
                    <div className="wb-kpi-data">
                        <span className="wb-kpi-label">Avg Loss Ratio</span>
                        <span className="wb-kpi-val">{stats.avgLossRatio.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="wb-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`wb-tab ${activeTab === tab.key ? 'wb-tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="wb-tab-badge">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ═══════ OVERVIEW TAB ═══════ */}
            {activeTab === 'overview' && (
                <>
                    {/* Risk Distribution */}
                    <div className="wb-risk-bar-wrap">
                        <div className="wb-risk-bar-header">
                            <span className="wb-risk-bar-title">Portfolio Risk Distribution</span>
                            <div className="wb-risk-bar-labels">
                                <span className="wb-risk-tag wb-risk-tag--high">{stats.highRisk} High</span>
                                <span className="wb-risk-tag wb-risk-tag--med">{stats.mediumRisk} Medium</span>
                                <span className="wb-risk-tag wb-risk-tag--low">{stats.lowRisk} Low</span>
                            </div>
                        </div>
                        <div className="wb-risk-bar">
                            <div className="wb-risk-seg wb-risk-seg--high" style={{ width: `${(stats.highRisk / stats.total) * 100}%` }} />
                            <div className="wb-risk-seg wb-risk-seg--med" style={{ width: `${(stats.mediumRisk / stats.total) * 100}%` }} />
                            <div className="wb-risk-seg wb-risk-seg--low" style={{ width: `${(stats.lowRisk / stats.total) * 100}%` }} />
                        </div>
                    </div>

                    {/* AI Insight Banner */}
                    <div className="wb-ai-insight">
                        <div className="wb-ai-insight-icon"><Sparkles size={16} /></div>
                        <div className="wb-ai-insight-text">
                            <strong>AI Portfolio Insight</strong>
                            <p>
                                {stats.highRisk} high-risk policies account for {((stats.highRisk / stats.total) * 100).toFixed(0)}% of the portfolio.
                                {stats.pendingDecisions > 0 ? ` ${stats.pendingDecisions} policies await underwriting decisions.` : ''}
                                {stats.avgLossRatio > 60 ? ' Average loss ratio exceeds 60% threshold - consider portfolio-wide review.' : ' Portfolio loss ratio is within acceptable bounds.'}
                            </p>
                        </div>
                    </div>

                    {/* Search + Policy Table */}
                    <div className="wb-search-wrap">
                        <Search className="wb-search-icon" />
                        <input
                            className="wb-search"
                            type="text"
                            placeholder="Search by policy number, name, or industry..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="wb-table-card">
                        <table className="wb-table">
                            <thead>
                                <tr>
                                    <th>Policy #</th>
                                    <th>Policyholder</th>
                                    <th>Industry</th>
                                    <th className="wb-th-r">Premium</th>
                                    <th className="wb-th-c">Claims</th>
                                    <th className="wb-th-r">Loss Ratio</th>
                                    <th className="wb-th-c">Risk</th>
                                    <th className="wb-th-c">Evidence</th>
                                    <th className="wb-th-c">Decision</th>
                                    <th className="wb-th-c">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPolicies.map(p => (
                                    <tr key={p.policy_number}>
                                        <td>
                                            <span className="wb-policy-link" onClick={() => navigate(`/?policy=${p.policy_number}&output=analysis`)}>
                                                {p.policy_number}
                                            </span>
                                        </td>
                                        <td className="wb-td-name">{p.policyholder_name}</td>
                                        <td><span className="wb-industry-tag">{p.industry_type}</span></td>
                                        <td className="wb-td-r">{fmt(p.premium)}</td>
                                        <td className="wb-td-c">{p.claim_count}</td>
                                        <td className={`wb-td-r ${lrColor(p.loss_ratio)}`}>{p.loss_ratio.toFixed(1)}%</td>
                                        <td className="wb-td-c">
                                            <span className={`wb-risk-badge wb-risk-badge--${p.risk_level}`}>{p.risk_level}</span>
                                        </td>
                                        <td className="wb-td-c">{evidenceIcon(p)}</td>
                                        <td className="wb-td-c">{decisionBadge(p.policy_number)}</td>
                                        <td className="wb-td-c">
                                            <div className="wb-actions">
                                                <button className="wb-action-btn" onClick={() => navigate(`/?policy=${p.policy_number}&output=analysis`)}>
                                                    <FileText size={13} /> Analyze
                                                </button>
                                                <button className="wb-action-btn wb-action-btn--accent" onClick={() => openModal('intel', p.policy_number)}>
                                                    <Sparkles size={13} /> Intel
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredPolicies.length === 0 && (
                            <div className="wb-empty">No policies match your search.</div>
                        )}
                    </div>
                </>
            )}

            {/* ═══════ SUBMISSIONS TAB ═══════ */}
            {activeTab === 'submissions' && (
                <>
                    <div className="wb-ai-insight">
                        <div className="wb-ai-insight-icon"><Zap size={16} /></div>
                        <div className="wb-ai-insight-text">
                            <strong>AI Submission Triage</strong>
                            <p>{submissions.filter(s => s.status === 'new').length} new submissions awaiting review. {submissions.filter(s => s.priority === 'urgent').length} flagged as urgent based on risk scoring.</p>
                        </div>
                    </div>

                    <div className="wb-table-card">
                        <table className="wb-table">
                            <thead>
                                <tr>
                                    <th>Policy #</th>
                                    <th>Policyholder</th>
                                    <th>Industry</th>
                                    <th className="wb-th-r">Premium</th>
                                    <th className="wb-th-c">Effective</th>
                                    <th className="wb-th-c">Status</th>
                                    <th className="wb-th-c">Priority</th>
                                    <th className="wb-th-c">Risk Score</th>
                                    <th>Guideline Assessment</th>
                                    <th className="wb-th-c">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map(sub => (
                                    <tr key={sub.policy_number}>
                                        <td><span className="wb-policy-link" onClick={() => navigate(`/?policy=${sub.policy_number}&output=analysis`)}>{sub.policy_number}</span></td>
                                        <td className="wb-td-name">{sub.policyholder}</td>
                                        <td><span className="wb-industry-tag">{sub.industry}</span></td>
                                        <td className="wb-td-r">{fmt(sub.premium)}</td>
                                        <td className="wb-td-c">{sub.submitted_date}</td>
                                        <td className="wb-td-c">{statusBadge(sub.status)}</td>
                                        <td className="wb-td-c">{priorityDot(sub.priority)} {sub.priority}</td>
                                        <td className="wb-td-c">
                                            <span className={`wb-ai-score ${sub.ai_score > 80 ? 'wb-ai-score--high' : sub.ai_score > 65 ? 'wb-ai-score--med' : 'wb-ai-score--low'}`}>
                                                {sub.ai_score}
                                            </span>
                                        </td>
                                        <td className="wb-td-insight">{sub.ai_insight}</td>
                                        <td className="wb-td-c">
                                            <button className="wb-action-btn wb-action-btn--accent" onClick={() => openModal('intel', sub.policy_number)}>
                                                <Sparkles size={13} /> Review
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ═══════ RENEWALS TAB ═══════ */}
            {activeTab === 'renewals' && (
                <>
                    <div className="wb-ai-insight">
                        <div className="wb-ai-insight-icon"><RefreshCw size={16} /></div>
                        <div className="wb-ai-insight-text">
                            <strong>AI Renewal Advisor</strong>
                            <p>{renewals.filter(r => r.risk_level === 'high').length} renewals require premium adjustments. AI has pre-calculated pricing recommendations based on claims history and market benchmarks.</p>
                        </div>
                    </div>

                    <div className="wb-renewal-cards">
                        {renewals.map(r => (
                            <div key={r.policy_number} className={`wb-renewal-card wb-renewal-card--${r.risk_level}`}>
                                <div className="wb-renewal-header">
                                    <div>
                                        <span className="wb-policy-link" onClick={() => navigate(`/?policy=${r.policy_number}&output=analysis`)}>{r.policy_number}</span>
                                        <span className="wb-renewal-holder">{r.policyholder}</span>
                                    </div>
                                    <div className="wb-renewal-expiry">
                                        <Calendar size={12} />
                                        <span>{r.days_to_expiry}d to expiry</span>
                                    </div>
                                </div>
                                <div className="wb-renewal-body">
                                    <div className="wb-renewal-pricing">
                                        <div>
                                            <span className="wb-renewal-label">Current</span>
                                            <strong>{fmt(r.current_premium)}</strong>
                                        </div>
                                        <div className="wb-renewal-arrow">
                                            {r.premium_change !== '0%' ? <ArrowUpRight size={16} /> : <Minus size={16} />}
                                            <span className={r.premium_change !== '0%' ? 'wb-change-up' : ''}>{r.premium_change}</span>
                                        </div>
                                        <div>
                                            <span className="wb-renewal-label">Suggested</span>
                                            <strong>{fmt(r.suggested_premium)}</strong>
                                        </div>
                                    </div>
                                    <div className="wb-renewal-trend">
                                        <span className="wb-renewal-label">Claims Trend</span>
                                        <span className="wb-renewal-trend-val">{trendIcon(r.claim_trend)} {r.claim_trend}</span>
                                    </div>
                                </div>
                                <div className="wb-renewal-ai">
                                    <Sparkles size={12} />
                                    <span>{r.ai_recommendation}</span>
                                </div>
                                <div className="wb-renewal-actions">
                                    <button className="wb-action-btn" onClick={() => openModal('decision', r.policy_number)}>
                                        <ShieldCheck size={13} /> Decide
                                    </button>
                                    <button className="wb-action-btn" onClick={() => openModal('memo', r.policy_number)}>
                                        <FileText size={13} /> Memo
                                    </button>
                                    <button className="wb-action-btn wb-action-btn--accent" onClick={() => navigate(`/?policy=${r.policy_number}&output=analysis`)}>
                                        <Sparkles size={13} /> Analyze
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ═══════ QUOTE DECISIONS TAB ═══════ */}
            {activeTab === 'quotes' && (
                <>
                    <div className="wb-ai-insight">
                        <div className="wb-ai-insight-icon"><DollarSign size={16} /></div>
                        <div className="wb-ai-insight-text">
                            <strong>AI Quote Engine</strong>
                            <p>AI-recommended pricing based on loss ratio, claims frequency, industry benchmarks, and underwriting guidelines. {stats.pendingDecisions} quotes awaiting your decision.</p>
                        </div>
                    </div>

                    <div className="wb-table-card">
                        <table className="wb-table">
                            <thead>
                                <tr>
                                    <th>Policy #</th>
                                    <th>Policyholder</th>
                                    <th>Industry</th>
                                    <th className="wb-th-r">Current Premium</th>
                                    <th className="wb-th-r">AI Suggested</th>
                                    <th className="wb-th-c">Change</th>
                                    <th className="wb-th-r">Loss Ratio</th>
                                    <th className="wb-th-c">Risk</th>
                                    <th className="wb-th-c">Decision</th>
                                    <th className="wb-th-c">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPolicies.map(p => {
                                    const suggested = suggestPremium(p)
                                    const changePercent = p.premium > 0 ? ((suggested - p.premium) / p.premium * 100).toFixed(0) : '0'
                                    return (
                                        <tr key={p.policy_number}>
                                            <td>
                                                <span className="wb-policy-link" onClick={() => openModal('intel', p.policy_number)}>{p.policy_number}</span>
                                            </td>
                                            <td className="wb-td-name">{p.policyholder_name}</td>
                                            <td><span className="wb-industry-tag">{p.industry_type}</span></td>
                                            <td className="wb-td-r">{fmt(p.premium)}</td>
                                            <td className="wb-td-r"><strong>{fmt(suggested)}</strong></td>
                                            <td className="wb-td-c">
                                                <span className={Number(changePercent) > 0 ? 'wb-change-up' : ''}>
                                                    {Number(changePercent) > 0 ? `+${changePercent}%` : '0%'}
                                                </span>
                                            </td>
                                            <td className={`wb-td-r ${lrColor(p.loss_ratio)}`}>{p.loss_ratio.toFixed(1)}%</td>
                                            <td className="wb-td-c">
                                                <span className={`wb-risk-badge wb-risk-badge--${p.risk_level}`}>{p.risk_level}</span>
                                            </td>
                                            <td className="wb-td-c">{decisionBadge(p.policy_number)}</td>
                                            <td className="wb-td-c">
                                                <button className="wb-action-btn wb-action-btn--accent" onClick={() => openModal('decision', p.policy_number)}>
                                                    <DollarSign size={13} /> Quote
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ═══════ BROKER COMMUNICATIONS TAB ═══════ */}
            {activeTab === 'communications' && (
                <>
                    <div className="wb-ai-insight">
                        <div className="wb-ai-insight-icon"><AlertTriangle size={16} /></div>
                        <div className="wb-ai-insight-text">
                            <strong>AI Action Items</strong>
                            <p>{brokerComms.filter(c => c.status === 'unread').length} urgent items requiring attention. Generated from real policy data, claims history, and underwriting guidelines.</p>
                        </div>
                    </div>

                    {brokerComms.length === 0 && (
                        <div className="wb-empty">No action items — all policies are reviewed and documented.</div>
                    )}

                    <div className="wb-comm-list">
                        {brokerComms.map((comm, i) => (
                            <div key={i} className={`wb-comm-card ${comm.status === 'unread' ? 'wb-comm-unread' : ''}`}>
                                <div className="wb-comm-header">
                                    <div className="wb-comm-info">
                                        {priorityDot(comm.priority)}
                                        <div>
                                            <strong>{comm.broker}</strong>
                                            <span className="wb-comm-subject">{comm.subject}</span>
                                        </div>
                                    </div>
                                    <div className="wb-comm-meta">
                                        <span className={`wb-comm-status wb-comm-status--${comm.status}`}>
                                            {comm.status === 'unread' ? 'Urgent' : comm.status === 'draft' ? 'Draft' : 'Noted'}
                                        </span>
                                        <span className="wb-comm-date">{comm.date}</span>
                                    </div>
                                </div>
                                <div className="wb-comm-ai-draft">
                                    <Sparkles size={12} />
                                    <span><strong>AI Analysis:</strong> {comm.ai_draft}</span>
                                </div>
                                <div className="wb-comm-actions">
                                    <button className="wb-action-btn" onClick={() => openModal('intel', comm.policy)}>
                                        <FileText size={13} /> View Intel
                                    </button>
                                    <button className="wb-action-btn wb-action-btn--accent" onClick={() => openModal('decision', comm.policy)}>
                                        <ShieldCheck size={13} /> Decide
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ═══════ MODAL OVERLAY ═══════ */}
            {modalType && (() => {
                const policy = policies.find(p => p.policy_number === modalPolicy)
                return (
                    <div className="wbm-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
                        <div className="wbm-card animate-slideUp" ref={modalRef}>
                            {/* Modal header */}
                            <div className="wbm-header">
                                <div className="wbm-header-left">
                                    <span className={`wbm-type-badge wbm-type-badge--${modalType}`}>
                                        {modalType === 'memo' ? 'Memo' : modalType === 'decision' ? 'Decision' : 'Intel'}
                                    </span>
                                    <div>
                                        <h3 className="wbm-title">{modalPolicy}</h3>
                                        <p className="wbm-subtitle">{policy?.policyholder_name} - {policy?.industry_type}</p>
                                    </div>
                                </div>
                                <div className="wbm-header-actions">
                                    <button className="wbm-btn wbm-btn--save" onClick={handleModalSave} title="Save">
                                        {saveConfirm ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save</>}
                                    </button>
                                    <button className="wbm-btn wbm-btn--pdf" onClick={handleModalExportPdf} title="Export PDF">
                                        <Download size={14} /> PDF
                                    </button>
                                    <button className="wbm-close" onClick={closeModal}><X size={18} /></button>
                                </div>
                            </div>

                            {/* Loading spinner */}
                            {modalLoading && (
                                <div className="wbm-loading">
                                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Loading...</span>
                                </div>
                            )}

                            {/* ── MEMO MODAL ── */}
                            {modalType === 'memo' && memoData && !modalLoading && (
                                <div className="wbm-body">
                                    <div className="wbm-kpis">
                                        <div className="wbm-kpi">
                                            <span className="wbm-kpi-val">{memoData.summary.total_claims}</span>
                                            <span className="wbm-kpi-label">Claims</span>
                                        </div>
                                        <div className="wbm-kpi">
                                            <span className="wbm-kpi-val">{fmt(memoData.summary.total_amount)}</span>
                                            <span className="wbm-kpi-label">Total Loss</span>
                                        </div>
                                        <div className="wbm-kpi">
                                            <span className="wbm-kpi-val">{memoData.summary.loss_ratio.toFixed(1)}%</span>
                                            <span className="wbm-kpi-label">Loss Ratio</span>
                                        </div>
                                        <div className="wbm-kpi">
                                            <span className={`wbm-kpi-val wbm-risk--${memoData.summary.risk_level}`}>{memoData.summary.risk_level.toUpperCase()}</span>
                                            <span className="wbm-kpi-label">Risk Level</span>
                                        </div>
                                    </div>

                                    <div className="wbm-section">
                                        <h4>Recommendation</h4>
                                        <p className="wbm-highlight">{memoData.recommendation}</p>
                                        <p className="wbm-sub">{memoData.pricing_action}</p>
                                    </div>

                                    <div className="wbm-section">
                                        <h4>Risk Drivers</h4>
                                        <ul className="wbm-list">
                                            {memoData.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                        </ul>
                                    </div>

                                    {memoData.guideline_references.length > 0 && (
                                        <div className="wbm-section">
                                            <h4>Guideline Alignment</h4>
                                            <div className="wbm-guidelines">
                                                {memoData.guideline_references.map((g, i) => (
                                                    <div key={i} className="wbm-guideline">
                                                        <span className="wbm-guideline-code">{g.section}</span>
                                                        <span>{g.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <details className="wbm-full-memo">
                                        <summary>Full Memo Text</summary>
                                        <pre className="wbm-memo-pre">{memoData.memo_text}</pre>
                                    </details>
                                </div>
                            )}

                            {/* ── DECISION MODAL ── */}
                            {modalType === 'decision' && !modalLoading && policy && (
                                <div className="wbm-body">
                                    {decisionRecorded ? (
                                        <div className="wbm-decision-confirmed">
                                            <CheckCircle size={32} />
                                            <h3>Decision Recorded: {decisionRecorded}</h3>
                                            <p>{modalPolicy} - {policy.policyholder_name}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="wbm-kpis">
                                                <div className="wbm-kpi">
                                                    <span className="wbm-kpi-val">{fmt(policy.premium)}</span>
                                                    <span className="wbm-kpi-label">Premium</span>
                                                </div>
                                                <div className="wbm-kpi">
                                                    <span className="wbm-kpi-val">{policy.claim_count}</span>
                                                    <span className="wbm-kpi-label">Claims</span>
                                                </div>
                                                <div className="wbm-kpi">
                                                    <span className="wbm-kpi-val">{fmt(policy.total_claims)}</span>
                                                    <span className="wbm-kpi-label">Total Loss</span>
                                                </div>
                                                <div className="wbm-kpi">
                                                    <span className={`wbm-kpi-val ${lrColor(policy.loss_ratio)}`}>{policy.loss_ratio.toFixed(1)}%</span>
                                                    <span className="wbm-kpi-label">Loss Ratio</span>
                                                </div>
                                            </div>

                                            <div className="wbm-section">
                                                <h4>AI Recommendation</h4>
                                                <p className="wbm-highlight">
                                                    {policy.loss_ratio > 65
                                                        ? `Guideline 5.1.3: Adverse loss ratio (${policy.loss_ratio.toFixed(0)}%). Recommend ${fmt(suggestPremium(policy))} premium (+${((suggestPremium(policy) - policy.premium) / policy.premium * 100).toFixed(0)}%). Refer for senior review.`
                                                        : policy.loss_ratio > 50
                                                            ? `Guideline 5.1.2: Moderate loss ratio (${policy.loss_ratio.toFixed(0)}%). Recommend ${fmt(suggestPremium(policy))} premium with enhanced loss controls.`
                                                            : `Guideline 5.1.1: Favorable loss ratio (${policy.loss_ratio.toFixed(0)}%). Renew at ${fmt(suggestPremium(policy))} — standard terms.`}
                                                    {policy.claim_count >= 5 ? ` Guideline 3.1.1: ${policy.claim_count} claims — 15% surcharge applied.` : ''}
                                                </p>
                                            </div>

                                            <div className="wbm-section">
                                                <h4>Decision Notes</h4>
                                                <textarea
                                                    className="wbm-notes"
                                                    placeholder="Add notes for this decision..."
                                                    value={decisionNotes}
                                                    onChange={(e) => setDecisionNotes(e.target.value)}
                                                    rows={3}
                                                />
                                            </div>

                                            <div className="wbm-decision-btns">
                                                <button className="wbm-dec-btn wbm-dec-btn--accept" onClick={() => handleDecisionAction('accept')}>
                                                    <ThumbsUp size={16} /> Accept
                                                </button>
                                                <button className="wbm-dec-btn wbm-dec-btn--refer" onClick={() => handleDecisionAction('refer')}>
                                                    <ShieldCheck size={16} /> Refer
                                                </button>
                                                <button className="wbm-dec-btn wbm-dec-btn--decline" onClick={() => handleDecisionAction('decline')}>
                                                    <ThumbsDown size={16} /> Decline
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── INTEL MODAL ── */}
                            {modalType === 'intel' && !modalLoading && policy && (
                                <div className="wbm-body">
                                    <div className="wbm-kpis">
                                        <div className="wbm-kpi">
                                            <span className="wbm-kpi-val">{fmt(policy.premium)}</span>
                                            <span className="wbm-kpi-label">Premium</span>
                                        </div>
                                        <div className="wbm-kpi">
                                            <span className="wbm-kpi-val">{policy.claim_count}</span>
                                            <span className="wbm-kpi-label">Claims</span>
                                        </div>
                                        <div className="wbm-kpi">
                                            <span className="wbm-kpi-val">{fmt(policy.total_claims)}</span>
                                            <span className="wbm-kpi-label">Total Loss</span>
                                        </div>
                                        <div className="wbm-kpi">
                                            <span className={`wbm-kpi-val ${lrColor(policy.loss_ratio)}`}>{policy.loss_ratio.toFixed(1)}%</span>
                                            <span className="wbm-kpi-label">Loss Ratio</span>
                                        </div>
                                    </div>

                                    <div className="wbm-section">
                                        <h4>Risk Assessment</h4>
                                        <p className="wbm-highlight">
                                            <span className={`wb-risk-badge wb-risk-badge--${policy.risk_level}`} style={{ marginRight: '0.5rem' }}>{policy.risk_level}</span>
                                            {policy.risk_level === 'high'
                                                ? `High-risk policy with ${policy.claim_count} claims and loss ratio of ${policy.loss_ratio.toFixed(1)}%. Requires immediate review.`
                                                : policy.risk_level === 'medium'
                                                    ? `Moderate risk profile. ${policy.claim_count} claims with ${policy.loss_ratio.toFixed(1)}% loss ratio. Monitor closely.`
                                                    : `Low risk. ${policy.claim_count} claim(s) with favorable ${policy.loss_ratio.toFixed(1)}% loss ratio.`}
                                        </p>
                                    </div>

                                    <div className="wbm-section">
                                        <h4>Policy Details</h4>
                                        <div className="wbm-details-grid">
                                            <div><span className="wbm-detail-label">Industry</span><span>{policy.industry_type}</span></div>
                                            <div><span className="wbm-detail-label">Period</span><span>{policy.effective_date} to {policy.expiration_date}</span></div>
                                            <div><span className="wbm-detail-label">Premium</span><span>{fmt(policy.premium)}</span></div>
                                            <div><span className="wbm-detail-label">Decision</span><span>{(decisionMap[policy.policy_number] || [])[0]?.decision?.toUpperCase() || 'Pending'}</span></div>
                                        </div>
                                    </div>

                                    {/* Evidence Files */}
                                    <div className="wbm-section">
                                        <h4>Evidence & Documentation</h4>
                                        {(() => {
                                            const allEvidence: { claim: string; type: string; url: string; description: string }[] = []
                                            ;(policy.claims || []).forEach((c: Claim) => {
                                                if (c.evidence_files && c.evidence_files !== '[]') {
                                                    try {
                                                        const files = JSON.parse(c.evidence_files)
                                                        if (Array.isArray(files)) {
                                                            files.forEach((f: any) => {
                                                                allEvidence.push({
                                                                    claim: c.claim_number,
                                                                    type: f.type || 'file',
                                                                    url: f.url || f.local_path || '',
                                                                    description: f.description || c.description || 'Evidence file',
                                                                })
                                                            })
                                                        }
                                                    } catch { /* ignore parse errors */ }
                                                }
                                            })

                                            if (allEvidence.length > 0) {
                                                return (
                                                    <div className="wbm-evidence-list">
                                                        {allEvidence.map((ev, i) => (
                                                            <a key={i} href={ev.url} target="_blank" rel="noopener noreferrer" className="wbm-evidence-item">
                                                                <span className="wbm-evidence-type">
                                                                    {ev.type === 'image' ? '🖼' : ev.type === 'pdf' ? '📄' : '📎'}
                                                                </span>
                                                                <div className="wbm-evidence-info">
                                                                    <span className="wbm-evidence-name">{ev.description}</span>
                                                                    <span className="wbm-evidence-claim">{ev.claim}</span>
                                                                </div>
                                                                <ArrowUpRight size={14} className="wbm-evidence-link" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div className="wbm-evidence-empty">
                                                    <XCircle size={16} />
                                                    <span>No evidence files uploaded for {policy.claim_count} claim(s). Upload via Claims &gt; Evidence to complete the record.</span>
                                                </div>
                                            )
                                        })()}
                                    </div>

                                    <div className="wbm-section">
                                        <h4>Key Drivers</h4>
                                        <ul className="wbm-list">
                                            {policy.loss_ratio > 80 && <li>Loss ratio exceeds 80% threshold - decline consideration</li>}
                                            {policy.loss_ratio > 60 && policy.loss_ratio <= 80 && <li>Loss ratio in refer zone (60-80%)</li>}
                                            {policy.claim_count >= 5 && <li>High claims frequency ({policy.claim_count} claims)</li>}
                                            {policy.total_claims >= 100000 && <li>Total incurred exceeds $100K ({fmt(policy.total_claims)})</li>}
                                            {policy.loss_ratio <= 60 && <li>Loss ratio within acceptable bounds ({policy.loss_ratio.toFixed(1)}%)</li>}
                                            {policy.claim_count < 3 && <li>Low claims frequency ({policy.claim_count} claims)</li>}
                                        </ul>
                                    </div>

                                    <div className="wbm-intel-cta">
                                        <button className="wb-action-btn wb-action-btn--accent" onClick={() => { closeModal(); navigate(`/?policy=${modalPolicy}&output=analysis`) }}>
                                            <Sparkles size={13} /> Deep Analyze in RiskMind
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
