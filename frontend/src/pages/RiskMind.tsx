import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
    Bot,
    Send,
    Paperclip,
    Loader2,
    MessageSquare,
    BookOpen,
    Sparkles,
    ShieldCheck,
    FileText,
    AlertTriangle,
    CheckCircle,
    ThumbsUp,
    ThumbsDown
} from 'lucide-react'
import apiService, {
    AlertsSummary,
    AlertItem,
    PolicyItem,
    Claim,
    MemoResponse,
    GuidelineCreate
} from '../services/api'
import RiskMap from '../components/RiskMap'

type CanvasMode = 'empty' | 'analysis' | 'evidence' | 'dashboard' | 'card' | 'memo' | 'decision' | 'recommendation' | 'geo_risk'

type Message = {
    id: number
    role: 'user' | 'assistant'
    content: string
    sources?: { section: string; title: string }[]
    timestamp: Date
}

type EvidenceItem = {
    type: string
    url: string
    description?: string
    claim_number: string
    claim_date: string
}

type SavedItem = {
    id: string
    type: 'card' | 'memo' | 'dashboard'
    title: string
    policy_number?: string
    content: string
    created_at: string
}

const suggestedPrompts = [
    { label: 'Summarize portfolio risk for the last 30 days.', mode: 'dashboard' as CanvasMode },
    { label: 'Why is COMM-2024-016 considered high risk?', mode: 'analysis' as CanvasMode },
    { label: 'Show me evidence blend for COMM-2024-016.', mode: 'evidence' as CanvasMode },
    { label: 'Generate a decision recommendation for COMM-2024-016.', mode: 'decision' as CanvasMode },
    { label: 'Create a senior underwriter memo for COMM-2024-016.', mode: 'memo' as CanvasMode },
    { label: 'Give me the top risk insight card.', mode: 'card' as CanvasMode }
]

const policyRegex = /(COMM-\d{4}-\d{3})/i

const inferMode = (text: string): CanvasMode => {
    const lower = text.toLowerCase()
    if (lower.includes('evidence') || lower.includes('video') || lower.includes('photo') || lower.includes('image')) return 'evidence'
    if (lower.includes('dashboard') || lower.includes('portfolio') || lower.includes('summary')) return 'dashboard'
    if (lower.includes('memo')) return 'memo'
    if (lower.includes('decision') || lower.includes('accept') || lower.includes('decline') || lower.includes('refer')) return 'decision'
    if (lower.includes('recommendation')) return 'recommendation'
    if (lower.includes('geo') || lower.includes('map') || lower.includes('location')) return 'geo_risk'
    if (lower.includes('card') || lower.includes('insight') || lower.includes('alert')) return 'card'
    return 'analysis'
}

const saveItem = (item: SavedItem) => {
    const raw = localStorage.getItem('riskmind_saved')
    const list = raw ? (JSON.parse(raw) as SavedItem[]) : []
    list.unshift(item)
    localStorage.setItem('riskmind_saved', JSON.stringify(list.slice(0, 50)))
}

export default function RiskMind() {
    const [searchParams] = useSearchParams()
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [canvasMode, setCanvasMode] = useState<CanvasMode>('empty')
    const [canvasNarrative, setCanvasNarrative] = useState('')
    const [activePolicy, setActivePolicy] = useState<string>('')
    const [alertsSummary, setAlertsSummary] = useState<AlertsSummary | null>(null)
    const [alerts, setAlerts] = useState<AlertItem[]>([])
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [policyClaims, setPolicyClaims] = useState<Claim[]>([])
    const [claimsSummary, setClaimsSummary] = useState<any>(null)
    const [memo, setMemo] = useState<MemoResponse | null>(null)
    const [decisionNote, setDecisionNote] = useState('')
    const [decisionSaved, setDecisionSaved] = useState<string | null>(null)
    const [decisionLoading, setDecisionLoading] = useState(false)
    const [guidelineForm, setGuidelineForm] = useState<GuidelineCreate>({
        section_code: '',
        title: '',
        content: '',
        category: 'general',
        policy_number: '',
        threshold_type: '',
        threshold_value: undefined,
        action: ''
    })
    const [guidelineStatus, setGuidelineStatus] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [analysisObject, setAnalysisObject] = useState<Record<string, any> | null>(null)
    const [recommendedModes, setRecommendedModes] = useState<string[]>([])
    const [defaultMode, setDefaultMode] = useState<string>('analysis')

    useEffect(() => {
        const policyParam = searchParams.get('policy')
        const modeParam = searchParams.get('mode') as CanvasMode | null
        if (policyParam) setActivePolicy(policyParam)
        if (modeParam) setCanvasMode(modeParam)
    }, [searchParams])

    useEffect(() => {
        const fetch = async () => {
            try {
                const [summary, alertList, policyList] = await Promise.all([
                    apiService.getAlertsSummary(),
                    apiService.getAlerts(),
                    apiService.getPolicies()
                ])
                setAlertsSummary(summary)
                setAlerts(alertList)
                setPolicies(policyList)
            } catch {
                // ignore
            }
        }
        fetch()
    }, [])

    useEffect(() => {
        if (!activePolicy) {
            setPolicyClaims([])
            setClaimsSummary(null)
            return
        }

        const fetchPolicy = async () => {
            try {
                const [claims, summary] = await Promise.all([
                    apiService.getClaimsByPolicy(activePolicy).catch(() => []),
                    apiService.getClaimsSummary(activePolicy).catch(() => null)
                ])
                setPolicyClaims(claims)
                setClaimsSummary(summary)
            } catch {
                setPolicyClaims([])
                setClaimsSummary(null)
            }
        }
        fetchPolicy()
    }, [activePolicy])

    useEffect(() => {
        if (activePolicy && !guidelineForm.policy_number) {
            setGuidelineForm(prev => ({ ...prev, policy_number: activePolicy }))
        }
    }, [activePolicy, guidelineForm.policy_number])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const policyInfo = useMemo(() => (
        policies.find(p => p.policy_number === activePolicy) || null
    ), [policies, activePolicy])

    const analysisMetrics = analysisObject?.metrics || {}
    const analysisDimensions = analysisObject?.dimensions || {}
    const analysisEvidence = analysisObject?.evidence || []
    const analysisProvenance = analysisObject?.provenance || analysisObject?.provenance || {}

    const evidenceItems = useMemo(() => {
        const items: EvidenceItem[] = []
        policyClaims.forEach((claim) => {
            if (!claim.evidence_files) return
            try {
                const parsed = JSON.parse(claim.evidence_files) as Array<{ type: string; url: string; description?: string }>
                parsed.forEach((ev) => {
                    if (!ev?.url) return
                    items.push({
                        type: ev.type || 'image',
                        url: ev.url,
                        description: ev.description,
                        claim_number: claim.claim_number,
                        claim_date: claim.claim_date
                    })
                })
            } catch {
                // ignore invalid evidence
            }
        })
        return items
    }, [policyClaims])

    const handleSend = async () => {
        if (!input.trim() || loading) return
        const userMessage = input.trim()
        const policyMatch = userMessage.match(policyRegex)
        if (policyMatch) setActivePolicy(policyMatch[1].toUpperCase())
        const inferredMode = inferMode(userMessage)
        setCanvasMode(inferredMode)
        setCanvasNarrative('RiskMind is processing your request...')
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userMessage, timestamp: new Date() }])
        setInput('')
        setLoading(true)

        try {
            const response = await apiService.chat(userMessage)
            setCanvasNarrative(response.response)
            if (response.analysis_object) {
                setAnalysisObject(response.analysis_object)
            }
            if (response.default_mode) {
                setDefaultMode(response.default_mode)
                setCanvasMode(response.default_mode as CanvasMode)
            }
            if (response.recommended_modes) {
                setRecommendedModes(response.recommended_modes)
            }
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: response.response, sources: response.sources, timestamp: new Date() }])
        } catch {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Connection error. Is the backend running?', timestamp: new Date() }])
            setCanvasNarrative('We could not reach RiskMind services. Please check the backend.')
        } finally {
            setLoading(false)
        }
    }

    const handlePrompt = (prompt: string, mode: CanvasMode) => {
        setInput(prompt)
        setCanvasMode(mode)
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setLoading(true)
        setCanvasMode('evidence')
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: `Uploaded: ${file.name}`, timestamp: new Date() }])
        try {
            const result = await apiService.uploadFile(file, '', 0)
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: result.analysis || 'Upload complete.', timestamp: new Date() }])
            setCanvasNarrative(result.analysis || 'Evidence analyzed and linked to your session.')
        } catch {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Upload failed.', timestamp: new Date() }])
            setCanvasNarrative('Evidence upload failed. Try again or use a different file.')
        } finally {
            setLoading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleMemo = async () => {
        if (!activePolicy) return
        setCanvasMode('memo')
        setCanvasNarrative('Generating memo...')
        try {
            const data = await apiService.getMemo(activePolicy)
            setMemo(data)
            setCanvasNarrative('Memo generated from policy evidence and AI reasoning.')
        } catch {
            setCanvasNarrative('Memo generation failed. Verify the policy number and try again.')
        }
    }

    const handleDecision = async (decision: string) => {
        if (!activePolicy) return
        setDecisionLoading(true)
        try {
            await apiService.recordDecision(activePolicy, decision, decisionNote || undefined, policyInfo?.risk_level)
            setDecisionSaved(decision)
        } catch {
            // ignore
        } finally {
            setDecisionLoading(false)
        }
    }

    const handleGuidelineSubmit = async () => {
        if (!guidelineForm.section_code || !guidelineForm.title || !guidelineForm.content) {
            setGuidelineStatus('Section, title, and content are required.')
            return
        }

        try {
            await apiService.createGuideline(guidelineForm)
            setGuidelineStatus('Guideline saved and indexed.')
            setGuidelineForm({
                section_code: '',
                title: '',
                content: '',
                category: 'general',
                policy_number: activePolicy || '',
                threshold_type: '',
                threshold_value: undefined,
                action: ''
            })
        } catch {
            setGuidelineStatus('Failed to save guideline. Check the backend.')
        }
    }

    const topAlert = alerts[0]
    const claimsCount = analysisMetrics.claim_count ?? policyClaims.length
    const claimsTotal = analysisMetrics.total_amount ?? policyClaims.reduce((sum, c) => sum + (c.claim_amount || 0), 0)

    const saveCard = () => {
        const headline = topAlert?.message || 'Portfolio risk signal'
        saveItem({
            id: `${Date.now()}`,
            type: 'card',
            title: headline,
            policy_number: activePolicy || undefined,
            content: canvasNarrative || 'Saved from RiskMind Copilot',
            created_at: new Date().toISOString()
        })
    }

    const renderProvenance = () => (
        <details className="canvas-details">
            <summary>Provenance</summary>
            <div className="canvas-provenance">
                <div><strong>Tables:</strong> {(analysisObject?.provenance?.tables_used || []).join(', ') || '—'}</div>
                <div><strong>Join paths:</strong> {(analysisObject?.provenance?.join_paths || []).join(' | ') || '—'}</div>
                <div><strong>Query IDs:</strong> {(analysisObject?.provenance?.query_ids || []).join(', ') || '—'}</div>
            </div>
            {(analysisObject?.glass_box?.sql_plan || []).length > 0 && (
                <div className="canvas-provenance">
                    <div><strong>Glass Box SQL</strong></div>
                    {(analysisObject.glass_box.sql_plan as Array<{ id: string; sql: string; params?: Record<string, any> }>).map((item) => (
                        <pre key={item.id}>{item.sql}</pre>
                    ))}
                </div>
            )}
        </details>
    )

    const renderCanvas = () => {
        if (canvasMode === 'empty') {
            return (
                <div className="canvas-empty">
                    <Sparkles className="canvas-empty-icon" />
                    <h3>RiskMind Copilot is ready</h3>
                    <p>Ask a question to generate decision-ready intelligence. Every insight will appear here with context and evidence.</p>
                </div>
            )
        }

        if (canvasMode === 'analysis') {
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Conversational Analysis</h3>
                                <p>Text-first reasoning with contextual metrics.</p>
                            </div>
                            <span className="canvas-pill">Live reasoning</span>
                        </div>
                        <div className="canvas-card-body">
                            <p className="canvas-narrative">{canvasNarrative || 'Ask RiskMind to analyze a policy or portfolio.'}</p>
                            <div className="canvas-metrics">
                                <div>
                                    <span>Policy</span>
                                    <strong>{analysisDimensions.policy_number || activePolicy || 'No policy selected'}</strong>
                                </div>
                                <div>
                                    <span>Claims</span>
                                    <strong>{claimsCount}</strong>
                                </div>
                                <div>
                                    <span>Total Loss</span>
                                    <strong>${claimsTotal.toLocaleString()}</strong>
                                </div>
                            </div>
                            {renderProvenance()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'evidence') {
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Evidence Blend</h3>
                                <p>Structured metrics + unstructured media + AI reasoning.</p>
                            </div>
                            <span className="canvas-pill">Blend mode</span>
                        </div>
                        <div className="canvas-card-body">
                            <div className="canvas-split">
                                <div>
                                    <h4>Structured Signals</h4>
                                    <div className="canvas-list">
                                        <div>
                                            <span>Claims</span>
                                            <strong>{claimsCount}</strong>
                                        </div>
                                        <div>
                                            <span>Total Loss</span>
                                            <strong>${claimsTotal.toLocaleString()}</strong>
                                        </div>
                                        <div>
                                            <span>Risk Level</span>
                                            <strong>{analysisMetrics.loss_ratio ? `${analysisMetrics.loss_ratio}%` : policyInfo?.risk_level || '—'}</strong>
                                        </div>
                                    </div>
                                    {claimsSummary?.glass_box?.sql_query && (
                                        <details className="canvas-details">
                                            <summary>Glass Box Query</summary>
                                            <pre>{claimsSummary.glass_box.sql_query}</pre>
                                        </details>
                                    )}
                                </div>
                                <div>
                                    <h4>Unstructured Evidence</h4>
                                    {(analysisEvidence.length || evidenceItems.length) === 0 ? (
                                        <p className="canvas-muted">No evidence linked yet. Upload media to enrich the claim.</p>
                                    ) : (
                                        <div className="evidence-grid">
                                            {(analysisEvidence.length ? analysisEvidence : evidenceItems).slice(0, 4).map((ev: any, idx: number) => (
                                                <div key={`${ev.url}-${idx}`} className="evidence-item">
                                                    {ev.type === 'video' ? (
                                                        <video src={ev.url} controls />
                                                    ) : (
                                                        ev.type === 'image' ? (
                                                            <img src={ev.url} alt={ev.description || 'Evidence'} />
                                                        ) : (
                                                            <div className="evidence-doc">
                                                                <strong>{ev.title || ev.filename || ev.type}</strong>
                                                                <span>{ev.section || ev.file_path || ev.description || ''}</span>
                                                            </div>
                                                        )
                                                    )}
                                                    <div>
                                                        <strong>{ev.description || ev.title || ev.filename || ev.type}</strong>
                                                        <span>{ev.claim_number || ev.section || ev.file_path || ''}</span>
                                                        {ev.analysis_summary && (
                                                            <span>AI: {ev.analysis_summary}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="canvas-insight">
                                <h4>LLM Reasoning</h4>
                                <p>{canvasNarrative || 'RiskMind will summarize evidence once uploaded.'}</p>
                            </div>
                            {renderProvenance()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'dashboard') {
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Narrative Dashboard</h3>
                                <p>Small, decision-focused and AI-captioned.</p>
                            </div>
                            <span className="canvas-pill">Auto dashboard</span>
                        </div>
                        <div className="canvas-card-body">
                            <p className="canvas-narrative">{canvasNarrative || 'Portfolio overview generated from live data.'}</p>
                            <div className="canvas-metrics">
                                <div>
                                    <span>Policies</span>
                                    <strong>{analysisMetrics.policy_count ?? policies.length}</strong>
                                </div>
                                <div>
                                    <span>Critical Alerts</span>
                                    <strong>{alertsSummary?.critical ?? 0}</strong>
                                </div>
                                <div>
                                    <span>Warning Alerts</span>
                                    <strong>{alertsSummary?.warning ?? 0}</strong>
                                </div>
                            </div>
                            {topAlert && (
                                <div className="canvas-highlight">
                                    <AlertTriangle />
                                    <div>
                                        <strong>{topAlert.message}</strong>
                                        <span>{topAlert.policy_number} · {topAlert.policyholder}</span>
                                    </div>
                                </div>
                            )}
                            {renderProvenance()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'card') {
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Hyperintelligence Card</h3>
                                <p>Actionable insight with confidence and evidence.</p>
                            </div>
                            <button className="btn btn-secondary" onClick={saveCard}>Save Card</button>
                        </div>
                        <div className="canvas-card-body">
                            <div className="canvas-card-insight">
                                <strong>{topAlert?.message || 'Portfolio risk signal detected'}</strong>
                                <span>Confidence: {topAlert?.severity === 'critical' ? '0.92' : '0.78'}</span>
                            </div>
                            <div className="canvas-list">
                                <div>
                                    <span>Key Driver</span>
                                    <strong>{topAlert?.guideline_ref || 'Loss ratio pressure'}</strong>
                                </div>
                                <div>
                                    <span>Evidence</span>
                                    <strong>{analysisDimensions.policy_number || activePolicy || topAlert?.policy_number || 'Portfolio signal'}</strong>
                                </div>
                                <div>
                                    <span>Recommended Action</span>
                                    <strong>Escalate for review and verify evidence pack.</strong>
                                </div>
                            </div>
                            {renderProvenance()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'memo') {
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Memo / Narrative</h3>
                                <p>Professional underwriting summary with evidence.</p>
                            </div>
                            <button className="btn btn-secondary" onClick={handleMemo}>
                                Generate Memo
                            </button>
                        </div>
                        <div className="canvas-card-body">
                            <p className="canvas-narrative">{canvasNarrative || 'Generate a memo to document underwriting rationale.'}</p>
                            {memo && (
                                <div className="canvas-memo">
                                    <h4>{memo.policy_number} — {memo.policyholder}</h4>
                                    <p>{memo.memo_text}</p>
                                </div>
                            )}
                            {renderProvenance()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'decision') {
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Decision Mode</h3>
                                <p>Finalize underwriting actions with evidence snapshot.</p>
                            </div>
                            <span className="canvas-pill">Decision</span>
                        </div>
                        <div className="canvas-card-body">
                            <div className="canvas-metrics">
                                <div>
                                    <span>Policy</span>
                                    <strong>{analysisDimensions.policy_number || activePolicy || 'Select a policy'}</strong>
                                </div>
                                <div>
                                    <span>Claims</span>
                                    <strong>{claimsCount}</strong>
                                </div>
                                <div>
                                    <span>Loss Total</span>
                                    <strong>${claimsTotal.toLocaleString()}</strong>
                                </div>
                            </div>
                            <input
                                className="input-field"
                                placeholder="Optional decision notes"
                                value={decisionNote}
                                onChange={(e) => setDecisionNote(e.target.value)}
                            />
                            <div className="decision-actions">
                                <button className="btn btn-primary" disabled={decisionLoading} onClick={() => handleDecision('accept')}>
                                    <ThumbsUp /> Accept
                                </button>
                                <button className="btn btn-secondary" disabled={decisionLoading} onClick={() => handleDecision('refer')}>
                                    <ShieldCheck /> Refer
                                </button>
                                <button className="btn btn-secondary" disabled={decisionLoading} onClick={() => handleDecision('decline')}>
                                    <ThumbsDown /> Decline
                                </button>
                            </div>
                            {decisionSaved && (
                                <div className="canvas-highlight success">
                                    <CheckCircle /> Decision recorded: {decisionSaved.toUpperCase()}
                                </div>
                            )}
                            {renderProvenance()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'recommendation') {
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Recommendation</h3>
                                <p>Decision-ready guidance based on the analysis object.</p>
                            </div>
                            <span className="canvas-pill">AI recommendation</span>
                        </div>
                        <div className="canvas-card-body">
                            <p className="canvas-narrative">{canvasNarrative || 'RiskMind will provide a recommendation from available evidence.'}</p>
                            <div className="canvas-metrics">
                                <div>
                                    <span>Policy</span>
                                    <strong>{analysisDimensions.policy_number || activePolicy || '—'}</strong>
                                </div>
                                <div>
                                    <span>Claims</span>
                                    <strong>{claimsCount}</strong>
                                </div>
                                <div>
                                    <span>Loss Ratio</span>
                                    <strong>{analysisMetrics.loss_ratio ?? '—'}</strong>
                                </div>
                            </div>
                            {renderProvenance()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'geo_risk') {
            const geoPolicies = analysisDimensions.geo_policies || []
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Geo Risk Mode</h3>
                                <p>Geospatial exposure based on portfolio coordinates.</p>
                            </div>
                            <span className="canvas-pill">Geo risk</span>
                        </div>
                        <div className="canvas-card-body">
                            <div className="canvas-narrative">
                                {canvasNarrative || 'Geo risk visualization is ready.'}
                            </div>
                            <div className="geo-panel">
                                <RiskMap policies={geoPolicies} />
                            </div>
                            {renderProvenance()}
                        </div>
                    </div>
                </div>
            )
        }

        return null
    }

    const modeLabels: Record<string, CanvasMode> = {
        insight_card: 'card',
        memo: 'memo',
        dashboard: 'dashboard',
        recommendation: 'recommendation',
        decision_draft: 'decision',
        evidence_blend: 'evidence',
        geo_risk: 'geo_risk',
    }

    return (
        <div className="riskmind-shell">
            <section className="panel">
                <div className="panel-header">
                    <div className="panel-title">
                        <Bot /> RiskMind Copilot
                    </div>
                    <span className="panel-subtitle">Conversation-driven underwriting intelligence</span>
                </div>
                <div className="panel-body">
                    <div className="context-strip">
                        <span>Active policy:</span>
                        <strong>{activePolicy || 'None selected'}</strong>
                        {activePolicy && (
                            <Link to={`/workbench`} className="context-link">
                                View in Workbench
                            </Link>
                        )}
                    </div>

                    <div className="prompt-list">
                        {suggestedPrompts.map((prompt) => (
                            <button key={prompt.label} onClick={() => handlePrompt(prompt.label, prompt.mode)} className="intent-chip">
                                {prompt.label}
                            </button>
                        ))}
                    </div>

                    <div className="upload-strip">
                        <label className="upload-label">
                            <Paperclip /> Upload evidence (video, image, PDF)
                            <input ref={fileInputRef} type="file" onChange={handleUpload} />
                        </label>
                    </div>

                    <details className="guideline-panel">
                        <summary>Add Policy Guideline</summary>
                        <div className="guideline-form">
                            <input
                                className="input-field"
                                placeholder="Section code (e.g., 8.1.1)"
                                value={guidelineForm.section_code}
                                onChange={(e) => setGuidelineForm(prev => ({ ...prev, section_code: e.target.value }))}
                            />
                            <input
                                className="input-field"
                                placeholder="Guideline title"
                                value={guidelineForm.title}
                                onChange={(e) => setGuidelineForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                            <input
                                className="input-field"
                                placeholder="Policy number (optional)"
                                value={guidelineForm.policy_number || ''}
                                onChange={(e) => setGuidelineForm(prev => ({ ...prev, policy_number: e.target.value }))}
                            />
                            <textarea
                                className="input-field"
                                placeholder="Guideline content"
                                rows={4}
                                value={guidelineForm.content}
                                onChange={(e) => setGuidelineForm(prev => ({ ...prev, content: e.target.value }))}
                            />
                            <div className="guideline-grid">
                                <input
                                    className="input-field"
                                    placeholder="Category"
                                    value={guidelineForm.category || ''}
                                    onChange={(e) => setGuidelineForm(prev => ({ ...prev, category: e.target.value }))}
                                />
                                <input
                                    className="input-field"
                                    placeholder="Threshold type"
                                    value={guidelineForm.threshold_type || ''}
                                    onChange={(e) => setGuidelineForm(prev => ({ ...prev, threshold_type: e.target.value }))}
                                />
                                <input
                                    className="input-field"
                                    placeholder="Threshold value"
                                    type="number"
                                    value={guidelineForm.threshold_value ?? ''}
                                    onChange={(e) => setGuidelineForm(prev => ({ ...prev, threshold_value: e.target.value ? Number(e.target.value) : undefined }))}
                                />
                                <input
                                    className="input-field"
                                    placeholder="Action"
                                    value={guidelineForm.action || ''}
                                    onChange={(e) => setGuidelineForm(prev => ({ ...prev, action: e.target.value }))}
                                />
                            </div>
                            <button className="btn btn-primary" onClick={handleGuidelineSubmit}>
                                Save Guideline
                            </button>
                            {guidelineStatus && (
                                <p className="guideline-status">{guidelineStatus}</p>
                            )}
                        </div>
                    </details>

                    <div className="conversation">
                        {messages.length === 0 && (
                            <div className="conversation-empty">
                                <MessageSquare />
                                <p>Start a conversation to generate intelligence and decisions.</p>
                            </div>
                        )}
                        {messages.map((m) => (
                            <div key={m.id} className={`conversation-bubble ${m.role}`}>
                                <p>{m.content}</p>
                                {m.sources && m.sources.length > 0 && (
                                    <div className="bubble-sources">
                                        <BookOpen />
                                        <span>{m.sources.map(s => s.section).join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {recommendedModes.length > 0 && (
                        <div className="convert-strip">
                            <span>Convert to:</span>
                            {recommendedModes.map((mode) => (
                                <button
                                    key={mode}
                                    className="intent-chip"
                                    onClick={() => setCanvasMode(modeLabels[mode] || defaultMode as CanvasMode)}
                                >
                                    {mode.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="panel-footer">
                    <input
                        className="input-field"
                        placeholder="Ask RiskMind to explain risk, show evidence, or draft a memo..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
                        {loading ? <Loader2 className="spin" /> : <Send />}
                        Send
                    </button>
                </div>
            </section>

            <section className="panel canvas">
                <div className="panel-header">
                    <div className="panel-title">
                        <Sparkles /> Intelligence Canvas
                    </div>
                    <span className="panel-subtitle">Mode: {canvasMode.toUpperCase()}</span>
                </div>
                <div className="panel-body">
                    {renderCanvas()}
                </div>
            </section>
        </div>
    )
}
