import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
})

// ──── Interfaces ────

export interface ClaimsSummary {
    total_claims: number
    total_amount: number
    avg_amount: number
    max_claim: number
}

export interface Claim {
    id: number
    policy_id: number
    claim_number: string
    claim_date: string
    claim_amount: number
    claim_type: string
    status: string
    description: string
    evidence_files?: string | null
    created_at: string
}

export interface GlassBoxEvidence {
    sql_query: string
    data_returned: ClaimsSummary
    guideline_citation: string | null
    guideline_section: string | null
}

export interface AnalysisResponse {
    recommendation: string
    risk_level: 'low' | 'medium' | 'high' | 'refer'
    reason: string
    evidence: GlassBoxEvidence
    claims_summary: ClaimsSummary
}

export interface ChatResponse {
    response: string
    sources: { section: string; title: string }[]
    provider: string
    session_id: number
    analysis_object?: Record<string, any>
    recommended_modes?: string[]
    default_mode?: string
    provenance?: Provenance
    inferred_intent?: string
    output_type?: string
    suggested_outputs?: string[]
    suggested_prompts?: string[]
    suggested_intents?: Array<{
        label: string
        intent: string
        output_type: string
        example: string
        keywords: string[]
    }>
    clarification_needed?: boolean
    suggest_canvas_view?: boolean
    show_canvas_summary?: boolean
    artifact?: {
        type: string
        data: Record<string, any>
    }
}

export interface Provenance {
    tables_used?: string[]
    join_paths?: string[]
    query_ids?: string[]
    sql_plan?: Array<{ id: string; sql: string; params?: Record<string, any> }>
    citations?: Array<{ type: string; title: string; ref?: string; snippet?: string; url?: string; policy_number?: string }>
    confidence?: number
    confidence_reason_codes?: string[]
    generated_at?: string
}

export interface ChatSession {
    id: number
    title: string
    created_at: string
    updated_at: string
    message_count: number
}

export interface ChatMessageOut {
    id: number
    role: string
    content: string
    file_url: string | null
    sources: string | null
    created_at: string
}

export interface AlertItem {
    id: number
    type: string
    severity: 'critical' | 'warning' | 'info'
    policy_number: string
    policyholder: string
    message: string
    guideline_ref: string | null
    created_at: string
}

export interface AlertsSummary {
    total: number
    critical: number
    warning: number
    info: number
}

export interface PolicyItem {
    policy_number: string
    policyholder_name: string
    industry_type: string
    premium: number
    effective_date: string | null
    expiration_date: string | null
    claim_count: number
    total_claims: number
    loss_ratio: number
    risk_level: string
    claims: Claim[]
}

export interface MemoResponse {
    policy_number: string
    policyholder: string
    industry: string
    premium: number
    memo_date: string
    summary: {
        total_claims: number
        total_amount: number
        avg_claim: number
        max_claim: number
        loss_ratio: number
        risk_level: string
    }
    recommendation: string
    pricing_action: string
    reasons: string[]
    guideline_references: { section: string; text: string }[]
    memo_text: string
}

export interface Guideline {
    id: number
    section_code: string
    title: string
    content: string
    category: string
    policy_number?: string | null
}

export interface GuidelineCreate {
    section_code: string
    title: string
    content: string
    category?: string
    policy_number?: string
    threshold_type?: string
    threshold_value?: number
    action?: string
}

export interface DecisionItem {
    id: number
    policy_number: string
    decision: string
    reason: string | null
    risk_level: string | null
    decided_by: string
    created_at: string
}

export interface UploadResponse {
    file_url: string
    filename: string
    file_type: string
    analysis: string | null
}

export interface EvidenceAnalyzeResponse {
    file_url: string
    file_type: string
    analysis: string | null
}

export interface EvidenceUploadResponse {
    file_url: string
    file_type: string
    analysis: string | null
    claim_id: number
    claim_number: string
    local_path: string
}

export interface DashboardData {
    policies: any[]
    claims: any[]
    guidelines: any[]
    decisions: any[]
    documents: any[]
    chat_sessions: any[]
    chat_messages: any[]
    snapshot: string
}

// ──── API Service ────

export const apiService = {
    // Health
    async getHealth() {
        const response = await api.get('/health')
        return response.data
    },

    // Analysis
    async analyzePolicy(policyNumber: string): Promise<AnalysisResponse> {
        const response = await api.post('/analysis/evaluate', { policy_number: policyNumber })
        return response.data
    },

    async getClaimsSummary(policyNumber: string) {
        const response = await api.get(`/claims/summary/${policyNumber}`)
        return response.data
    },

    async getAllClaims() {
        const response = await api.get('/claims/')
        return response.data
    },

    async getClaimsByPolicy(policyNumber: string): Promise<Claim[]> {
        const response = await api.get(`/claims/policy/${policyNumber}`)
        return response.data
    },

    async analyzeEvidenceUrl(url: string, prompt?: string): Promise<EvidenceAnalyzeResponse> {
        const response = await api.post('/claims/evidence/analyze', { url, prompt })
        return response.data
    },

    async uploadClaimEvidence(claimId: number, file: File, description?: string, prompt?: string): Promise<EvidenceUploadResponse> {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('description', description || '')
        formData.append('user_prompt', prompt || '')
        const response = await api.post(`/claims/${claimId}/evidence/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return response.data
    },

    // Guidelines
    async getGuidelines(category?: string, policyNumber?: string) {
        const params: any = {}
        if (category) params.category = category
        if (policyNumber) params.policy_number = policyNumber
        const response = await api.get('/guidelines/', { params })
        return response.data?.guidelines ?? []
    },

    async searchGuidelines(query: string) {
        const response = await api.get('/guidelines/search', { params: { query } })
        return response.data
    },

    async createGuideline(payload: GuidelineCreate) {
        const response = await api.post('/guidelines/', payload)
        return response.data
    },

    async quickRiskCheck(policyNumber: string) {
        const response = await api.get(`/analysis/quick/${policyNumber}`)
        return response.data
    },

    // Chat — with persistent sessions
    async chat(message: string, sessionId?: number, userEmail: string = 'demo@ltm.com'): Promise<ChatResponse> {
        const response = await api.post('/chat/', {
            message,
            session_id: sessionId || null,
            user_email: userEmail
        })
        return response.data
    },

    async getChatSessions(userEmail: string = 'demo@ltm.com'): Promise<ChatSession[]> {
        const response = await api.get('/chat/sessions', { params: { user_email: userEmail } })
        return response.data
    },

    async getSessionMessages(sessionId: number): Promise<ChatMessageOut[]> {
        const response = await api.get(`/chat/sessions/${sessionId}`)
        return response.data
    },

    async deleteSession(sessionId: number) {
        const response = await api.delete(`/chat/sessions/${sessionId}`)
        return response.data
    },

    // File Upload
    async uploadFile(file: File, userPrompt: string = '', sessionId: number = 0): Promise<UploadResponse> {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('user_prompt', userPrompt)
        formData.append('session_id', sessionId.toString())
        const response = await api.post('/chat/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return response.data
    },

    // Alerts
    async getAlerts(type?: string, severity?: string): Promise<AlertItem[]> {
        const params: any = {}
        if (type) params.type = type
        if (severity) params.severity = severity
        const response = await api.get('/alerts/', { params })
        return response.data
    },

    async getAlertsSummary(): Promise<AlertsSummary> {
        const response = await api.get('/alerts/summary')
        return response.data
    },

    // Policies
    async getPolicies(): Promise<PolicyItem[]> {
        const response = await api.get('/policies/')
        return response.data
    },

    async getPolicy(policyNumber: string) {
        const response = await api.get(`/policies/${policyNumber}`)
        return response.data
    },

    // Memo
    async getMemo(policyNumber: string): Promise<MemoResponse> {
        const response = await api.get(`/memo/${policyNumber}`)
        return response.data
    },

    // Decisions
    async recordDecision(policyNumber: string, decision: string, reason?: string, riskLevel?: string): Promise<DecisionItem> {
        const response = await api.post('/decisions/', {
            policy_number: policyNumber,
            decision,
            reason,
            risk_level: riskLevel
        })
        return response.data
    },

    async getDecisions(policyNumber: string): Promise<DecisionItem[]> {
        const response = await api.get(`/decisions/${policyNumber}`)
        return response.data
    },

    // Vision (camera)
    async visionChat(imageBase64: string, prompt: string = '', sessionId?: number): Promise<ChatResponse> {
        const response = await api.post('/chat/vision', {
            image_base64: imageBase64,
            prompt: prompt || 'Analyze this image in the context of commercial insurance underwriting.',
            session_id: sessionId || null,
            user_email: 'demo@ltm.com'
        })
        return response.data
    },

    // Provider status
    async getProviderInfo() {
        const response = await api.get('/chat/provider')
        return response.data
    },

    // Dashboard
    async getDashboardData(): Promise<DashboardData> {
        const response = await api.get('/dashboard/data')
        return response.data
    },

    // Geo
    async getGeoPolicies(): Promise<any[]> {
        const response = await api.get('/chat/geo/policies')
        return response.data
    },
}

export default apiService
