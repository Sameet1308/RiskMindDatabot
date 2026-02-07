import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, AlertTriangle, CheckCircle, FileText, ArrowRight, Sparkles } from 'lucide-react'

const demoPolicies = [
    { number: 'COMM-2024-001', name: 'ABC Manufacturing Inc.', risk: 'low', claims: 2, amount: '$23,500' },
    { number: 'COMM-2024-002', name: 'XYZ Restaurant Group', risk: 'high', claims: 5, amount: '$75,500' },
    { number: 'COMM-2024-003', name: 'SafeBuild Construction', risk: 'refer', claims: 1, amount: '$175,000' },
]

export default function Dashboard() {
    const [hoveredPolicy, setHoveredPolicy] = useState<string | null>(null)

    const getRiskClass = (risk: string) => {
        const classes: Record<string, string> = {
            low: 'risk-low',
            medium: 'risk-medium',
            high: 'risk-high',
            refer: 'risk-refer',
        }
        return classes[risk] || classes.low
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Dashboard</h1>
                    <p className="text-slate-400 mt-2 text-lg">Underwriting risk overview and quick analysis</p>
                </div>
                <Link
                    to="/analyze"
                    className="btn-primary self-start sm:self-auto"
                >
                    <Sparkles className="w-4 h-4" />
                    Analyze Policy
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                            <FileText className="w-7 h-7 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Total Policies</p>
                            <p className="text-3xl font-bold text-white mt-0.5">3</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                            <CheckCircle className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Low Risk</p>
                            <p className="text-3xl font-bold text-white mt-0.5">1</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
                            <TrendingUp className="w-7 h-7 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Medium Risk</p>
                            <p className="text-3xl font-bold text-white mt-0.5">0</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-2xl flex items-center justify-center border border-red-500/30">
                            <AlertTriangle className="w-7 h-7 text-red-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Needs Review</p>
                            <p className="text-3xl font-bold text-white mt-0.5">2</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Policies Table */}
            <div className="glass-box overflow-hidden">
                <div className="p-5 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-transparent">
                    <h2 className="text-xl font-semibold text-white">Demo Policies</h2>
                    <p className="text-sm text-slate-400 mt-1">Click on any policy to run a full risk analysis</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Policy #</th>
                                <th>Policyholder</th>
                                <th className="text-center">Claims</th>
                                <th className="text-right">Total Amount</th>
                                <th className="text-center">Risk Level</th>
                                <th className="text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {demoPolicies.map((policy, index) => (
                                <tr
                                    key={policy.number}
                                    className="cursor-pointer transition-all"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                    onMouseEnter={() => setHoveredPolicy(policy.number)}
                                    onMouseLeave={() => setHoveredPolicy(null)}
                                >
                                    <td>
                                        <span className="font-mono text-blue-400 font-medium">{policy.number}</span>
                                    </td>
                                    <td>
                                        <span className="text-white font-medium">{policy.name}</span>
                                    </td>
                                    <td className="text-center">
                                        <span className="text-slate-300">{policy.claims}</span>
                                    </td>
                                    <td className="text-right">
                                        <span className="text-slate-300 font-medium">{policy.amount}</span>
                                    </td>
                                    <td className="text-center">
                                        <span className={`risk-badge ${getRiskClass(policy.risk)}`}>
                                            {policy.risk}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <Link
                                            to={`/analyze?policy=${policy.number}`}
                                            className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium text-sm transition-colors group"
                                        >
                                            Full Analysis
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Glass Box Info */}
            <div className="glass-box p-6 pulse-glow">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                    <span className="text-2xl">🔍</span>
                    Glass Box Explainability
                </h3>
                <p className="text-slate-300 mb-5 text-lg leading-relaxed">
                    Every risk decision shows exactly <strong className="text-white">what data was queried</strong>,
                    <strong className="text-white"> what the analysis found</strong>, and
                    <strong className="text-white"> which guideline</strong> drove the recommendation.
                </p>
                <div className="code-block">
                    <code>
                        <span className="text-purple-400">SELECT</span> COUNT(*), SUM(claim_amount) <span className="text-purple-400">FROM</span> claims <span className="text-purple-400">WHERE</span> policy_id = ?<br />
                        <span className="text-slate-500">-- Results:</span> <span className="text-amber-400">5 claims</span>, <span className="text-amber-400">$75,500 total</span><br />
                        <span className="text-slate-500">-- Guideline:</span> <span className="text-blue-400">Section 3.1.1 - High Frequency Threshold</span>
                    </code>
                </div>
            </div>
        </div>
    )
}
