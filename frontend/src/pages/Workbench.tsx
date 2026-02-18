import { useState, useEffect, useMemo } from 'react'
import {
    Briefcase, AlertTriangle, CheckCircle, Search, FileText,
    ShieldCheck, Sparkles, XCircle, Clock, TrendingUp,
    RefreshCw, Send, DollarSign, Users, BarChart3,
    ArrowUpRight, ArrowDownRight, Minus, MessageSquare,
    Calendar, MapPin, Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiService, { PolicyItem, DecisionItem } from '../services/api'

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

type WorkbenchTab = 'overview' | 'submissions' | 'renewals' | 'quotes' | 'communications'

export default function Workbench() {
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [decisionMap, setDecisionMap] = useState<Record<string, DecisionItem[]>>({})
    const [activeTab, setActiveTab] = useState<WorkbenchTab>('overview')
    const navigate = useNavigate()

    useEffect(() => {
        loadPolicies()
    }, [])

    const loadPolicies = async () => {
        try {
            const data = await apiService.getPolicies()
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

    // Simulated data for underwriter workflows
    const submissions = useMemo(() => {
        return policies.slice(0, 8).map((p, i) => ({
            id: `SUB-2024-${String(100 + i).padStart(3, '0')}`,
            policy_number: p.policy_number,
            policyholder: p.policyholder_name,
            industry: p.industry_type,
            premium: p.premium,
            status: i < 2 ? 'new' : i < 5 ? 'in_review' : 'quoted',
            priority: p.risk_level === 'high' ? 'urgent' : p.risk_level === 'medium' ? 'normal' : 'low',
            submitted_date: `2024-${String(1 + (i % 12)).padStart(2, '0')}-${String(5 + i * 3).padStart(2, '0')}`,
            ai_score: Math.min(95, 60 + Math.round(p.loss_ratio * 0.3) + (p.claim_count * 2)),
            ai_insight: p.risk_level === 'high'
                ? `High claims frequency (${p.claim_count} claims). Loss ratio ${p.loss_ratio.toFixed(0)}% exceeds guideline threshold.`
                : p.risk_level === 'medium'
                    ? `Moderate risk profile. ${p.claim_count} claims with ${p.loss_ratio.toFixed(0)}% loss ratio. Conditions recommended.`
                    : `Clean risk profile. Low claims history and favorable loss ratio at ${p.loss_ratio.toFixed(0)}%.`,
        }))
    }, [policies])

    const renewals = useMemo(() => {
        return policies.slice(0, 6).map((p, i) => ({
            policy_number: p.policy_number,
            policyholder: p.policyholder_name,
            industry: p.industry_type,
            current_premium: p.premium,
            suggested_premium: p.risk_level === 'high' ? Math.round(p.premium * 1.25) : p.risk_level === 'medium' ? Math.round(p.premium * 1.1) : p.premium,
            premium_change: p.risk_level === 'high' ? '+25%' : p.risk_level === 'medium' ? '+10%' : '0%',
            expiry_date: p.expiration_date || '2025-03-15',
            days_to_expiry: 30 + i * 12,
            risk_level: p.risk_level,
            ai_recommendation: p.risk_level === 'high'
                ? 'Renew with 25% surcharge and additional risk controls. Require updated evidence documentation.'
                : p.risk_level === 'medium'
                    ? 'Renew with 10% premium increase and conditions on safety compliance.'
                    : 'Renew at current terms. Strong risk profile.',
            claim_trend: p.claim_count > 3 ? 'increasing' : p.claim_count > 1 ? 'stable' : 'decreasing',
        }))
    }, [policies])

    const brokerComms = useMemo(() => {
        const messages = [
            { broker: 'Sarah Mitchell (Marsh)', subject: 'COMM-2024-016 Renewal Discussion', status: 'unread', date: '2024-12-15', priority: 'high', ai_draft: 'Based on current loss ratio of 156%, I recommend discussing premium adjustment of 25-30% with enhanced risk controls before renewal.' },
            { broker: 'James Chen (Aon)', subject: 'New Submission - Tech Startup', status: 'replied', date: '2024-12-14', priority: 'normal', ai_draft: 'Tech sector submission shows standard risk profile. Recommended terms: base rate with cyber liability rider.' },
            { broker: 'Maria Santos (Willis)', subject: 'Evidence Request - Property Claim', status: 'unread', date: '2024-12-13', priority: 'urgent', ai_draft: 'Property damage claim requires updated inspection report and contractor estimates before coverage determination.' },
            { broker: 'David Park (USI)', subject: 'Quote Request - Manufacturing', status: 'draft', date: '2024-12-12', priority: 'normal', ai_draft: 'Manufacturing risk assessment complete. Suggested premium of $85,000 based on industry benchmarks and claims history.' },
            { broker: 'Emma Wilson (Gallagher)', subject: 'Portfolio Review Meeting', status: 'read', date: '2024-12-11', priority: 'low', ai_draft: 'Portfolio performance summary prepared. Overall loss ratio improved 8% YoY. 3 accounts flagged for deeper review.' },
        ]
        return messages
    }, [])

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
        { key: 'communications', label: 'Broker Comms', icon: <MessageSquare size={14} />, count: brokerComms.filter(c => c.status === 'unread').length },
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
                <div className="wb-kpi wb-kpi--purple">
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
                                                <button className="wb-action-btn wb-action-btn--accent" onClick={() => navigate(`/?policy=${p.policy_number}&output=analysis`)}>
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
                                    <th>Submission ID</th>
                                    <th>Policy</th>
                                    <th>Policyholder</th>
                                    <th>Industry</th>
                                    <th className="wb-th-r">Quoted Premium</th>
                                    <th className="wb-th-c">Status</th>
                                    <th className="wb-th-c">Priority</th>
                                    <th className="wb-th-c">AI Score</th>
                                    <th>AI Insight</th>
                                    <th className="wb-th-c">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map(sub => (
                                    <tr key={sub.id}>
                                        <td><span className="wb-policy-link">{sub.id}</span></td>
                                        <td><span className="wb-policy-link" onClick={() => navigate(`/?policy=${sub.policy_number}&output=analysis`)}>{sub.policy_number}</span></td>
                                        <td className="wb-td-name">{sub.policyholder}</td>
                                        <td><span className="wb-industry-tag">{sub.industry}</span></td>
                                        <td className="wb-td-r">{fmt(sub.premium)}</td>
                                        <td className="wb-td-c">{statusBadge(sub.status)}</td>
                                        <td className="wb-td-c">{priorityDot(sub.priority)} {sub.priority}</td>
                                        <td className="wb-td-c">
                                            <span className={`wb-ai-score ${sub.ai_score > 80 ? 'wb-ai-score--high' : sub.ai_score > 65 ? 'wb-ai-score--med' : 'wb-ai-score--low'}`}>
                                                {sub.ai_score}
                                            </span>
                                        </td>
                                        <td className="wb-td-insight">{sub.ai_insight}</td>
                                        <td className="wb-td-c">
                                            <button className="wb-action-btn wb-action-btn--accent" onClick={() => navigate(`/?policy=${sub.policy_number}&output=analysis`)}>
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
                                    <button className="wb-action-btn" onClick={() => navigate(`/?policy=${r.policy_number}&output=decision`)}>
                                        <ShieldCheck size={13} /> Decide
                                    </button>
                                    <button className="wb-action-btn" onClick={() => navigate(`/?policy=${r.policy_number}&output=memo`)}>
                                        <FileText size={13} /> Memo
                                    </button>
                                    <button className="wb-action-btn wb-action-btn--accent" onClick={() => navigate(`/?policy=${r.policy_number}&output=analysis`)}>
                                        <Sparkles size={13} /> AI Review
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
                                    const suggestedPremium = p.risk_level === 'high' ? Math.round(p.premium * 1.3) : p.risk_level === 'medium' ? Math.round(p.premium * 1.12) : p.premium
                                    const changePercent = ((suggestedPremium - p.premium) / p.premium * 100).toFixed(0)
                                    return (
                                        <tr key={p.policy_number}>
                                            <td>
                                                <span className="wb-policy-link" onClick={() => navigate(`/?policy=${p.policy_number}&output=decision`)}>{p.policy_number}</span>
                                            </td>
                                            <td className="wb-td-name">{p.policyholder_name}</td>
                                            <td><span className="wb-industry-tag">{p.industry_type}</span></td>
                                            <td className="wb-td-r">{fmt(p.premium)}</td>
                                            <td className="wb-td-r"><strong>{fmt(suggestedPremium)}</strong></td>
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
                                                <button className="wb-action-btn wb-action-btn--accent" onClick={() => navigate(`/?policy=${p.policy_number}&output=decision`)}>
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
                        <div className="wb-ai-insight-icon"><Users size={16} /></div>
                        <div className="wb-ai-insight-text">
                            <strong>AI Communication Assistant</strong>
                            <p>{brokerComms.filter(c => c.status === 'unread').length} unread messages. AI has prepared draft responses based on policy data and underwriting guidelines.</p>
                        </div>
                    </div>

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
                                            {comm.status === 'unread' ? 'Unread' : comm.status === 'replied' ? 'Replied' : comm.status === 'draft' ? 'Draft' : 'Read'}
                                        </span>
                                        <span className="wb-comm-date">{comm.date}</span>
                                    </div>
                                </div>
                                <div className="wb-comm-ai-draft">
                                    <Sparkles size={12} />
                                    <span><strong>AI Draft:</strong> {comm.ai_draft}</span>
                                </div>
                                <div className="wb-comm-actions">
                                    <button className="wb-action-btn">
                                        <Send size={13} /> Reply
                                    </button>
                                    <button className="wb-action-btn wb-action-btn--accent">
                                        <Sparkles size={13} /> Use AI Draft
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
