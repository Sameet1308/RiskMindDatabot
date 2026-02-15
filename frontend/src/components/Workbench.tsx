
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, AlertTriangle, FileText, CheckCircle, Search, Filter, Clock, ArrowRight } from 'lucide-react'
import apiService, { PolicyItem } from '../services/api'

export default function MyDesk() {
    const [activeTab, setActiveTab] = useState<'submissions' | 'renewals' | 'claims'>('submissions')
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await apiService.getPolicies()
                setPolicies(data)
            } catch (e) { console.error(e) }
            finally { setLoading(false) }
        }
        fetch()
    }, [])

    // Filter Logic simulating different workflows
    const submissions = policies.filter(p => !p.claim_count).slice(0, 5) // Mock logic: No claims = New Biz? Just for demo.
    const renewals = policies.slice(5, 12) // Mock logic
    const claims = policies.filter(p => p.claim_count > 0).sort((a, b) => b.risk_level === 'critical' ? 1 : -1)

    const renderSubmissionRow = (p: PolicyItem) => (
        <tr key={p.policy_number} className="group hover:bg-slate-50 transition-colors border-b border-slate-50">
            <td className="py-4 px-4 font-mono text-xs text-slate-500">{p.policy_number}</td>
            <td className="py-4 px-4 font-medium text-slate-800">{p.policyholder_name}</td>
            <td className="py-4 px-4 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${p.risk_level === 'low' ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className="text-sm capitalize text-slate-600">{p.industry_type}</span>
            </td>
            <td className="py-4 px-4 text-slate-600">${p.premium.toLocaleString()}</td>
            <td className="py-4 px-4 text-right">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to="/analyze" className="px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 rounded hover:bg-primary/20">
                        AI Score
                    </Link>
                    <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded hover:bg-white">
                        Quote
                    </button>
                </div>
            </td>
        </tr>
    )

    const renderRenewalRow = (p: PolicyItem) => (
        <tr key={p.policy_number} className="group hover:bg-slate-50 transition-colors border-b border-slate-50">
            <td className="py-4 px-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-mono text-xs text-slate-500">{p.policy_number}</span>
            </td>
            <td className="py-4 px-4 font-medium text-slate-800">{p.policyholder_name}</td>
            <td className="py-4 px-4 text-sm text-slate-500">Exp: {new Date(p.expiration_date!).toLocaleDateString()}</td>
            <td className="py-4 px-4">
                <div className="w-full bg-slate-100 rounded-full h-1.5 w-24">
                    <div className={`h-1.5 rounded-full ${p.loss_ratio > 60 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(p.loss_ratio, 100)}%` }} />
                </div>
                <span className="text-xs text-slate-400 mt-1 block">LR: {p.loss_ratio}%</span>
            </td>
            <td className="py-4 px-4 text-right">
                <button className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded hover:bg-slate-700 shadow-sm">
                    Generate Terms
                </button>
            </td>
        </tr>
    )

    const renderClaimRow = (p: PolicyItem) => (
        <tr key={p.policy_number} className="group hover:bg-slate-50 transition-colors border-b border-slate-50 relative">
            <td className="py-4 px-4">
                {p.risk_level === 'critical' || p.total_claims > 100000 ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                ) : (
                    <FileText className="w-5 h-5 text-slate-400" />
                )}
            </td>
            <td className="py-4 px-4">
                <div className="font-bold text-slate-800">{p.policyholder_name}</div>
                <div className="text-xs text-slate-500 font-mono">{p.policy_number}</div>
            </td>
            <td className="py-4 px-4">
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold">{p.claim_count} Open Claims</span>
            </td>
            <td className="py-4 px-4 font-bold text-slate-800">${p.total_claims.toLocaleString()}</td>
            <td className="py-4 px-4 text-right">
                {/* Link to the first claim if available, for demo purposes just linking generally or specifically for Eagle Transport */}
                {p.policyholder_name.includes("Eagle Transport") || p.policyholder_name.includes("BuildRight") ? (
                    <Link to={p.policyholder_name.includes("Eagle") ? "/claims/40" : "/claims/30"} className="px-4 py-2 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100 hover:bg-red-100 shadow-sm">
                        Review Case File
                    </Link>
                ) : (
                    <button className="px-3 py-1.5 text-slate-500 text-xs font-medium hover:text-slate-800">
                        Quick View
                    </button>
                )}
            </td>
        </tr>
    )

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-primary" />
                        My Desk
                    </h1>
                    <p className="text-slate-500 mt-1">Manage your active submission queue and tasks.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search policy or claim..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('submissions')}
                    className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'submissions' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    New Submissions <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">5</span>
                    {activeTab === 'submissions' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
                </button>
                <button
                    onClick={() => setActiveTab('renewals')}
                    className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'renewals' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Renewals Watch <span className="ml-2 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-xs">3</span>
                    {activeTab === 'renewals' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
                </button>
                <button
                    onClick={() => setActiveTab('claims')}
                    className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'claims' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Claims Review <span className="ml-2 bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-xs">4</span>
                    {activeTab === 'claims' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
                </button>
            </div>

            {/* Content Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">Loading inbox...</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <tr>
                                {activeTab === 'submissions' && (
                                    <>
                                        <th className="py-3 px-4">Ref #</th>
                                        <th className="py-3 px-4">Applicant</th>
                                        <th className="py-3 px-4">Industry</th>
                                        <th className="py-3 px-4">Est. Premium</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </>
                                )}
                                {activeTab === 'renewals' && (
                                    <>
                                        <th className="py-3 px-4">Policy #</th>
                                        <th className="py-3 px-4">Insured</th>
                                        <th className="py-3 px-4">Expiration</th>
                                        <th className="py-3 px-4">Performance</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </>
                                )}
                                {activeTab === 'claims' && (
                                    <>
                                        <th className="py-3 px-4 w-12">Alert</th>
                                        <th className="py-3 px-4">Case Details</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">Incurred</th>
                                        <th className="py-3 px-4 text-right">Review</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeTab === 'submissions' && submissions.map(renderSubmissionRow)}
                            {activeTab === 'renewals' && renewals.map(renderRenewalRow)}
                            {activeTab === 'claims' && claims.map(renderClaimRow)}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
