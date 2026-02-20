import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
    Bot,
    Send,
    Paperclip,
    Loader2,
    MessageSquare,
    BookOpen,
    Sparkles,
    ShieldCheck,
    CheckCircle,
    ThumbsUp,
    ThumbsDown,
    Download,
    MapPin,
    History,
    Plus,
    Trash2,
    Zap,
} from 'lucide-react'
import RiskMap from '../components/RiskMap'
import { exportElementAsPdf } from '../utils/exportPdf'
import apiService, {
    AlertItem,
    PolicyItem,
    Claim,
    MemoResponse,
    ChatSession,
} from '../services/api'

type CanvasMode = 'empty' | 'analysis' | 'memo' | 'decision' | 'geo_map'

type Message = {
    id: number
    role: 'user' | 'assistant'
    content: string
    sources?: { section: string; title: string }[]
    suggestedPrompts?: string[]
    suggestedIntents?: {
        label: string
        intent: string
        output_type: string
        example: string
        keywords: string[]
    }[]
    suggestCanvasView?: boolean
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
    type: 'summary' | 'memo' | 'decision' | 'narrative' | 'geo_map'
    title: string
    output_type: CanvasMode
    inferred_intent: string
    context: {
        policy_number?: string
        claim_number?: string
        submission_id?: string
    }
    artifact: Record<string, any>
    content?: string
    provenance: Record<string, any> | null
    created_at: string
}

const CHAT_STATE_KEY = 'riskmind_chat_state'

const saveChatState = (state: Record<string, any>) => {
    try {
        sessionStorage.setItem(CHAT_STATE_KEY, JSON.stringify(state))
    } catch { /* quota exceeded, ignore */ }
}

const loadChatState = (): Record<string, any> | null => {
    try {
        const raw = sessionStorage.getItem(CHAT_STATE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        // Restore Date objects in messages
        if (parsed.messages) {
            parsed.messages = parsed.messages.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp),
            }))
        }
        return parsed
    } catch { return null }
}

const suggestedPromptGroups = [
    {
        title: 'Understand',
        prompts: [
            { label: 'Summarize portfolio risk for the last 30 days.' },
            { label: 'Why is COMM-2024-016 considered high risk?' },
        ],
    },
    {
        title: 'Analyze',
        prompts: [
            { label: 'Show claim severity trend by month for COMM-2024-016.' },
        ],
    },
    {
        title: 'Decide',
        prompts: [
            { label: 'Should we renew COMM-2024-016? Give me a decision-ready card.' },
        ],
    },
    {
        title: 'Document',
        prompts: [
            { label: 'Draft an underwriting memo for COMM-2024-016 with guideline alignment.' },
        ],
    },
    {
        title: 'Explore',
        prompts: [
            { label: 'Open the self-service analytics playground to slice and dice my data.' },
        ],
    },
]

const policyRegex = /(COMM-\d{4}-\d{3}|P-\d{4})/i
const claimRegex = /(CLM-\d{4}-\d{3})/i

const inferOutputType = (text: string): CanvasMode => {
    const lower = text.toLowerCase()
    if (['map', 'geo', 'geography', 'spatial', 'geospatial', 'region'].some(kw => lower.includes(kw))) return 'geo_map'
    if (lower.includes('memo') || lower.includes('draft') || lower.includes('document')) return 'memo'
    if (lower.includes('decision') || lower.includes('renew') || lower.includes('accept') || lower.includes('decline') || lower.includes('refer')) return 'decision'
    return 'analysis'
}

const mapOutputType = (type: string): CanvasMode => {
    if (type === 'geo_map') return 'geo_map'
    if (type === 'memo') return 'memo'
    if (type === 'decision') return 'decision'
    return 'analysis'
}

const saveItem = (item: SavedItem) => {
    const raw = localStorage.getItem('riskmind_saved')
    const list = raw ? (JSON.parse(raw) as SavedItem[]) : []
    list.unshift(item)
    localStorage.setItem('riskmind_saved', JSON.stringify(list.slice(0, 50)))
}

export default function RiskMind() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const _restored = loadChatState()
    const [messages, setMessages] = useState<Message[]>(_restored?.messages || [])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<{ state: 'uploading' | 'success' | 'error'; message: string } | null>(null)
    const [pendingPolicy, setPendingPolicy] = useState<string | null>(null)
    const [canvasMode, setCanvasMode] = useState<CanvasMode>(_restored?.canvasMode || 'empty')
    const [showCanvasSummary, setShowCanvasSummary] = useState(_restored?.showCanvasSummary ?? true)
    const [focusExpanded, setFocusExpanded] = useState(true)
    const [canvasNarrative, setCanvasNarrative] = useState(_restored?.canvasNarrative || '')
    const [activePolicy, setActivePolicy] = useState<string>(_restored?.activePolicy || '')
    const [activeClaim, setActiveClaim] = useState<string>(_restored?.activeClaim || '')
    const [activeSubmission, setActiveSubmission] = useState<string>(_restored?.activeSubmission || '')
    const [alerts, setAlerts] = useState<AlertItem[]>([])
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [policyClaims, setPolicyClaims] = useState<Claim[]>([])
    const [memo, setMemo] = useState<MemoResponse | null>(_restored?.memo || null)
    const [decisionNote, setDecisionNote] = useState('')
    const [decisionSaved, setDecisionSaved] = useState<string | null>(null)
    const [decisionLoading, setDecisionLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Custom link renderer: internal paths use client-side navigation
    const mdComponents = {
        a: ({ href, children, ...props }: any) => {
            if (href && href.startsWith('/')) {
                return <a href={href} onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate(href) }} {...props}>{children}</a>
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
        },
    }
    const [analysisObject, setAnalysisObject] = useState<Record<string, any> | null>(_restored?.analysisObject || null)
    const [inferredIntent, setInferredIntent] = useState<string>(_restored?.inferredIntent || '')
    const [inferredOutputType, setInferredOutputType] = useState<CanvasMode>(_restored?.inferredOutputType || 'analysis')
    const [provenance, setProvenance] = useState<Record<string, any> | null>(_restored?.provenance || null)
    const [intentConfidence, setIntentConfidence] = useState<number | null>(_restored?.intentConfidence ?? null)
    const [intentReasonCodes, setIntentReasonCodes] = useState<string[]>(_restored?.intentReasonCodes || [])
    const [showHistory, setShowHistory] = useState(false)
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<number | null>(_restored?.activeSessionId ?? null)
    const [historyLoading, setHistoryLoading] = useState(false)
    const historyRef = useRef<HTMLDivElement>(null)

    // Persist chat state to sessionStorage on changes
    useEffect(() => {
        saveChatState({
            messages,
            canvasMode,
            canvasNarrative,
            activePolicy,
            activeClaim,
            activeSubmission,
            analysisObject,
            inferredIntent,
            inferredOutputType,
            provenance,
            intentConfidence,
            intentReasonCodes,
            activeSessionId,
            showCanvasSummary,
            memo,
        })
    }, [messages, canvasMode, canvasNarrative, activePolicy, activeClaim, activeSubmission,
        analysisObject, inferredIntent, inferredOutputType, provenance, intentConfidence,
        intentReasonCodes, activeSessionId, showCanvasSummary, memo])

    useEffect(() => {
        const policyParam = searchParams.get('policy')
        const claimParam = searchParams.get('claim')
        const outputParam = searchParams.get('output') as CanvasMode | null
        if (policyParam) setActivePolicy(policyParam)
        if (claimParam) setActiveClaim(claimParam)
        if (outputParam && ['analysis', 'memo', 'decision'].includes(outputParam)) {
            setCanvasMode(outputParam)
        }
    }, [searchParams])

    useEffect(() => {
        const init = async () => {
            try {
                const [alertList, policyList] = await Promise.all([
                    apiService.getAlerts(),
                    apiService.getPolicies()
                ])
                setAlerts(alertList)
                setPolicies(policyList)
            } catch {
                // ignore
            }
        }
        init()
    }, [])

    useEffect(() => {
        if (!activePolicy) {
            setPolicyClaims([])
            return
        }
        const fetchPolicy = async () => {
            try {
                const claims = await apiService.getClaimsByPolicy(activePolicy).catch(() => [])
                setPolicyClaims(claims)
            } catch {
                setPolicyClaims([])
            }
        }
        fetchPolicy()
    }, [activePolicy])

    // Close history dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
                setShowHistory(false)
            }
        }
        if (showHistory) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showHistory])

    const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('riskmind_user') || '{}') } catch { return {} }
    })()

    const fetchChatHistory = async () => {
        setHistoryLoading(true)
        try {
            const sessions = await apiService.getChatSessions(currentUser.email || 'demo@apexuw.com')
            setChatSessions(sessions)
        } catch { /* ignore */ }
        setHistoryLoading(false)
    }

    const toggleHistory = () => {
        if (!showHistory) fetchChatHistory()
        setShowHistory(prev => !prev)
    }

    const loadSession = async (session: ChatSession) => {
        try {
            const msgs = await apiService.getSessionMessages(session.id)
            setMessages(msgs.map((m, i) => ({
                id: i,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: new Date(m.created_at),
            })))
            setActiveSessionId(session.id)
            setShowHistory(false)
            setCanvasMode('empty')
            setCanvasNarrative('')
            setAnalysisObject(null)
            setProvenance(null)
        } catch { /* ignore */ }
    }

    const startNewChat = () => {
        setMessages([])
        setActiveSessionId(null)
        setCanvasMode('empty')
        setCanvasNarrative('')
        setAnalysisObject(null)
        setProvenance(null)
        setInferredIntent('')
        setInferredOutputType('analysis')
        setIntentConfidence(null)
        setIntentReasonCodes([])
        setActivePolicy('')
        setActiveClaim('')
        setActiveSubmission('')
        setMemo(null)
        setShowHistory(false)
        sessionStorage.removeItem(CHAT_STATE_KEY)
    }

    const deleteSession = async (e: React.MouseEvent, sessionId: number) => {
        e.stopPropagation()
        try {
            await apiService.deleteSession(sessionId)
            setChatSessions(prev => prev.filter(s => s.id !== sessionId))
            if (activeSessionId === sessionId) startNewChat()
        } catch { /* ignore */ }
    }


    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        setFocusExpanded(true)
    }, [canvasMode])

    const policyInfo = useMemo(() => (
        policies.find(p => p.policy_number === activePolicy) || null
    ), [policies, activePolicy])

    const analysisMetrics = analysisObject?.metrics || {}
    const analysisDimensions = analysisObject?.dimensions || {}
    const analysisEvidence = analysisObject?.evidence || []

    const normalizeIntent = (intent: string) => {
        if (!intent) return ''
        const map: Record<string, string> = {
            policy_risk_summary: 'Understand',
            claim_summary: 'Understand',
            portfolio_summary: 'Understand',
            ad_hoc_query: 'Analyze',
        }
        return map[intent] || intent
    }
    const resolvedIntent = normalizeIntent(inferredIntent || analysisObject?.context?.intent || '')
    const outputLabels: Record<CanvasMode, string> = {
        empty: 'Summary',
        analysis: 'Summary',
        memo: 'Underwriter Memo',
        decision: 'Decision Recommendation',
        geo_map: 'Geospatial Intelligence',
    }
    const outputLabel = outputLabels[canvasMode] || 'Summary'

    const pendingPolicyName = useMemo(() => {
        if (!pendingPolicy) return null
        return policies.find(p => p.policy_number === pendingPolicy)?.policyholder_name || null
    }, [pendingPolicy, policies])

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

    const topAlert = alerts[0]

    const lastAssistantMessage = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i].role === 'assistant') return messages[i].content
        }
        return ''
    }, [messages])

    const focusInsight = (() => {
        const raw = lastAssistantMessage || canvasNarrative || topAlert?.message || ''
        if (!raw) return 'Ask RiskMind to generate a focused insight.'
        const cleaned = raw
            .split('\n')
            .filter((line: string) => !line.includes('\u{1F4CA}') && !line.includes('Intelligent Canvas'))
            .join('\n')
            .trim()
        const firstPara = cleaned.split(/\n{2,}/)[0].trim()
        const excerpt = firstPara.length > 280 ? firstPara.slice(0, 280).trimEnd() + '\u2026' : firstPara
        return excerpt || 'Ask RiskMind to generate a focused insight.'
    })()

    const formatCurrency = (value?: number | null) => {
        if (value === null || value === undefined) return 'Not available'
        return `$${Number(value).toLocaleString()}`
    }

    const handleSend = async () => {
        if (!input.trim() || loading) return
        const userMessage = input.trim()

        const policyMatch = userMessage.match(policyRegex)
        const claimMatch = userMessage.match(claimRegex)
        if (policyMatch) setActivePolicy(policyMatch[1].toUpperCase())
        if (claimMatch) setActiveClaim(claimMatch[1].toUpperCase())

        const inferredType = inferOutputType(userMessage)
        setCanvasMode(inferredType)
        setInferredOutputType(inferredType)
        setCanvasNarrative('RiskMind is processing your request...')
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userMessage, timestamp: new Date() }])
        setInput('')
        setLoading(true)

        try {
            const response = await apiService.chat(userMessage)
            setCanvasNarrative(response.response)
            const artifactData = response.artifact?.data || response.analysis_object
            if (artifactData) setAnalysisObject(artifactData)

            const responseOutput = mapOutputType(response.output_type || inferredType)
            const responseIntent = response.inferred_intent || response.analysis_object?.context?.intent || ''
            setInferredIntent(responseIntent)

            const confidence = response.provenance?.confidence ?? null
            const reasonCodes = response.provenance?.confidence_reason_codes || []
            setIntentConfidence(confidence)
            setIntentReasonCodes(reasonCodes)
            setProvenance(response.provenance || artifactData?.provenance || null)
            setInferredOutputType(responseOutput)

            const shouldShowSummary = response.show_canvas_summary !== false
            setShowCanvasSummary(shouldShowSummary)

            if (response.analysis_object?.context?.policy_number) {
                setActivePolicy(response.analysis_object.context.policy_number)
            }
            if (response.analysis_object?.context?.claim_number) {
                setActiveClaim(response.analysis_object.context.claim_number)
            }
            if (response.analysis_object?.context?.submission_id) {
                setActiveSubmission(response.analysis_object.context.submission_id)
            }

            setCanvasMode(responseOutput)

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: response.response,
                sources: response.sources,
                suggestedPrompts: response.suggested_prompts || [],
                suggestedIntents: response.suggested_intents || [],
                suggestCanvasView: response.suggest_canvas_view || false,
                timestamp: new Date()
            }])
        } catch {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Connection error. Is the backend running?', timestamp: new Date() }])
            setCanvasNarrative('We could not reach RiskMind services. Please check the backend.')
        } finally {
            setLoading(false)
        }
    }

    const handlePrompt = (prompt: string) => {
        setInput(prompt)
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        setUploadStatus({ state: 'uploading', message: `Uploading ${file.name}...` })
        setCanvasMode('analysis')
        setInferredOutputType('analysis')
        setInferredIntent(inferredIntent || 'Understand')
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: `Uploaded: ${file.name}`, timestamp: new Date() }])
        try {
            const result = await apiService.uploadFile(file, '', 0)
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: result.analysis || 'Upload complete.', timestamp: new Date() }])
            setCanvasNarrative(result.analysis || 'Evidence analyzed and linked to your session.')
            setUploadStatus({ state: 'success', message: `Uploaded ${file.name}` })
            const analysisText = result.analysis || ''
            const match = analysisText.match(policyRegex) || file.name.match(policyRegex)
            if (match?.[1]) {
                setPendingPolicy(match[1].toUpperCase())
            } else {
                setPendingPolicy(null)
            }
        } catch {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Upload failed.', timestamp: new Date() }])
            setCanvasNarrative('Evidence upload failed. Try again or use a different file.')
            setUploadStatus({ state: 'error', message: `Upload failed: ${file.name}` })
            setPendingPolicy(null)
        } finally {
            setUploading(false)
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

    const claimsCount = analysisMetrics.claim_count ?? policyClaims.length
    const claimsTotal = analysisMetrics.total_amount ?? policyClaims.reduce((sum, c) => sum + (c.claim_amount || 0), 0)

    const currentContext = {
        policy_number: analysisDimensions.policy_number || activePolicy || undefined,
        claim_number: analysisDimensions.claim_number || activeClaim || undefined,
        submission_id: activeSubmission || undefined,
    }

    const saveArtifact = (type: SavedItem['type'], title: string, artifact: Record<string, any>) => {
        saveItem({
            id: `${Date.now()}`,
            type,
            title,
            output_type: canvasMode,
            inferred_intent: resolvedIntent || 'Understand',
            context: currentContext,
            artifact,
            content: artifact.content || canvasNarrative || undefined,
            provenance: provenance || analysisObject?.provenance || null,
            created_at: new Date().toISOString(),
        })
    }

    const renderEvidencePanel = () => {
        const tables = provenance?.tables_used || analysisObject?.provenance?.tables_used || []
        const citations = provenance?.citations || []
        const confidence = provenance?.confidence
        const reasonCodes = provenance?.confidence_reason_codes || intentReasonCodes
        const evidenceList = (analysisEvidence.length ? analysisEvidence : evidenceItems).slice(0, 6)

        const confLabel = confidence !== undefined && confidence !== null
            ? confidence >= 80 ? 'High' : confidence >= 60 ? 'Good' : confidence >= 50 ? 'Fair' : 'Low'
            : null
        const confColor = confidence !== undefined && confidence !== null
            ? confidence >= 80 ? '#34d399' : confidence >= 60 ? '#60a5fa' : confidence >= 50 ? '#fbbf24' : '#ff6b6b'
            : '#94a3b8'

        return (
            <div className="gb-panel">
                <div className="gb-header">
                    <div className="gb-title">
                        <span className="gb-icon">&#x1f50d;</span>
                        Glass Box &mdash; Evidence &amp; Provenance
                    </div>
                    {confLabel && (
                        <div className="gb-confidence" style={{ borderColor: confColor, color: confColor }}>
                            <span className="gb-conf-dot" style={{ background: confColor }}></span>
                            {confidence}% &mdash; {confLabel} Confidence
                        </div>
                    )}
                </div>

                {/* Reason codes */}
                {reasonCodes.length > 0 && (
                    <div className="gb-tags">
                        {reasonCodes.map((rc: string, i: number) => (
                            <span key={i} className="gb-tag">{rc.replace(/_/g, ' ')}</span>
                        ))}
                    </div>
                )}

                <div className="gb-grid">
                    {/* Data Lineage */}
                    <div className="gb-card">
                        <h5 className="gb-card-title">Data Lineage</h5>
                        {tables.length > 0 ? (
                            <div className="gb-table-tags">
                                {tables.map((t: string, i: number) => (
                                    <span key={i} className="gb-table-tag">{t}</span>
                                ))}
                            </div>
                        ) : (
                            <p className="gb-empty">No tables referenced</p>
                        )}
                    </div>

                    {/* Citations */}
                    <div className="gb-card">
                        <h5 className="gb-card-title">Guideline Citations</h5>
                        {citations.length === 0 ? (
                            <p className="gb-empty">No citations available</p>
                        ) : (
                            <div className="gb-citations">
                                {citations.slice(0, 6).map((cite: any, idx: number) => (
                                    <div key={idx} className="gb-cite">
                                        <span className="gb-cite-badge">{cite.ref || cite.type || 'REF'}</span>
                                        <span className="gb-cite-title">{cite.title}</span>
                                        {cite.snippet && <span className="gb-cite-snippet">{cite.snippet}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Evidence Items */}
                    <div className="gb-card">
                        <h5 className="gb-card-title">Evidence Items</h5>
                        {evidenceList.length === 0 ? (
                            <p className="gb-empty">No evidence attached</p>
                        ) : (
                            <div className="gb-evidence-list">
                                {evidenceList.map((ev: any, idx: number) => (
                                    <div key={idx} className="gb-ev">
                                        <span className="gb-ev-type">{ev.type || 'doc'}</span>
                                        <div className="gb-ev-info">
                                            <strong>{ev.description || ev.title || ev.filename || 'Evidence'}</strong>
                                            {(ev.claim_number || ev.section) && (
                                                <span>{ev.claim_number || ev.section}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const renderCanvas = () => {
        if (canvasMode === 'empty') {
            return (
                <div className="canvas-welcome">
                    <div className="welcome-hero">
                        <Sparkles className="welcome-icon" />
                        <h3>Welcome to RiskMind</h3>
                        <p>Your AI-powered underwriting co-pilot. Ask a question or pick a prompt below.</p>
                    </div>
                    <div className="quick-prompts">
                        {suggestedPromptGroups.map(group => (
                            <div key={group.title} className="quick-prompt-group">
                                <h4>{group.title}</h4>
                                {group.prompts.map(prompt => (
                                    <button
                                        key={prompt.label}
                                        className="quick-prompt-btn"
                                        onClick={() => handlePrompt(prompt.label)}
                                    >
                                        {prompt.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        if (canvasMode === 'analysis') {
            if (!showCanvasSummary) {
                return (
                    <div className="canvas-stack">
                        <div className="canvas-card" id="canvas-narrative">
                            <div className="canvas-card-header">
                                <div>
                                    <h3>Conversation</h3>
                                    <p>Natural language analysis</p>
                                </div>
                                <div className="dashboard-actions">
                                    <button className="btn btn-secondary" onClick={() => saveArtifact('narrative', 'Conversation Insight', { content: canvasNarrative })}>
                                        Save
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => {
                                        const el = document.getElementById('canvas-narrative')
                                        if (el) exportElementAsPdf(el, `riskmind-insight-${Date.now()}.pdf`)
                                    }}>
                                        <Download className="inline h-3 w-3 mr-1" /> PDF
                                    </button>
                                </div>
                            </div>
                            <div className="canvas-card-body">
                                <div className="conversation-view">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {canvasNarrative || 'RiskMind is analyzing your request...'}
                                    </ReactMarkdown>
                                </div>
                                {(analysisEvidence.length > 0 || provenance) && renderEvidencePanel()}
                            </div>
                        </div>
                    </div>
                )
            }

            const isPolicyMode = !!(analysisDimensions.policy_number || activePolicy)
            const isPortfolioMode = !isPolicyMode && !!(analysisMetrics.policy_count || analysisMetrics.total_premium)
            const hasKpiData = isPolicyMode
                ? (claimsCount > 0 || claimsTotal > 0 || !!analysisMetrics.loss_ratio)
                : isPortfolioMode

            if (!hasKpiData) {
                return (
                    <div className="canvas-stack">
                        <div className="canvas-card">
                            <div className="canvas-card-header">
                                <div><h3>Analysis</h3><p>Natural language insight</p></div>
                            </div>
                            <div className="canvas-card-body">
                                <div className="conversation-view">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {canvasNarrative || 'RiskMind is analyzing your request...'}
                                    </ReactMarkdown>
                                </div>
                                {(analysisEvidence.length > 0 || provenance) && renderEvidencePanel()}
                            </div>
                        </div>
                    </div>
                )
            }

            const summaryBullets = [
                analysisMetrics.policy_count ? `Portfolio includes ${analysisMetrics.policy_count} active policies.` : null,
                analysisMetrics.total_premium ? `Total written premium: ${formatCurrency(analysisMetrics.total_premium)}.` : null,
                analysisMetrics.total_amount || claimsTotal ? `Total incurred losses: ${formatCurrency(analysisMetrics.total_amount ?? claimsTotal)}.` : null,
                analysisMetrics.loss_ratio ? `Portfolio loss ratio: ${analysisMetrics.loss_ratio}%.` : null,
                analysisMetrics.avg_amount ? `Average claim size: ${formatCurrency(analysisMetrics.avg_amount)}.` : null,
                analysisMetrics.max_claim ? `Largest single claim: ${formatCurrency(analysisMetrics.max_claim)}.` : null,
                topAlert?.message ? `Alert: ${topAlert.message}` : null,
                analysisEvidence.length ? `${analysisEvidence.length} evidence item(s) attached.` : null,
            ].filter(Boolean) as string[]

            return (
                <div className="canvas-stack">
                    <div className="canvas-card" id="canvas-summary">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Summary</h3>
                                <p>{isPolicyMode ? 'Policy risk intelligence' : 'Portfolio overview'}</p>
                            </div>
                            <div className="dashboard-actions">
                                <button className="btn btn-secondary" onClick={() => saveArtifact('summary', 'Summary insight', { metrics: analysisMetrics, dimensions: analysisDimensions, bullets: summaryBullets })}>
                                    Save
                                </button>
                                <button className="btn btn-secondary" onClick={() => {
                                    const el = document.getElementById('canvas-summary')
                                    if (el) exportElementAsPdf(el, `riskmind-summary-${Date.now()}.pdf`)
                                }}>
                                    <Download className="inline h-3 w-3 mr-1" /> PDF
                                </button>
                            </div>
                        </div>
                        <div className="canvas-card-body">
                            <div className="summary-kpis">
                                {isPolicyMode ? (
                                    <>
                                        <div>
                                            <span>Policy</span>
                                            <strong>{analysisDimensions.policy_number || activePolicy}</strong>
                                        </div>
                                        <div>
                                            <span>Claims</span>
                                            <strong>{claimsCount}</strong>
                                        </div>
                                        <div>
                                            <span>Total Loss</span>
                                            <strong>{formatCurrency(claimsTotal)}</strong>
                                        </div>
                                        <div>
                                            <span>Loss Ratio</span>
                                            <strong>{analysisMetrics.loss_ratio ? `${analysisMetrics.loss_ratio}%` : '\u2014'}</strong>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <span>Policies</span>
                                            <strong>{analysisMetrics.policy_count ?? '\u2014'}</strong>
                                        </div>
                                        <div>
                                            <span>Total Premium</span>
                                            <strong>{formatCurrency(analysisMetrics.total_premium || 0)}</strong>
                                        </div>
                                        <div>
                                            <span>Total Claims</span>
                                            <strong>{formatCurrency(analysisMetrics.total_amount || claimsTotal || 0)}</strong>
                                        </div>
                                        <div>
                                            <span>Loss Ratio</span>
                                            <strong>{
                                                analysisMetrics.loss_ratio
                                                    ? `${analysisMetrics.loss_ratio}%`
                                                    : (analysisMetrics.total_premium && analysisMetrics.total_amount)
                                                        ? `${((analysisMetrics.total_amount / analysisMetrics.total_premium) * 100).toFixed(1)}%`
                                                        : '\u2014'
                                            }</strong>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="summary-drivers">
                                <h4>Key drivers</h4>
                                {summaryBullets.length === 0 ? (
                                    <p className="canvas-muted">Ask a specific policy or portfolio question to see key drivers.</p>
                                ) : (
                                    <ul>
                                        {summaryBullets.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            {(analysisEvidence.length > 0 || (provenance && Object.keys(provenance).length > 0)) && renderEvidencePanel()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'memo') {
            const exportMemo = () => {
                if (!memo) return
                const el = document.getElementById('canvas-memo')
                if (el) exportElementAsPdf(el, `riskmind-memo-${memo.policy_number}-${Date.now()}.pdf`)
            }

            return (
                <div className="canvas-stack">
                    <div className="canvas-card" id="canvas-memo">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Underwriter Memo</h3>
                                <p>Executive-ready documentation with evidence and alignment.</p>
                            </div>
                            <div className="dashboard-actions">
                                <button className="btn btn-secondary" onClick={handleMemo}>
                                    {memo ? 'Regenerate' : 'Generate'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => memo && saveArtifact('memo', `Memo ${memo.policy_number}`, memo)} disabled={!memo}>
                                    Save
                                </button>
                                <button className="btn btn-secondary" onClick={exportMemo} disabled={!memo}>
                                    Export
                                </button>
                            </div>
                        </div>
                        <div className="canvas-card-body">
                            <p className="canvas-narrative">{canvasNarrative || 'Generate a memo to document underwriting rationale.'}</p>
                            {memo && (
                                <div className="canvas-memo">
                                    <h4>{memo.policy_number} — {memo.policyholder}</h4>
                                    <div className="memo-section">
                                        <h5>Executive Summary</h5>
                                        <p>{memo.memo_text || 'Not available'}</p>
                                    </div>
                                    <div className="memo-grid">
                                        <div>
                                            <span>Total Claims</span>
                                            <strong>{memo.summary.total_claims}</strong>
                                        </div>
                                        <div>
                                            <span>Total Loss</span>
                                            <strong>{formatCurrency(memo.summary.total_amount)}</strong>
                                        </div>
                                        <div>
                                            <span>Loss Ratio</span>
                                            <strong>{memo.summary.loss_ratio}%</strong>
                                        </div>
                                        <div>
                                            <span>Risk Level</span>
                                            <strong>{memo.summary.risk_level}</strong>
                                        </div>
                                    </div>
                                    <div className="memo-section">
                                        <h5>Recommendation</h5>
                                        <p>{memo.recommendation}</p>
                                        <p><strong>Pricing action:</strong> {memo.pricing_action}</p>
                                    </div>
                                    <div className="memo-section">
                                        <h5>Risk Drivers</h5>
                                        <ul>
                                            {memo.reasons.map((reason, idx) => (
                                                <li key={`${reason}-${idx}`}>{reason}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="memo-section">
                                        <h5>Evidence</h5>
                                        {(analysisEvidence.length ? analysisEvidence : evidenceItems).length === 0 ? (
                                            <p className="canvas-muted">Not available</p>
                                        ) : (
                                            <ul>
                                                {(analysisEvidence.length ? analysisEvidence : evidenceItems).slice(0, 6).map((ev: any, idx: number) => (
                                                    <li key={`${ev.url || ev.filename}-${idx}`}>
                                                        <strong>{ev.description || ev.title || ev.filename || ev.type || 'Evidence'}</strong>
                                                        <span>{ev.claim_number || ev.section || ev.file_path || 'Not available'}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="memo-section">
                                        <h5>Guideline Alignment</h5>
                                        {memo.guideline_references.length === 0 ? (
                                            <p className="canvas-muted">Not available</p>
                                        ) : (
                                            <ul>
                                                {memo.guideline_references.map((ref, idx) => (
                                                    <li key={`${ref.section}-${idx}`}>
                                                        <strong>{ref.section}</strong> {ref.text}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                            {renderEvidencePanel()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'decision') {
            const lossRatio = Number(analysisMetrics.loss_ratio || 0)
            const recommendation = lossRatio > 80 ? 'Refer for senior review with surcharge.' : lossRatio > 50 ? 'Renew with conditions and risk controls.' : 'Renew at standard terms.'
            return (
                <div className="canvas-stack">
                    <div className="canvas-card" id="canvas-decision">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Decision Recommendation</h3>
                                <p>Action-oriented guidance for underwriting decisions.</p>
                            </div>
                            <div className="dashboard-actions">
                                <button className="btn btn-secondary" onClick={() => saveArtifact('decision', 'Decision recommendation', { recommendation, metrics: analysisMetrics })}>
                                    Save
                                </button>
                                <button className="btn btn-secondary" onClick={() => {
                                    const el = document.getElementById('canvas-decision')
                                    if (el) exportElementAsPdf(el, `riskmind-decision-${Date.now()}.pdf`)
                                }}>
                                    <Download className="inline h-3 w-3 mr-1" /> PDF
                                </button>
                            </div>
                        </div>
                        <div className="canvas-card-body">
                            <div className="canvas-recommendation">
                                <strong>{recommendation}</strong>
                                <span>Based on claims and loss ratio signals.</span>
                            </div>
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
                            {renderEvidencePanel()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'geo_map') {
            return (
                <div className="canvas-stack">
                    <div className="canvas-card" id="canvas-geo-map">
                        <div className="canvas-card-header">
                            <div>
                                <h3><MapPin className="inline h-4 w-4 mr-1" /> Geospatial Risk Intelligence</h3>
                                <p>Interactive risk map with AI-powered analytics</p>
                            </div>
                            <div className="dashboard-actions">
                                <button className="btn btn-secondary" onClick={() => saveArtifact('geo_map', 'Geospatial Risk Map', { content: canvasNarrative, policy_count: policies.length })}>
                                    Save
                                </button>
                                <button className="btn btn-secondary" onClick={() => {
                                    const el = document.getElementById('canvas-geo-map')
                                    if (el) exportElementAsPdf(el, `riskmind-geo-map-${Date.now()}.pdf`)
                                }}>
                                    <Download className="inline h-3 w-3 mr-1" /> PDF
                                </button>
                            </div>
                        </div>
                        <div className="canvas-card-body geo-map-canvas-full">
                            <RiskMap height="calc(100vh - 12rem)" aiInsights={canvasNarrative} />
                        </div>
                    </div>
                </div>
            )
        }

        return null
    }

    return (
        <div className="riskmind-shell">
            <section className="panel">
                <div className="panel-header chat-header">
                    <div className="panel-title">
                        <div className="chat-bot-avatar">
                            <Bot style={{ width: '1rem', height: '1rem' }} />
                            <span className="chat-online-dot" />
                        </div>
                        <div className="panel-title-text">
                            <span className="panel-title-main">RiskMind</span>
                            <span className="panel-title-sub">Copilot</span>
                        </div>
                    </div>
                    <div className="chat-history-wrapper" ref={historyRef}>
                        <button className="chat-history-btn" onClick={toggleHistory} title="Chat history">
                            <History style={{ width: '1rem', height: '1rem' }} />
                        </button>
                        {showHistory && (
                            <div className="chat-history-dropdown">
                                <div className="chat-history-header">
                                    <span>Recent Chats</span>
                                    <button className="chat-history-new" onClick={startNewChat} title="New chat">
                                        <Plus style={{ width: '0.875rem', height: '0.875rem' }} /> New
                                    </button>
                                </div>
                                <div className="chat-history-list">
                                    {historyLoading ? (
                                        <div className="chat-history-empty">
                                            <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                                            <span>Loading...</span>
                                        </div>
                                    ) : chatSessions.length === 0 ? (
                                        <div className="chat-history-empty">
                                            <MessageSquare style={{ width: '1rem', height: '1rem' }} />
                                            <span>No recent chats</span>
                                        </div>
                                    ) : (
                                        chatSessions.map(session => (
                                            <div
                                                key={session.id}
                                                className={`chat-history-item${activeSessionId === session.id ? ' active' : ''}`}
                                                onClick={() => loadSession(session)}
                                            >
                                                <div className="chat-history-item-info">
                                                    <span className="chat-history-item-title">{session.title}</span>
                                                    <span className="chat-history-item-meta">
                                                        {session.message_count} msgs &middot; {new Date(session.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <button
                                                    className="chat-history-item-delete"
                                                    onClick={(e) => deleteSession(e, session.id)}
                                                    title="Delete chat"
                                                >
                                                    <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="panel-body">
                    <details className="prompt-library">
                        <summary>Prompt library</summary>
                        <div className="prompt-groups">
                            {suggestedPromptGroups.map((group) => (
                                <div key={group.title} className="prompt-group">
                                    <div className="prompt-group-title">{group.title}</div>
                                    <div className="prompt-list">
                                        {group.prompts.map((prompt) => (
                                            <button key={prompt.label} onClick={() => handlePrompt(prompt.label)} className="intent-chip">
                                                {prompt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </details>

                    <div className="conversation">
                        {messages.length === 0 && (
                            <div className="conversation-empty">
                                <div className="empty-icon-ring">
                                    <Zap />
                                </div>
                                <h4>Ready to assist</h4>
                                <p>Ask about policies, claims, risk assessments, or portfolio performance.</p>
                            </div>
                        )}
                        {messages.map((m) => (
                            <div key={m.id} className={`conversation-bubble ${m.role}`}>
                                <div className="bubble-avatar">
                                    {m.role === 'assistant'
                                        ? <Bot style={{ width: '0.8rem', height: '0.8rem' }} />
                                        : <span>{(currentUser.name || 'U').charAt(0)}</span>
                                    }
                                </div>
                                <div className="bubble-body">
                                <div className="bubble-content">
                                    {m.role === 'assistant' ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
                                    ) : (
                                        m.content
                                    )}
                                </div>
                                {m.role === 'assistant' && m.suggestCanvasView && (
                                    <div className="bubble-canvas-hint">
                                        <Sparkles size={12} />
                                        <span>Detailed view available in the Intelligence Canvas</span>
                                    </div>
                                )}
                                {m.sources && m.sources.length > 0 && (
                                    <div className="bubble-sources">
                                        <BookOpen />
                                        <span>{m.sources.map(s => s.section).join(', ')}</span>
                                    </div>
                                )}
                                {m.role === 'assistant' && m.suggestedPrompts && m.suggestedPrompts.length > 0 && (
                                    <div className="bubble-suggestions">
                                        <span className="suggestions-label">Did you mean:</span>
                                        <div className="suggestion-chips">
                                            {m.suggestedPrompts.map((prompt, idx) => (
                                                <button
                                                    key={idx}
                                                    className="suggestion-chip"
                                                    onClick={() => {
                                                        setInput(prompt)
                                                        handleSend()
                                                    }}
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Intent Suggestions - Clickable Intent Options */}
                                {m.role === 'assistant' && m.suggestedIntents && m.suggestedIntents.length > 0 && (
                                    <div className="bubble-suggestions intent-suggestions">
                                        <span className="suggestions-label">Choose what you'd like to do:</span>
                                        <div className="suggestion-chips intent-chips">
                                            {m.suggestedIntents.map((intentOption, idx) => (
                                                <button
                                                    key={idx}
                                                    className="suggestion-chip intent-chip"
                                                    onClick={() => {
                                                        setInput(intentOption.example)
                                                        handleSend()
                                                    }}
                                                    title={`Keywords: ${intentOption.keywords.join(', ')}`}
                                                >
                                                    <span className="intent-label">{intentOption.label}</span>
                                                    <span className="intent-example">{intentOption.example}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <span className="bubble-time">
                                    {m.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="conversation-bubble assistant">
                                <div className="bubble-avatar">
                                    <Bot style={{ width: '0.8rem', height: '0.8rem' }} />
                                </div>
                                <div className="bubble-body">
                                    <div className="typing-indicator">
                                        <span /><span /><span />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="panel-footer">
                    <div className="composer">
                        <label className="upload-button" title="Upload unstructured data">
                            <Paperclip />
                            <input ref={fileInputRef} type="file" onChange={handleUpload} />
                        </label>
                        <input
                            className="input-field composer-input"
                            placeholder="Ask RiskMind to explain risk, compare policies, or analyze documents..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button className="btn btn-primary send-button" onClick={handleSend} disabled={loading || uploading}>
                            {loading ? <Loader2 className="spin" /> : <Send />}
                        </button>
                    </div>
                    <div className="upload-help">
                        Attach Evidence (PDF, Image, Audio) — evidence is used in the analysis and audit trail.
                    </div>
                    {uploadStatus && (
                        <div className={`upload-status ${uploadStatus.state}`}>
                            {uploadStatus.message}
                        </div>
                    )}
                    {pendingPolicy && (
                        <div className="upload-confirm">
                            <span>
                                Detected policy {pendingPolicy}
                                {pendingPolicyName ? ` (${pendingPolicyName})` : ''}. Set as active?
                            </span>
                            <div className="upload-confirm-actions">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setActivePolicy(pendingPolicy)
                                        setPendingPolicy(null)
                                    }}
                                >
                                    Confirm
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setPendingPolicy(null)}
                                >
                                    Ignore
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section className="panel canvas">
                <div className="panel-header">
                    <div className="panel-title">
                        <Sparkles /> Intelligence Canvas
                    </div>
                    <div className="canvas-status">
                        <div>
                            <span>Intent</span>
                            <strong>{resolvedIntent || 'Awaiting request'}</strong>
                        </div>
                        <div>
                            <span>Output</span>
                            <strong>{outputLabel}</strong>
                        </div>
                    </div>
                </div>
                <div className="panel-body">
                    <div className="focus-drawer">
                        <div>
                            <h4>Focus Insight</h4>
                            <div className="focus-insight-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{focusInsight}</ReactMarkdown>
                            </div>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setFocusExpanded(prev => !prev)}
                        >
                            {focusExpanded ? 'Collapse' : 'Expand'}
                        </button>
                    </div>
                    {focusExpanded && renderCanvas()}
                </div>
            </section>

        </div>
    )
}
