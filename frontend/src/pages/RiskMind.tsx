import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSearchParams, Link } from 'react-router-dom'
import { lazy } from 'react'
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
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
    ThumbsDown,
    Pin
} from 'lucide-react'
import apiService, {
    AlertsSummary,
    AlertItem,
    PolicyItem,
    Claim,
    MemoResponse,
    GuidelineCreate,
    DashboardData
} from '../services/api'
type CanvasMode = 'empty' | 'analysis' | 'dashboard' | 'card' | 'memo' | 'decision'

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
    type: 'summary' | 'card' | 'memo' | 'dashboard' | 'decision'
    title: string
    output_type: CanvasMode
    inferred_intent: string
    context: {
        policy_number?: string
        claim_number?: string
        submission_id?: string
    }
    artifact: Record<string, any>
    provenance: Record<string, any> | null
    created_at: string
}

type DashboardWidget = {
    id: string
    type: 'kpi' | 'table' | 'bar' | 'line' | 'pie' | 'scatter' | 'timeline' | 'map'
    title: string
    dataset: keyof DashboardData | 'joined_claims' | 'joined_policies'
    field?: string
    groupBy?: string
    agg?: 'count' | 'sum' | 'avg'
    sql?: string
    description?: string
}

type DashboardCache = {
    datasets: Record<string, any[]>
    fields: Record<string, string[]>
    metrics: Record<string, string[]>
    attributes: Record<string, string[]>
}

const LazyRiskMap = lazy(() => import('../components/RiskMap'))

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
]

const policyRegex = /(COMM-\d{4}-\d{3}|P-\d{4})/i
const claimRegex = /(CLM-\d{4}-\d{3})/i

const inferOutputType = (text: string): CanvasMode => {
    const lower = text.toLowerCase()
    if (lower.includes('memo') || lower.includes('draft') || lower.includes('document')) return 'memo'
    if (lower.includes('decision') || lower.includes('renew') || lower.includes('accept') || lower.includes('decline') || lower.includes('refer')) return 'decision'
    if (lower.includes('card') || lower.includes('decision-ready')) return 'card'
    if (lower.includes('dashboard') || lower.includes('overview') || lower.includes('trend') || lower.includes('chart') || lower.includes('compare') || lower.includes('by ')) return 'dashboard'
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
    const [uploading, setUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<{ state: 'uploading' | 'success' | 'error'; message: string } | null>(null)
    const [pendingPolicy, setPendingPolicy] = useState<string | null>(null)
    const [canvasMode, setCanvasMode] = useState<CanvasMode>('empty')
    const [selectedOutputType, setSelectedOutputType] = useState<'auto' | CanvasMode>('auto')
    const [outputPinned, setOutputPinned] = useState(false)
    const [showCanvasSummary, setShowCanvasSummary] = useState(true) // Controls if summary card should be displayed
    const [focusExpanded, setFocusExpanded] = useState(true)
    const [canvasNarrative, setCanvasNarrative] = useState('')
    const [activePolicy, setActivePolicy] = useState<string>('')
    const [activeClaim, setActiveClaim] = useState<string>('')
    const [activeSubmission, setActiveSubmission] = useState<string>('')
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
    const [inferredIntent, setInferredIntent] = useState<string>('')
    const [inferredOutputType, setInferredOutputType] = useState<CanvasMode>('analysis')
    const [provenance, setProvenance] = useState<Record<string, any> | null>(null)
    const [suggestedOutputs, setSuggestedOutputs] = useState<string[]>([])
    const [intentConfidence, setIntentConfidence] = useState<number | null>(null)
    const [intentReasonCodes, setIntentReasonCodes] = useState<string[]>([])
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
    const [dashboardLoading, setDashboardLoading] = useState(false)
    const [dashboardError, setDashboardError] = useState<string | null>(null)
    const [dashboardCache, setDashboardCache] = useState<DashboardCache | null>(null)
    const [widgetPrompt, setWidgetPrompt] = useState('')
    const [widgetDataset, setWidgetDataset] = useState('')
    const [widgetMetric, setWidgetMetric] = useState('')
    const [widgetGroupBy, setWidgetGroupBy] = useState('')
    const [widgetAgg, setWidgetAgg] = useState<'count' | 'sum' | 'avg'>('count')
    const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
    const [widgetTypeOverride, setWidgetTypeOverride] = useState<'auto' | DashboardWidget['type']>('auto')
    const [dashboardFilters, setDashboardFilters] = useState({ policy: '', status: '', dateRange: '' })
    const [widgetSqlOpen, setWidgetSqlOpen] = useState<string | null>(null)
    const [replaceWidgetId, setReplaceWidgetId] = useState<string | null>(null)
    const [pendingWidgetPrompt, setPendingWidgetPrompt] = useState<string | null>(null)

    // Debug: Track widget state changes
    useEffect(() => {
        console.log('[State] dashboardWidgets count:', dashboardWidgets.length)
        if (dashboardWidgets.length > 0) {
            console.log('[State] Widgets:', dashboardWidgets.map(w => ({ id: w.id, title: w.title, type: w.type, dataset: w.dataset })))
        }
    }, [dashboardWidgets])

    useEffect(() => {
        const policyParam = searchParams.get('policy')
        const claimParam = searchParams.get('claim')
        const outputParam = searchParams.get('output') as CanvasMode | null
        if (policyParam) setActivePolicy(policyParam)
        if (claimParam) setActiveClaim(claimParam)
        if (outputParam) {
            setSelectedOutputType(outputParam)
            setCanvasMode(outputParam)
            setOutputPinned(true)
        }
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

    useEffect(() => {
        setFocusExpanded(canvasMode !== 'analysis')
    }, [canvasMode])

    useEffect(() => {
        if (canvasMode !== 'dashboard' || dashboardData || dashboardLoading) return
        console.log('[Dashboard] Fetching dashboard data...')
        const fetchDashboard = async () => {
            setDashboardLoading(true)
            setDashboardError(null)
            try {
                const data = await apiService.getDashboardData()
                console.log('[Dashboard] Data loaded successfully')
                setDashboardData(data)
            } catch {
                console.log('[Dashboard] Failed to load data')
                setDashboardError('Unable to load dashboard data. Check the backend.')
            } finally {
                setDashboardLoading(false)
            }
        }
        fetchDashboard()
    }, [canvasMode, dashboardData, dashboardLoading])

    useEffect(() => {
        if (!dashboardData) return
        const policyById = new Map(dashboardData.policies.map((p: any) => [p.id, p]))
        const policyByNumber = new Map(dashboardData.policies.map((p: any) => [p.policy_number, p]))
        const decisionsByPolicy = new Map<string, any>()
        dashboardData.decisions.forEach((decision: any) => {
            if (!decision?.policy_number) return
            const existing = decisionsByPolicy.get(decision.policy_number)
            if (!existing) {
                decisionsByPolicy.set(decision.policy_number, decision)
                return
            }
            const nextDate = new Date(decision.created_at || 0)
            const prevDate = new Date(existing.created_at || 0)
            if (nextDate >= prevDate) {
                decisionsByPolicy.set(decision.policy_number, decision)
            }
        })
        const guidelineCountByPolicy = dashboardData.guidelines.reduce((acc: Record<string, number>, guideline: any) => {
            if (guideline?.policy_number) {
                acc[guideline.policy_number] = (acc[guideline.policy_number] || 0) + 1
            }
            return acc
        }, {})
        const claimsAggByPolicy = dashboardData.claims.reduce((acc: Record<string, { count: number; total: number; max: number }>, claim: any) => {
            const policy = policyById.get(claim.policy_id) || policyByNumber.get(claim.policy_number)
            const policyNumber = policy?.policy_number || claim.policy_number
            if (!policyNumber) return acc
            if (!acc[policyNumber]) {
                acc[policyNumber] = { count: 0, total: 0, max: 0 }
            }
            acc[policyNumber].count += 1
            acc[policyNumber].total += Number(claim.claim_amount || 0)
            acc[policyNumber].max = Math.max(acc[policyNumber].max, Number(claim.claim_amount || 0))
            return acc
        }, {})

        const joinedClaims = dashboardData.claims.map((claim: any) => {
            const policy = policyById.get(claim.policy_id) || policyByNumber.get(claim.policy_number)
            const policyNumber = policy?.policy_number || claim.policy_number
            const decision = policyNumber ? decisionsByPolicy.get(policyNumber) : null
            return {
                ...claim,
                policy_number: policyNumber,
                policyholder_name: policy?.policyholder_name,
                industry_type: policy?.industry_type,
                premium: policy?.premium,
                effective_date: policy?.effective_date,
                expiration_date: policy?.expiration_date,
                latitude: policy?.latitude,
                longitude: policy?.longitude,
                latest_decision: decision?.decision,
                decision_reason: decision?.reason,
                decision_risk_level: decision?.risk_level,
                decided_by: decision?.decided_by,
                decision_created_at: decision?.created_at,
                guideline_count: policyNumber ? (guidelineCountByPolicy[policyNumber] || 0) : 0,
            }
        })

        const joinedPolicies = dashboardData.policies.map((policy: any) => {
            const policyNumber = policy.policy_number
            const decision = policyNumber ? decisionsByPolicy.get(policyNumber) : null
            const agg = policyNumber ? claimsAggByPolicy[policyNumber] : undefined
            return {
                ...policy,
                claim_count: agg?.count || 0,
                total_claims: agg?.total || 0,
                max_claim: agg?.max || 0,
                latest_decision: decision?.decision,
                decision_reason: decision?.reason,
                decision_risk_level: decision?.risk_level,
                decided_by: decision?.decided_by,
                decision_created_at: decision?.created_at,
                guideline_count: policyNumber ? (guidelineCountByPolicy[policyNumber] || 0) : 0,
            }
        })

        const datasets: Record<string, any[]> = {
            policies: dashboardData.policies,
            claims: dashboardData.claims,
            guidelines: dashboardData.guidelines,
            decisions: dashboardData.decisions,
            documents: dashboardData.documents,
            chat_sessions: dashboardData.chat_sessions,
            chat_messages: dashboardData.chat_messages,
            joined_claims: joinedClaims,
            joined_policies: joinedPolicies,
        }

        const fields: Record<string, string[]> = {}
        const metrics: Record<string, string[]> = {}
        const attributes: Record<string, string[]> = {}
        Object.entries(datasets).forEach(([key, rows]) => {
            const sample = rows[0] || {}
            const keys = Object.keys(sample)
            fields[key] = keys
            metrics[key] = keys.filter((field) => typeof sample[field] === 'number')
            attributes[key] = keys.filter((field) => typeof sample[field] !== 'number')
        })

        setDashboardCache({ datasets, fields, metrics, attributes })
        console.log('[Dashboard] Cache created. Datasets:', Object.keys(datasets), 'Pending widget:', pendingWidgetPrompt)
        const defaultDataset = datasets.joined_claims.length ? 'joined_claims' : datasets.claims.length ? 'claims' : 'policies'
        setWidgetDataset((prev) => prev || defaultDataset)
    }, [dashboardData])

    useEffect(() => {
        if (canvasMode !== 'dashboard' || !dashboardData) return
        if (dashboardWidgets.length > 0) return
        // If there's a pending widget prompt, widgets will be created by the pendingWidgetPrompt effect
        if (pendingWidgetPrompt) return
        // Do not auto-seed widgets; only render what the user asked for.
    }, [canvasMode, dashboardData, dashboardWidgets.length, pendingWidgetPrompt])

    useEffect(() => {
        if (!pendingWidgetPrompt) return
        if (!dashboardCache) {
            console.log('[Widget] Pending widget prompt but cache not ready:', pendingWidgetPrompt)
            // Dashboard cache not ready yet, will retry when it becomes available
            return
        }

        console.log('[Widget] Creating widget from prompt:', pendingWidgetPrompt)
        // Cache is ready, apply the widget prompt and get computed values directly
        const config = applyWidgetPrompt(pendingWidgetPrompt)

        // Auto-create widget for any chart/plot/trend request using direct config (no stale state)
        if (config && /(chart|plot|bar|line|pie|trend|widget|graph|visualization|by )/i.test(pendingWidgetPrompt)) {
            console.log('[Widget] Matched chart/trend pattern, creating widget directly with config:', config)
            addWidgetDirect(config, pendingWidgetPrompt)
            console.log('[Widget] Widget created directly')
        }

        setPendingWidgetPrompt(null)
    }, [pendingWidgetPrompt, dashboardCache])

    useEffect(() => {
        if (!dashboardCache || !widgetDataset) return
        if (widgetMetric) return
        setWidgetMetric(dashboardCache.metrics[widgetDataset]?.[0] || '')
    }, [dashboardCache, widgetDataset, widgetMetric])

    useEffect(() => {
        if (!activePolicy || canvasMode !== 'dashboard') return
        setDashboardFilters(prev => ({ ...prev, policy: activePolicy }))
    }, [activePolicy, canvasMode])

    const policyInfo = useMemo(() => (
        policies.find(p => p.policy_number === activePolicy) || null
    ), [policies, activePolicy])

    const analysisMetrics = analysisObject?.metrics || {}
    const analysisDimensions = analysisObject?.dimensions || {}
    const analysisEvidence = analysisObject?.evidence || []
    const resolvedOutputType = selectedOutputType === 'auto' ? inferredOutputType : selectedOutputType
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
        dashboard: 'Dashboard',
        card: 'HyperIntelligence Card',
        memo: 'Underwriter Memo',
        decision: 'Decision Recommendation',
    }
    const outputLabel = outputLabels[resolvedOutputType] || 'Summary'
    const confidenceLabel = intentConfidence !== null && intentConfidence < 60 ? 'Low confidence' : null

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

    const focusInsight = lastAssistantMessage || canvasNarrative || topAlert?.message || 'Ask RiskMind to generate a focused insight.'

    const formatCurrency = (value?: number | null) => {
        if (value === null || value === undefined) return 'Not available'
        return `$${Number(value).toLocaleString()}`
    }

    const applyDashboardFilters = (rows: any[]) => {
        let filtered = [...rows]
        if (dashboardFilters.policy.trim()) {
            const policy = dashboardFilters.policy.trim().toLowerCase()
            filtered = filtered.filter((row) => String(row.policy_number || '').toLowerCase().includes(policy))
        }
        if (dashboardFilters.status.trim()) {
            const status = dashboardFilters.status.trim().toLowerCase()
            filtered = filtered.filter((row) => String(row.status || '').toLowerCase().includes(status))
        }
        if (dashboardFilters.dateRange && filtered.length > 0) {
            const now = new Date()
            const cutoff = new Date(now)
            if (dashboardFilters.dateRange === '30d') cutoff.setDate(now.getDate() - 30)
            if (dashboardFilters.dateRange === '90d') cutoff.setDate(now.getDate() - 90)
            if (dashboardFilters.dateRange === '12m') cutoff.setFullYear(now.getFullYear() - 1)
            filtered = filtered.filter((row) => {
                const dateValue = row.claim_date || row.created_at || row.effective_date
                if (!dateValue) return true
                const parsed = new Date(dateValue)
                return !Number.isNaN(parsed.valueOf()) && parsed >= cutoff
            })
        }
        return filtered
    }

    const buildWidgetSql = (dataset: string, field?: string, agg?: string, groupBy?: string) => {
        if (groupBy) {
            return `SELECT ${groupBy}, ${agg || 'count'}(${field || '*'}) AS value FROM ${dataset} GROUP BY ${groupBy}`
        }
        if (agg) {
            return `SELECT ${agg}(${field || '*'}) AS value FROM ${dataset}`
        }
        return `SELECT * FROM ${dataset}`
    }

    const applyWidgetPrompt = (prompt: string): { dataset: string; type: DashboardWidget['type']; agg: DashboardWidget['agg']; metric: string; groupBy: string } | null => {
        if (!dashboardCache || !prompt.trim()) return null
        console.log('[applyWidgetPrompt] Processing prompt:', prompt)
        const lower = prompt.toLowerCase()
        const cleaned = lower.replace('add widget showing', '').replace('add widget', '').replace('create widget', '').replace('create a', '').replace('create', '').replace('show', '').replace('give me', '').replace('for me', '').trim()

        const datasetCandidates = Object.keys(dashboardCache.datasets)
        const datasetMatch = datasetCandidates.find((name) => cleaned.includes(name.replace('_', ' ')))
        const dataset = datasetMatch || (cleaned.includes('policy') ? 'joined_policies' : cleaned.includes('guideline') ? 'guidelines' : cleaned.includes('decision') ? 'decisions' : cleaned.includes('document') ? 'documents' : cleaned.includes('session') || cleaned.includes('chat') ? 'chat_sessions' : 'joined_claims')

        let type: DashboardWidget['type'] = 'bar'
        // Phase 1: Implicit hints (low priority - easily overridden)
        if (cleaned.includes('distribution') || cleaned.includes('correlation')) type = 'scatter'
        if (cleaned.includes('breakdown')) type = 'pie'
        if (cleaned.includes('trend') || cleaned.includes('time series') || cleaned.includes('over time')) type = 'line'
        if (cleaned.includes('history') || cleaned.includes('chronolog')) type = 'timeline'
        // Phase 2: Explicit chart type names (high priority - always win)
        if (cleaned.includes('table')) type = 'table'
        if (cleaned.includes('pie') || cleaned.includes('donut')) type = 'pie'
        if (cleaned.includes('scatter')) type = 'scatter'
        if (cleaned.includes('line chart') || cleaned.includes('line graph')) type = 'line'
        if (cleaned.includes('bar chart') || cleaned.includes('bar graph')) type = 'bar'
        if (cleaned.includes('timeline')) type = 'timeline'
        if (cleaned.includes('map') || cleaned.includes('geo') || cleaned.includes('geographic') || cleaned.includes('spatial') || cleaned.includes('esri')) type = 'map'

        let agg: DashboardWidget['agg'] = 'count'
        if (cleaned.includes('sum') || cleaned.includes('total')) agg = 'sum'
        if (cleaned.includes('average') || cleaned.includes('avg')) agg = 'avg'
        if (cleaned.includes('count')) agg = 'count' // Count takes priority

        const metricOptions = dashboardCache.metrics[dataset] || []
        const attributeOptions = dashboardCache.attributes[dataset] || []
        const metricMatch = metricOptions.find((field) => cleaned.includes(field.replace('_', ' ')))
        const attributeMatch = attributeOptions.find((field) => cleaned.includes(field.replace('_', ' ')))
        const groupByMatch = attributeOptions.find((field) => cleaned.includes(`by ${field.replace('_', ' ')}`))

        // Default to appropriate metric based on aggregation
        const defaultMetric = agg === 'count' ? 'id' : (dataset === 'joined_claims' ? 'claim_amount' : metricOptions[0] || '')
        const defaultGroupBy = dataset === 'joined_claims' ? 'policy_number' : dataset === 'joined_policies' ? 'industry_type' : attributeOptions[0] || ''

        const resolvedMetric = metricMatch || defaultMetric
        const resolvedGroupBy = groupByMatch || attributeMatch || defaultGroupBy

        console.log('[applyWidgetPrompt] Settings:', { dataset, type, agg, metric: resolvedMetric, groupBy: resolvedGroupBy })
        setWidgetDataset(dataset)
        setWidgetAgg(agg)
        setWidgetMetric(resolvedMetric)
        setWidgetGroupBy(resolvedGroupBy)
        if (widgetTypeOverride === 'auto') {
            setWidgetTypeOverride(type)
        }

        // Return computed values so callers can use them immediately without waiting for state
        return { dataset, type, agg, metric: resolvedMetric, groupBy: resolvedGroupBy }
    }

    // Direct widget creation that uses explicit config instead of reading from stale state
    const addWidgetDirect = (config: { dataset: string; type: DashboardWidget['type']; agg: DashboardWidget['agg']; metric: string; groupBy: string }, promptTitle: string) => {
        if (!dashboardCache) {
            console.log('[addWidgetDirect] No dashboard cache available')
            return
        }
        const { dataset, type, agg, metric, groupBy } = config
        const title = promptTitle.trim() || `${(agg || 'count').toUpperCase()} ${metric}${groupBy ? ` by ${groupBy}` : ''}`
        const sql = buildWidgetSql(dataset, metric, agg, groupBy || undefined)

        console.log('[addWidgetDirect] Creating widget:', { type, title, dataset, metric, groupBy, agg })

        const widget: DashboardWidget = {
            id: replaceWidgetId || `${Date.now()}`,
            type,
            title,
            dataset: dataset as DashboardWidget['dataset'],
            field: metric || undefined,
            groupBy: groupBy || undefined,
            agg,
            sql,
            description: title,
        }

        setDashboardWidgets(prev => {
            if (replaceWidgetId) {
                console.log('[addWidgetDirect] Replacing widget:', replaceWidgetId)
                return prev.map(item => (item.id === replaceWidgetId ? widget : item))
            }
            console.log('[addWidgetDirect] Adding new widget, current count:', prev.length)
            const newWidgets = [widget, ...prev]
            console.log('[addWidgetDirect] New widgets array:', newWidgets)
            return newWidgets
        })
        setWidgetPrompt('')
        setWidgetTypeOverride('auto')
        setReplaceWidgetId(null)
    }

    // Legacy function for manual widget creation from UI selectors (reads from state)
    const addWidgetFromSelectors = () => {
        if (!dashboardCache) {
            console.log('[addWidgetFromSelectors] No dashboard cache available')
            return
        }
        const rawDataset = widgetDataset || 'joined_claims'
        const metric = widgetMetric || (dashboardCache.metrics[rawDataset]?.[0] || '')
        const groupBy = widgetGroupBy || undefined
        const agg = widgetAgg
        const type = widgetTypeOverride === 'auto' ? (groupBy ? 'bar' : 'kpi') : widgetTypeOverride
        addWidgetDirect({ dataset: rawDataset, type, agg, metric, groupBy: groupBy || '' }, widgetPrompt)
    }

    const buildDefaultWidgets = () => {
        const widgets: DashboardWidget[] = [
            {
                id: `kpi-${Date.now()}`,
                type: 'kpi',
                title: 'Total Claims',
                dataset: 'claims',
                field: 'id',
                agg: 'count',
                sql: buildWidgetSql('claims', 'id', 'count'),
            },
            {
                id: `loss-${Date.now() + 1}`,
                type: 'kpi',
                title: 'Total Loss',
                dataset: 'claims',
                field: 'claim_amount',
                agg: 'sum',
                sql: buildWidgetSql('claims', 'claim_amount', 'sum'),
            },
            {
                id: `trend-${Date.now() + 2}`,
                type: 'line',
                title: 'Claim Severity Trend',
                dataset: 'claims',
                field: 'claim_amount',
                agg: 'sum',
                sql: 'SELECT strftime("%Y-%m", claim_date) AS month, SUM(claim_amount) AS value FROM claims GROUP BY month',
            },
            {
                id: `cause-${Date.now() + 3}`,
                type: 'bar',
                title: 'Claims by Type',
                dataset: 'claims',
                field: 'claim_type',
                agg: 'count',
                sql: 'SELECT claim_type, COUNT(*) AS value FROM claims GROUP BY claim_type',
            },
        ]

        return widgets.slice(0, 4)
    }

    const handleSend = async () => {
        if (!input.trim() || loading) return
        const userMessage = input.trim()
        const policyMatch = userMessage.match(policyRegex)
        const claimMatch = userMessage.match(claimRegex)
        if (policyMatch) setActivePolicy(policyMatch[1].toUpperCase())
        if (claimMatch) setActiveClaim(claimMatch[1].toUpperCase())
        const lowerMessage = userMessage.toLowerCase()
        if (lowerMessage.includes('last 12 months') || lowerMessage.includes('12 months')) {
            setDashboardFilters(prev => ({ ...prev, dateRange: '12m' }))
        }
        if (lowerMessage.includes('last 90 days') || lowerMessage.includes('90 days')) {
            setDashboardFilters(prev => ({ ...prev, dateRange: '90d' }))
        }
        if (lowerMessage.includes('last 30 days') || lowerMessage.includes('30 days')) {
            setDashboardFilters(prev => ({ ...prev, dateRange: '30d' }))
        }
        const inferredType = inferOutputType(userMessage)
        const nextOutput = selectedOutputType === 'auto' ? inferredType : selectedOutputType
        setCanvasMode(nextOutput)
        setInferredOutputType(nextOutput)
        setCanvasNarrative('RiskMind is processing your request...')
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userMessage, timestamp: new Date() }])
        setInput('')
        setLoading(true)

        try {
            const response = await apiService.chat(userMessage)
            setCanvasNarrative(response.response)
            const artifactData = response.artifact?.data || response.analysis_object
            if (artifactData) {
                setAnalysisObject(artifactData)
            }
            const responseOutput = (response.output_type || response.default_mode || nextOutput) as CanvasMode
            const responseIntent = response.inferred_intent || response.analysis_object?.context?.intent || ''
            setInferredIntent(responseIntent)
            const confidence = response.provenance?.confidence ?? null
            const reasonCodes = response.provenance?.confidence_reason_codes || []
            setIntentConfidence(confidence)
            setIntentReasonCodes(reasonCodes)
            const suggestions = response.suggested_outputs || response.recommended_modes || []
            setSuggestedOutputs(confidence !== null && confidence < 60 ? suggestions.slice(0, 2) : suggestions)
            setProvenance(response.provenance || artifactData?.provenance || null)
            setInferredOutputType(responseOutput)

            // NEW: Check if canvas summary should be shown for UNDERSTAND intent
            const shouldShowSummary = response.show_canvas_summary !== false  // Default to true if not specified
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

            // Set canvas mode based on response
            if (!outputPinned && selectedOutputType === 'auto') {
                setCanvasMode(responseOutput)
            }

            // Auto-create dashboard widget for chart/trend requests
            // Auto-create dashboard widget for chart/trend requests
            if (responseOutput === 'dashboard') {
                const lowerMsg = userMessage.toLowerCase()

                // Overview: Revert to default widgets if requested without specific charts
                if (/(create|give|show).*(overview|summary|briefing)/.test(lowerMsg) && !/(chart|plot|bar|line|pie|trend|map|geo|scatter|location)/.test(lowerMsg)) {
                    console.log('[Widget] Overview requested, setting default widgets')
                    setDashboardWidgets(buildDefaultWidgets())
                }
                else if (/(dashboard|widget|chart|plot|bar|line|pie|trend|map|geo|scatter|location)/.test(lowerMsg)) {
                    console.log('[Widget] Dashboard mode detected, setting pending widget prompt:', userMessage)
                    setWidgetPrompt(userMessage)

                    // If dashboard cache is already available, create widget immediately (skip pendingWidgetPrompt)
                    if (dashboardCache) {
                        console.log('[Widget] Dashboard cache available, creating widget immediately')
                        const config = applyWidgetPrompt(userMessage)
                        if (config && /(chart|plot|bar|line|pie|trend|widget|graph|visualization)/i.test(userMessage)) {
                            addWidgetDirect(config, userMessage)
                            console.log('[Widget] Immediate widget created with config:', config)
                        }
                    } else {
                        // Cache not ready yet — set pending so the useEffect creates it when cache loads
                        setPendingWidgetPrompt(userMessage)
                    }
                }
            }

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: response.response,
                sources: response.sources,
                suggestedPrompts: response.suggested_prompts || [],
                suggestedIntents: response.suggested_intents || [],
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
        if (selectedOutputType !== 'auto' && !outputPinned) {
            setSelectedOutputType('auto')
        }
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        setUploadStatus({ state: 'uploading', message: `Uploading ${file.name}...` })
        const nextOutput = selectedOutputType === 'auto' ? resolvedOutputType : selectedOutputType
        setCanvasMode(nextOutput)
        setInferredOutputType(nextOutput)
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
            output_type: resolvedOutputType,
            inferred_intent: resolvedIntent || 'Understand',
            context: currentContext,
            artifact,
            provenance: provenance || analysisObject?.provenance || null,
            created_at: new Date().toISOString(),
        })
    }

    const renderEvidencePanel = () => {
        const tables = provenance?.tables_used || analysisObject?.provenance?.tables_used || []
        const joinPaths = provenance?.join_paths || analysisObject?.provenance?.join_paths || []
        const queryIds = provenance?.query_ids || analysisObject?.provenance?.query_ids || []
        const sqlPlan = provenance?.sql_plan || analysisObject?.glass_box?.sql_plan || []
        const citations = provenance?.citations || []
        const confidence = provenance?.confidence
        const generatedAt = provenance?.generated_at
        const reasonCodes = provenance?.confidence_reason_codes || intentReasonCodes
        const evidenceList = (analysisEvidence.length ? analysisEvidence : evidenceItems).slice(0, 6)

        return (
            <details className="evidence-panel" open>
                <summary>Evidence and Provenance</summary>
                <div className="evidence-panel-body">
                    <div className="evidence-header">
                        <div>
                            <h4>Evidence and Provenance</h4>
                            <p>Lineage, citations, and traceability for this output.</p>
                        </div>
                        <div className="evidence-meta">
                            <span>{confidence !== undefined && confidence !== null ? `${confidence}% confidence` : 'Confidence: Not available'}</span>
                            <span>{generatedAt ? `Generated ${generatedAt}` : 'Generated: Not available'}</span>
                        </div>
                    </div>
                    <div className="evidence-grid">
                        <div className="evidence-block">
                            <h5>Data lineage</h5>
                            <div><strong>Tables:</strong> {tables.length ? tables.join(', ') : 'Not available'}</div>
                            <div><strong>Join paths:</strong> {joinPaths.length ? joinPaths.join(' | ') : 'Not available'}</div>
                            <div><strong>Query IDs:</strong> {queryIds.length ? queryIds.join(', ') : 'Not available'}</div>
                            <div><strong>Reason codes:</strong> {reasonCodes.length ? reasonCodes.join(', ') : 'Not available'}</div>
                        </div>
                        <div className="evidence-block">
                            <h5>Citations</h5>
                            {citations.length === 0 ? (
                                <p className="canvas-muted">Not available</p>
                            ) : (
                                <ul>
                                    {citations.slice(0, 6).map((cite: any, idx: number) => (
                                        <li key={`${cite.title}-${idx}`}>
                                            <strong>{cite.title}</strong>
                                            <span>{cite.type}</span>
                                            {cite.ref && <em>{cite.ref}</em>}
                                            {cite.snippet && <p>{cite.snippet}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    <div className="evidence-block">
                        <h5>Evidence items</h5>
                        {evidenceList.length === 0 ? (
                            <p className="canvas-muted">Not available</p>
                        ) : (
                            <ul>
                                {evidenceList.map((ev: any, idx: number) => (
                                    <li key={`${ev.url || ev.filename}-${idx}`}>
                                        <strong>{ev.description || ev.title || ev.filename || ev.type || 'Evidence'}</strong>
                                        <span>{ev.claim_number || ev.section || ev.file_path || 'Not available'}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="evidence-block">
                        <h5>SQL</h5>
                        {sqlPlan.length > 0 ? (
                            <details className="canvas-details">
                                <summary>View SQL plan</summary>
                                {(sqlPlan as Array<{ id: string; sql: string; params?: Record<string, any> }>).map((item) => (
                                    <pre key={item.id}>{item.sql}</pre>
                                ))}
                            </details>
                        ) : (
                            <p className="canvas-muted">Not available</p>
                        )}
                    </div>
                </div>
            </details>
        )
    }

    const renderCanvas = () => {
        if (canvasMode === 'empty') {
            return (
                <div className="canvas-empty">
                    <h3>Ready to generate intelligence?</h3>
                    <p>Ask a question to generate your first insight.</p>
                </div>
            )
        }

        if (canvasMode === 'analysis') {
            // For UNDERSTAND intent, check if we should show the full summary card
            // If not, show a minimal conversational view
            if (!showCanvasSummary) {
                return (
                    <div className="canvas-stack">
                        <div className="canvas-card">
                            <div className="canvas-card-header">
                                <div>
                                    <h3>Conversation</h3>
                                    <p>Natural language analysis</p>
                                </div>
                            </div>
                            <div className="canvas-card-body">
                                <div className="conversation-view">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {canvasNarrative || 'RiskMind is analyzing your request...'}
                                    </ReactMarkdown>
                                </div>
                                {/* Show evidence panel if available */}
                                {(analysisEvidence.length > 0 || provenance) && renderEvidencePanel()}
                            </div>
                        </div>
                    </div>
                )
            }

            // Full summary card with KPIs (when show_canvas_summary is true)
            const summaryBullets = [
                analysisMetrics.policy_count ? `Portfolio includes ${analysisMetrics.policy_count} policies.` : null,
                analysisMetrics.total_premium ? `Total premium ${formatCurrency(analysisMetrics.total_premium)}.` : null,
                analysisMetrics.total_amount ? `Total claims ${formatCurrency(analysisMetrics.total_amount)}.` : null,
                analysisMetrics.loss_ratio ? `Loss ratio ${analysisMetrics.loss_ratio}% across ${claimsCount} claim(s).` : null,
                analysisMetrics.avg_amount ? `Average claim ${formatCurrency(analysisMetrics.avg_amount)}.` : null,
                analysisMetrics.max_claim ? `Largest claim ${formatCurrency(analysisMetrics.max_claim)}.` : null,
                claimsTotal ? `Total loss ${formatCurrency(claimsTotal)}.` : null,
                topAlert?.message ? `Alert: ${topAlert.message}` : null,
                analysisEvidence.length ? `${analysisEvidence.length} evidence item(s) linked.` : null,
            ].filter(Boolean) as string[]
            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Summary</h3>
                                <p>Decision intelligence in KPIs and drivers.</p>
                            </div>
                            <button className="btn btn-secondary" onClick={() => saveArtifact('summary', 'Summary insight', { metrics: analysisMetrics, dimensions: analysisDimensions, bullets: summaryBullets })}>
                                Save
                            </button>
                        </div>
                        <div className="canvas-card-body">
                            <div className="summary-kpis">
                                <div>
                                    <span>Policy</span>
                                    <strong>{analysisDimensions.policy_number || activePolicy || 'Not available'}</strong>
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
                                    <strong>{analysisMetrics.loss_ratio ? `${analysisMetrics.loss_ratio}%` : 'Not available'}</strong>
                                </div>
                            </div>
                            <div className="summary-drivers">
                                <h4>Key drivers</h4>
                                {summaryBullets.length === 0 ? (
                                    <p className="canvas-muted">Not available</p>
                                ) : (
                                    <ul>
                                        {summaryBullets.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            {renderEvidencePanel()}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'dashboard') {
            const exportDashboard = () => {
                const payload = {
                    widgets: dashboardWidgets,
                    filters: dashboardFilters,
                    snapshot: new Date().toISOString(),
                }
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `riskmind-dashboard-${Date.now()}.json`
                link.click()
                URL.revokeObjectURL(url)
            }

            const handleRemoveWidget = (id: string) => {
                setDashboardWidgets(prev => prev.filter(widget => widget.id !== id))
            }

            const handleReplaceWidget = (widget: DashboardWidget) => {
                setWidgetPrompt(widget.title)
                setWidgetDataset(widget.dataset)
                setWidgetMetric(widget.field || '')
                setWidgetGroupBy(widget.groupBy || '')
                setWidgetAgg(widget.agg || 'count')
                setWidgetTypeOverride(widget.type)
                setReplaceWidgetId(widget.id)
            }

            const getWidgetRows = (dataset: DashboardWidget['dataset']) => {
                if (!dashboardCache) return []
                return applyDashboardFilters(dashboardCache.datasets[dataset] || [])
            }

            const renderWidgetBody = (widget: DashboardWidget) => {
                const rows = getWidgetRows(widget.dataset)
                console.log(`[renderWidgetBody] Widget "${widget.title}": dataset=${widget.dataset}, rows count=${rows.length}, type=${widget.type}`)
                const values = widget.field ? rows.map(r => Number(r[widget.field as string] || 0)) : []
                const total = widget.agg === 'sum' ? values.reduce((a, b) => a + b, 0) : widget.agg === 'avg' ? (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0) : rows.length

                if (widget.type === 'kpi') {
                    return <span className="widget-kpi">{total.toLocaleString()}</span>
                }

                if (widget.type === 'table') {
                    const preview = rows.slice(0, 6)
                    const columns = preview[0] ? Object.keys(preview[0]).slice(0, 4) : []
                    return (
                        <div className="widget-table">
                            <table>
                                <thead>
                                    <tr>
                                        {columns.map((col) => (
                                            <th key={col}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((row, idx) => (
                                        <tr key={idx}>
                                            {columns.map((col) => (
                                                <td key={col}>{String((row as any)[col] ?? '')}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }

                if (widget.type === 'timeline') {
                    const timelineRows = rows.slice(0, 6)
                    return (
                        <ul className="widget-timeline">
                            {timelineRows.map((row, idx) => (
                                <li key={idx}>
                                    <span>{row.claim_date || row.created_at || 'Date'}</span>
                                    <strong>{row.claim_number || row.policy_number || row.id || 'Item'}</strong>
                                </li>
                            ))}
                        </ul>
                    )
                }

                const isStringField = widget.field && rows.length > 0 && typeof rows[0][widget.field] === 'string'
                const groupField = widget.groupBy || (isStringField ? widget.field : undefined) || 'claim_type'
                const grouped: Record<string, number> = {}

                // Aggregate based on widget configuration
                rows.forEach((row) => {
                    const key = String(row[groupField] || 'Unknown')
                    let valueToAdd = 1

                    if (widget.agg === 'sum' && widget.field) {
                        valueToAdd = Number(row[widget.field as string] || 0)
                    } else if (widget.agg === 'count') {
                        valueToAdd = 1
                    }

                    grouped[key] = (grouped[key] || 0) + valueToAdd
                })

                // For avg, we need to calculate the average after grouping
                if (widget.agg === 'avg' && widget.field) {
                    const counts: Record<string, number> = {}
                    rows.forEach((row) => {
                        const key = String(row[groupField] || 'Unknown')
                        grouped[key] = (grouped[key] || 0) + Number(row[widget.field as string] || 0)
                        counts[key] = (counts[key] || 0) + 1
                    })
                    Object.keys(grouped).forEach(key => {
                        grouped[key] = counts[key] > 0 ? Math.round(grouped[key] / counts[key]) : 0
                    })
                }

                const chartData = Object.entries(grouped).slice(0, 6).map(([label, value]) => ({ label, value }))

                const CHART_COLORS = ['#FF5A5F', '#60A5FA', '#34D399', '#FDBA74', '#A78BFA', '#FCA5A5', '#38BDF8', '#FB923C']

                if (widget.type === 'bar') {
                    return (
                        <div style={{ width: '100%', height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                                        formatter={(val: any) => [Number(val || 0).toLocaleString(), widget.agg === 'sum' ? 'Amount' : 'Count']}
                                    />
                                    <Bar dataKey="value" fill="#FF5A5F" radius={[4, 4, 0, 0]} animationDuration={800}>
                                        {chartData.map((_entry, idx) => (
                                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )
                }

                if (widget.type === 'pie') {
                    return (
                        <div style={{ width: '100%', height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="label"
                                        cx="50%" cy="50%"
                                        outerRadius={70}
                                        innerRadius={35}
                                        paddingAngle={2}
                                        animationDuration={800}
                                        label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {chartData.map((_entry, idx) => (
                                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                                        formatter={(val: any) => [Number(val || 0).toLocaleString(), 'Value']}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )
                }

                if (widget.type === 'line') {
                    const timeBuckets: Record<string, number> = {}
                    rows.forEach((row) => {
                        const dateValue = row.claim_date || row.created_at || row.effective_date
                        if (!dateValue) return
                        const parsed = new Date(dateValue)
                        if (Number.isNaN(parsed.valueOf())) return
                        const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
                        const value = widget.agg === 'sum' ? Number(row[widget.field || '']) || 0 : 1
                        timeBuckets[key] = (timeBuckets[key] || 0) + value
                    })
                    // Sort time buckets chronologically
                    const series = Object.entries(timeBuckets)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([month, value]) => ({ month, value }))
                    return (
                        <div style={{ width: '100%', height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                                        formatter={(val: any) => [widget.agg === 'sum' ? `$${Number(val || 0).toLocaleString()}` : Number(val || 0).toLocaleString(), widget.agg === 'sum' ? 'Amount' : 'Count']}
                                        labelFormatter={(label) => `Month: ${label}`}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#FF5A5F"
                                        strokeWidth={2}
                                        dot={{ r: 4, fill: '#FF5A5F' }}
                                        activeDot={{ r: 6, stroke: '#FF5A5F', strokeWidth: 2, fill: '#fff' }}
                                        animationDuration={800}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )
                }

                if (widget.type === 'scatter') {
                    const scatterData = rows.slice(0, 30).map((row, idx) => ({
                        x: idx,
                        y: widget.field ? Number(row[widget.field] || 0) : 0,
                        name: row.claim_number || row.policy_number || `#${idx + 1}`,
                    }))
                    return (
                        <div style={{ width: '100%', height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="x" name="Index" tick={{ fontSize: 11 }} />
                                    <YAxis dataKey="y" name="Value" tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                                        formatter={(val: any) => [`$${Number(val || 0).toLocaleString()}`, 'Value']}
                                    />
                                    <Scatter data={scatterData} fill="#FF5A5F" animationDuration={800} />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    )
                }

                // Map widget rendering
                if (widget.type === 'map') {
                    const policies = (dashboardCache?.datasets?.['joined_policies'] || []) as any[]
                    const validPolicies = policies.filter((p: any) => p.latitude && p.longitude)
                    console.log(`[Widget:Map] Rendering map for widget ${widget.id}. Total policies: ${policies.length}, Valid geo policies: ${validPolicies.length}`)
                    if (validPolicies.length === 0) {
                        return <p className="canvas-muted">No geolocation data available for map view. (Policies loaded: {policies.length})</p>
                    }
                    return (
                        <div style={{ width: '100%', height: 320, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Loading map...</div>}>
                                <LazyRiskMap policies={validPolicies} height="320px" />
                            </Suspense>
                        </div>
                    )
                }

                return <p className="canvas-muted">Not available</p>
            }



            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Dashboard</h3>
                                <p>Interactive analytics dashboard — use selectors or NLP to add widgets.</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn-sm" onClick={exportDashboard}>Export</button>
                                <button className="btn-sm" onClick={() => setDashboardWidgets([])}>Clear All</button>
                            </div>
                        </div>
                        <div className="canvas-card-body">
                            {/* Selector Toolbar */}
                            {dashboardCache && (
                                <div className="dashboard-selector-toolbar">
                                    <div className="selector-row">
                                        <div className="selector-group">
                                            <label>Dataset</label>
                                            <select value={widgetDataset} onChange={e => setWidgetDataset(e.target.value)}>
                                                {Object.keys(dashboardCache.datasets).map(ds => (
                                                    <option key={ds} value={ds}>{ds.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="selector-group">
                                            <label>Metric</label>
                                            <select value={widgetMetric} onChange={e => setWidgetMetric(e.target.value)}>
                                                <option value="">— select —</option>
                                                {(dashboardCache.metrics[widgetDataset] || []).map((m: string) => (
                                                    <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="selector-group">
                                            <label>Group By</label>
                                            <select value={widgetGroupBy} onChange={e => setWidgetGroupBy(e.target.value)}>
                                                <option value="">— none —</option>
                                                {(dashboardCache.attributes[widgetDataset] || []).map((a: string) => (
                                                    <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="selector-group">
                                            <label>Chart Type</label>
                                            <select value={widgetTypeOverride} onChange={e => setWidgetTypeOverride(e.target.value as any)}>
                                                <option value="auto">Auto</option>
                                                <option value="bar">Bar Chart</option>
                                                <option value="line">Line / Time Series</option>
                                                <option value="pie">Pie Chart</option>
                                                <option value="scatter">Scatter Plot</option>
                                                <option value="kpi">KPI Card</option>
                                                <option value="table">Table</option>
                                                <option value="timeline">Timeline</option>
                                                <option value="map">Map / Geo</option>
                                            </select>
                                        </div>
                                        <div className="selector-group">
                                            <label>Aggregation</label>
                                            <select value={widgetAgg} onChange={e => setWidgetAgg(e.target.value as any)}>
                                                <option value="count">Count</option>
                                                <option value="sum">Sum</option>
                                                <option value="avg">Average</option>
                                            </select>
                                        </div>
                                        <button className="btn-add-widget" onClick={addWidgetFromSelectors}>+ Add Widget</button>
                                    </div>
                                    {/* Filter Row */}
                                    <div className="selector-row filter-row">
                                        <div className="selector-group">
                                            <label>Filter by Policy</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. COMM-2024-016"
                                                value={dashboardFilters.policy}
                                                onChange={e => setDashboardFilters(prev => ({ ...prev, policy: e.target.value }))}
                                            />
                                        </div>
                                        <div className="selector-group">
                                            <label>Filter by Status</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. approved"
                                                value={dashboardFilters.status}
                                                onChange={e => setDashboardFilters(prev => ({ ...prev, status: e.target.value }))}
                                            />
                                        </div>
                                        <div className="selector-group">
                                            <label>Date Range</label>
                                            <select
                                                value={dashboardFilters.dateRange || ''}
                                                onChange={e => setDashboardFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                                            >
                                                <option value="">All Time</option>
                                                <option value="30d">Last 30 Days</option>
                                                <option value="90d">Last 90 Days</option>
                                                <option value="12m">Last 12 Months</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="canvas-narrative">{canvasNarrative || 'Use the selectors above or NLP prompts to create interactive widgets.'}</p>
                            {dashboardLoading && (
                                <div className="dashboard-loading">
                                    <Loader2 className="spin" /> Loading dashboard data...
                                </div>
                            )}
                            {dashboardError && (
                                <div className="canvas-highlight">
                                    <AlertTriangle />
                                    <div>
                                        <strong>{dashboardError}</strong>
                                        <span>Check backend connectivity and retry.</span>
                                    </div>
                                </div>
                            )}
                            {dashboardData && (
                                <div className="dashboard-widgets">
                                    {dashboardWidgets.length === 0 ? (
                                        <p className="canvas-muted">No widgets yet — use the selectors above or type a prompt like "Show claims by type as a bar chart".</p>
                                    ) : (
                                        <>
                                            {console.log('[Render] Rendering', dashboardWidgets.length, 'widgets')}
                                            {dashboardWidgets.map((widget) => (
                                                <div key={widget.id} className="dashboard-widget-card">
                                                    <div className="dashboard-widget-header">
                                                        <div>
                                                            <strong>{widget.title}</strong>
                                                            {widget.description && <span>{widget.description}</span>}
                                                        </div>
                                                        <div className="widget-actions">
                                                            <button title="Edit" onClick={() => handleReplaceWidget(widget)}>✏️</button>
                                                            <button title="Remove" onClick={() => handleRemoveWidget(widget.id)}>✕</button>
                                                        </div>
                                                    </div>
                                                    {renderWidgetBody(widget)}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )
        }

        if (canvasMode === 'card') {
            const policyId = analysisDimensions.policy_number || activePolicy || topAlert?.policy_number || '—'
            const claimAmount = analysisMetrics.max_claim ?? claimsSummary?.max_claim ?? 0
            const threshold = topAlert?.type === 'severity' ? 100000 : 0
            const delta = threshold ? Math.max(claimAmount - threshold, 0) : 0
            const severity = topAlert?.severity || (claimAmount >= 100000 ? 'critical' : claimAmount >= 50000 ? 'warning' : 'info')
            const confidence = severity === 'critical' ? 92 : severity === 'warning' ? 84 : 76
            const provenanceSnapshot = provenance || analysisObject?.provenance || {}

            const hyperCard = {
                severity,
                insight: topAlert?.message || 'Claim severity exceeds underwriting threshold',
                confidence,
                metrics: [
                    { label: 'Policy', value: policyId },
                    { label: 'Claim', value: formatCurrency(claimAmount) },
                    { label: 'Threshold', value: threshold ? formatCurrency(threshold) : '—' },
                    { label: 'Over', value: threshold ? `+${formatCurrency(delta)}` : '—' },
                ],
                drivers: [
                    topAlert?.guideline_ref ? { label: 'Severity Breach', ref: topAlert.guideline_ref } : null,
                    analysisMetrics.loss_ratio ? { label: 'Loss Ratio', ref: `Loss ratio ${analysisMetrics.loss_ratio}%` } : null,
                ].filter(Boolean) as Array<{ label: string; ref: string }>,
                evidence: (analysisEvidence.length ? analysisEvidence : evidenceItems).slice(0, 5).map((ev: any) => ({
                    type: ev.type === 'pdf' ? 'PDF' : ev.type === 'video' ? 'Video' : ev.type === 'image' ? 'Image' : 'Table',
                    name: ev.title || ev.filename || ev.description || ev.type || 'Evidence item',
                    key: ev.claim_number ? `claim_number = ${ev.claim_number}` : policyId !== '—' ? `policy_number = ${policyId}` : 'policy_id = —',
                })),
                action: {
                    title: 'Escalate to Senior Underwriter',
                    detail: 'Verify evidence pack and approve exception or apply surcharge.',
                },
                provenance: {
                    tables: (provenanceSnapshot.tables_used || []).join(', ') || '—',
                    joins: (provenanceSnapshot.join_paths || []).join(' | ') || '—',
                    reasoning: provenanceSnapshot.confidence ? `${provenanceSnapshot.confidence}% confidence` : 'summarize',
                    timestamp: provenanceSnapshot.generated_at || new Date().toLocaleString(),
                },
            }

            return (
                <div className="canvas-stack">
                    <div className="hyper-card">
                        <div className="hyper-header">
                            <div className="hyper-title">
                                <span className={`hyper-severity ${hyperCard.severity}`} />
                                <strong>{hyperCard.insight}</strong>
                            </div>
                            <div className="hyper-meta">
                                <span className="hyper-confidence">{hyperCard.confidence}% Confidence</span>
                                <button className="icon-button" onClick={() => saveArtifact('card', hyperCard.insight, hyperCard)} title="Save">
                                    <Pin />
                                </button>
                            </div>
                        </div>

                        <div className="hyper-metrics">
                            {hyperCard.metrics.map((metric) => (
                                <div key={metric.label}>
                                    <span>{metric.label}</span>
                                    <strong>{metric.value}</strong>
                                </div>
                            ))}
                        </div>

                        {hyperCard.drivers.length > 0 && (
                            <div className="hyper-drivers">
                                <h4>Why this matters</h4>
                                <ul>
                                    {hyperCard.drivers.map((driver) => (
                                        <li key={driver.label}>
                                            <strong>{driver.label}</strong>
                                            <span>{driver.ref}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <details className="hyper-evidence">
                            <summary>Evidence trace</summary>
                            {hyperCard.evidence.length === 0 ? (
                                <p className="canvas-muted">No evidence linked yet.</p>
                            ) : (
                                <ul>
                                    {hyperCard.evidence.map((ev: Record<string, any>, idx: number) => (
                                        <li key={`${ev.name}-${idx}`}>
                                            <span>{ev.type}</span>
                                            <span className="hyper-link">{ev.name}</span>
                                            <em>{ev.key}</em>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </details>

                        <div className="hyper-action">
                            <div>
                                <strong>{hyperCard.action.title}</strong>
                                <span>{hyperCard.action.detail}</span>
                            </div>
                            <div className="hyper-action-buttons">
                                <button className="btn btn-secondary" onClick={() => setCanvasMode('analysis')}>
                                    View summary
                                </button>
                            </div>
                        </div>

                        <details className="hyper-footer">
                            <summary>Provenance & audit</summary>
                            <div className="hyper-footer-grid">
                                <div>
                                    <span>Tables</span>
                                    <strong>{hyperCard.provenance.tables}</strong>
                                </div>
                                <div>
                                    <span>Join keys</span>
                                    <strong>{hyperCard.provenance.joins}</strong>
                                </div>
                                <div>
                                    <span>Reasoning</span>
                                    <strong>{hyperCard.provenance.reasoning}</strong>
                                </div>
                                <div>
                                    <span>Timestamp</span>
                                    <strong>{hyperCard.provenance.timestamp}</strong>
                                </div>
                            </div>
                        </details>
                        {renderEvidencePanel()}
                    </div>
                </div>
            )
        }

        if (canvasMode === 'memo') {
            const exportMemo = () => {
                if (!memo) return
                const payload = {
                    memo,
                    context: currentContext,
                    provenance: provenance || analysisObject?.provenance || null,
                }
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `riskmind-memo-${memo.policy_number}-${Date.now()}.json`
                link.click()
                URL.revokeObjectURL(url)
            }

            return (
                <div className="canvas-stack">
                    <div className="canvas-card">
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
                    <div className="canvas-card">
                        <div className="canvas-card-header">
                            <div>
                                <h3>Decision Recommendation</h3>
                                <p>Action-oriented guidance for underwriting decisions.</p>
                            </div>
                            <button className="btn btn-secondary" onClick={() => saveArtifact('decision', 'Decision recommendation', { recommendation, metrics: analysisMetrics })}>
                                Save
                            </button>
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

        return null
    }

    return (
        <div className="riskmind-shell">
            <section className="panel">
                <div className="panel-header">
                    <div className="panel-title">
                        <Bot />
                        <div className="panel-title-text">
                            <span className="panel-title-main">RiskMind</span>
                            <span className="panel-title-sub">Copilot</span>
                        </div>
                    </div>
                </div>
                <div className="panel-body">
                    {suggestedOutputs.length > 0 && (
                        <div className="intent-suggestions">
                            Suggested: {suggestedOutputs.map((mode) => outputLabels[mode as CanvasMode] || mode).join(', ')}
                        </div>
                    )}

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
                                <MessageSquare />
                                <p>Start a conversation to generate intelligence and decisions.</p>
                            </div>
                        )}
                        {messages.map((m) => (
                            <div key={m.id} className={`conversation-bubble ${m.role}`}>
                                <div className="bubble-content">
                                    {m.role === 'assistant' ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                                    ) : (
                                        m.content
                                    )}
                                </div>
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
                                                        // Set the input to the example
                                                        setInput(intentOption.example)
                                                        // Optionally pin the output type
                                                        setSelectedOutputType(intentOption.output_type as any)
                                                        setOutputPinned(true)
                                                        // Send the message
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
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {suggestedOutputs.length > 0 && (
                        <div className="convert-strip">
                            <span>Suggested outputs:</span>
                            <div className="convert-tags">
                                {suggestedOutputs.map((mode) => (
                                    <span key={mode} className="intent-chip static">
                                        {outputLabels[mode as CanvasMode] || mode}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
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
                            Send
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
                            <span>Output Type</span>
                            <strong>{outputLabel}</strong>
                        </div>
                    </div>
                </div>
                <div className="panel-body">
                    <div className="focus-drawer">
                        <div>
                            <h4>Focus Insight</h4>
                            <div className="focus-insight-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{focusInsight}</ReactMarkdown>
                            </div>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setFocusExpanded(prev => !prev)}
                        >
                            {focusExpanded ? 'Collapse' : 'Open details'}
                        </button>
                    </div>
                    {focusExpanded && renderCanvas()}
                </div>
            </section>
        </div>
    )
}
