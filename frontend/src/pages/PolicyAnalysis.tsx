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
        switch (level) {
            case 'low': return <CheckCircle className="w-10 h-10 text-emerald-400" />
            case 'medium': return <Shield className="w-10 h-10 text-amber-400" />
            case 'high': return <AlertTriangle className="w-10 h-10 text-red-400" />
            case 'refer': return <AlertTriangle className="w-10 h-10 text-purple-400" />
            default: return <Shield className="w-10 h-10 text-slate-400" />
        }
    }

    const getRiskStyles = (level: string) => {
        switch (level) {
            case 'low': return 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5'
            case 'medium': return 'border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-amber-600/5'
            case 'high': return 'border-red-500/50 bg-gradient-to-br from-red-500/10 to-red-600/5'
            case 'refer': return 'border-purple-500/50 bg-gradient-to-br from-purple-500/10 to-purple-600/5'
            default: return 'border-slate-500/50 bg-slate-500/10'
        }
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Policy Risk Analysis</h1>
                <p className="text-slate-400 mt-2 text-lg">Enter a policy number to see full Glass Box analysis</p>
            </div>

            {/* Search Box */}
            <div className="glass-box p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Policy Number</label>
                        <input
                            type="text"
                            value={policyNumber}
                            onChange={(e) => setPolicyNumber(e.target.value)}
                            placeholder="Enter policy number (e.g., COMM-2024-001)"
                            className="input-field"
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => handleAnalyze()}
                            disabled={loading || !policyNumber.trim()}
                            className="btn-primary w-full lg:w-auto"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Search className="w-5 h-5" />
                            )}
                            {loading ? 'Analyzing...' : 'Analyze Risk'}
                        </button>
                    </div>
                </div>

                {/* Quick Select */}
                <div className="mt-5 pt-5 border-t border-slate-700/50">
                    <p className="text-sm text-slate-400 mb-3 font-medium">Quick select demo policies:</p>
                    <div className="flex flex-wrap gap-2">
                        {demoPolicies.map((p) => (
                            <button
                                key={p}
                                onClick={() => {
                                    setPolicyNumber(p)
                                    handleAnalyze(p)
                                }}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm rounded-xl transition-all border border-slate-700 hover:border-blue-500/50 font-medium"
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="glass-box p-5 border-red-500/50 bg-red-500/10">
                    <div className="flex items-center gap-3 text-red-400">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium">{error}</span>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="glass-box p-12 text-center">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto" />
                    <p className="text-slate-400 mt-4 text-lg">Analyzing policy risk...</p>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="space-y-6 animate-fadeIn">
                    {/* Recommendation Banner */}
                    <div className={`glass-box p-6 sm:p-8 border-2 ${getRiskStyles(result.risk_level)}`}>
                        <div className="flex flex-col sm:flex-row items-start gap-5">
                            <div className="p-3 rounded-2xl bg-slate-800/50">
                                {getRiskIcon(result.risk_level)}
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl sm:text-2xl font-bold text-white">{result.recommendation}</h2>
                                <p className="text-slate-300 mt-2 text-lg">{result.reason}</p>
                                <div className="mt-4">
                                    <span className={`risk-badge ${result.risk_level === 'low' ? 'risk-low' :
                                            result.risk_level === 'medium' ? 'risk-medium' :
                                                result.risk_level === 'high' ? 'risk-high' :
                                                    'risk-refer'
                                        }`} style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
                                        Risk Level: {result.risk_level.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Glass Box Evidence */}
                    <div className="glass-box overflow-hidden">
                        <div className="p-5 border-b border-slate-700/50 bg-gradient-to-r from-blue-500/10 to-transparent">
                            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                                <span className="text-2xl">🔍</span> Glass Box Evidence
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">Full transparency into the analysis process</p>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* SQL Query */}
                            <div className="animate-slideIn" style={{ animationDelay: '100ms' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                        <FileCode className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <h4 className="font-semibold text-white text-lg">SQL Query Executed</h4>
                                </div>
                                <div className="code-block whitespace-pre-wrap">
                                    {result.evidence.sql_query}
                                </div>
                            </div>

                            {/* Data Retrieved */}
                            <div className="animate-slideIn" style={{ animationDelay: '200ms' }}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-amber-500/20">
                                        <Database className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <h4 className="font-semibold text-white text-lg">Data Retrieved</h4>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="stat-card">
                                        <p className="text-slate-400 text-sm font-medium">Total Claims</p>
                                        <p className="text-3xl font-bold text-white mt-1">{result.claims_summary.claim_count}</p>
                                    </div>
                                    <div className="stat-card">
                                        <p className="text-slate-400 text-sm font-medium">Total Amount</p>
                                        <p className="text-3xl font-bold text-white mt-1">
                                            ${result.claims_summary.total_amount.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="stat-card">
                                        <p className="text-slate-400 text-sm font-medium">Avg Claim</p>
                                        <p className="text-3xl font-bold text-white mt-1">
                                            ${result.claims_summary.avg_amount.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="stat-card">
                                        <p className="text-slate-400 text-sm font-medium">Max Claim</p>
                                        <p className="text-3xl font-bold text-white mt-1">
                                            ${result.claims_summary.max_claim.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Guideline Citation */}
                            {result.evidence.guideline_citation && (
                                <div className="animate-slideIn" style={{ animationDelay: '300ms' }}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 rounded-lg bg-purple-500/20">
                                            <BookOpen className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <h4 className="font-semibold text-white text-lg">Guideline Citation</h4>
                                    </div>
                                    <div className="glass-box p-5 border-purple-500/30 bg-purple-500/5">
                                        <p className="text-purple-300 font-bold text-lg mb-2">
                                            {result.evidence.guideline_section}
                                        </p>
                                        <p className="text-slate-300 text-lg italic leading-relaxed">
                                            "{result.evidence.guideline_citation}"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
