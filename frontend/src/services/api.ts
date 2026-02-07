import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
})

export interface ClaimsSummary {
    total_claims: number
    total_amount: number
    avg_amount: number
    max_claim: number
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

export interface HealthResponse {
    status: string
    llm_provider: string
    environment: string
}

export const apiService = {
    async getHealth(): Promise<HealthResponse> {
        const response = await api.get('/health')
        return response.data
    },

    async analyzePolicy(policyNumber: string): Promise<AnalysisResponse> {
        const response = await api.post('/analysis/evaluate', {
            policy_number: policyNumber,
        })
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

    async getGuidelines(category?: string) {
        const params = category ? { category } : {}
        const response = await api.get('/guidelines/', { params })
        return response.data
    },

    async searchGuidelines(query: string) {
        const response = await api.get('/guidelines/search', { params: { query } })
        return response.data
    },

    async quickRiskCheck(policyNumber: string) {
        const response = await api.get(`/analysis/quick/${policyNumber}`)
        return response.data
    },
}

export default apiService
