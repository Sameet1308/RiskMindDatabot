
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, DollarSign, FileText, AlertTriangle, CheckCircle, Activity, Camera, Video, Shield } from 'lucide-react'
import apiService, { Claim } from '../services/api'

export default function ClaimDetail() {
    const { id } = useParams()
    const [claim, setClaim] = useState<Claim | null>(null)
    const [loading, setLoading] = useState(true)

    // Mock policy info since API doesn't return full deeper join yet
    const [policyInfo, setPolicyInfo] = useState<any>(null)

    useEffect(() => {
        // In a real app, we'd fetch claim by ID. 
        // For POC, we fetch all policies and find the claim.
        const fetchClaim = async () => {
            try {
                const policies = await apiService.getPolicies()
                // Flatten claims
                let foundClaim: Claim | null = null
                let foundPolicy: any = null

                for (const p of policies) {
                    const c = p.claims.find(x => x.id === Number(id))
                    if (c) {
                        foundClaim = c
                        foundPolicy = p
                        break
                    }
                }

                if (foundClaim) {
                    setClaim(foundClaim)
                    setPolicyInfo(foundPolicy)
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchClaim()
    }, [id])

    if (loading) return <div className="p-8 text-center">Loading case file...</div>
    if (!claim) return <div className="p-8 text-center">Claim not found.</div>

    // Parse evidence JSON
    let evidence = []
    try {
        if (claim.evidence_files) {
            evidence = JSON.parse(claim.evidence_files)
        }
    } catch (e) {
        console.error("Failed to parse evidence", e)
    }

    const isHighSev = claim.claim_amount > 50000

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/workbench" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-800">{claim.claim_number}</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${claim.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {claim.status.toUpperCase()}
                            </span>
                            {isHighSev && (
                                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                                    <AlertTriangle className="w-3 h-3" /> HIGH SEVERITY
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 text-sm mt-1">
                            Policy: <span className="font-medium text-slate-700">{policyInfo?.policy_number}</span> • {policyInfo?.policyholder_name}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50">
                        Request Info
                    </button>
                    <button className="px-4 py-2 bg-primary text-white font-medium rounded-lg shadow-lg shadow-primary/30 hover:bg-red-600">
                        {claim.status === 'open' ? 'Approve Reserve' : 'Re-Open Claim'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Key Data */}
                <div className="space-y-6">
                    {/* Financials */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Financials & Loss</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-50 rounded-lg text-green-600">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Incurred Amount</p>
                                        <p className="text-xl font-bold text-slate-800">${claim.claim_amount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full h-px bg-slate-100" />
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Date of Loss</p>
                                    <p className="font-medium text-slate-800">
                                        {new Date(claim.claim_date).toLocaleDateString(undefined, {
                                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Loss Type</p>
                                    <p className="font-medium text-slate-800 capitalize">{claim.claim_type.replace('_', ' ')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* NLP Analysis */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Shield className="w-24 h-24" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Incident Summary</h3>
                        <p className="text-slate-700 leading-relaxed text-sm">
                            {claim.description}
                        </p>
                        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs text-slate-500 font-medium mb-1">RiskMind Analysis</p>
                            <p className="text-xs text-slate-600">
                                Incident aligns with reported loss type. Severity matches financial reserve. No immediate fraud indicators detected in text description.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right: Evidence Wall */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Camera className="w-5 h-5 text-primary" />
                                Evidence Wall
                            </h3>
                            <button className="text-sm text-primary font-medium hover:underline">
                                + Request More Proof
                            </button>
                        </div>

                        {evidence.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {evidence.map((item: any, idx: number) => (
                                    <div key={idx} className="group relative rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                        {item.type === 'video' ? (
                                            <div className="relative aspect-video bg-black flex items-center justify-center">
                                                <video src={item.url} controls className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
                                                <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white flex items-center gap-1">
                                                    <Video className="w-3 h-3" /> VIDEO
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative aspect-video">
                                                <img src={item.url} alt={item.description} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <div className="p-3 bg-white">
                                            <p className="text-sm font-medium text-slate-800">{item.description}</p>
                                            <p className="text-xs text-slate-500 mt-1">Uploaded by Claimant • {new Date(claim.claim_date).toLocaleDateString()}</p>
                                            {item.local_path && (
                                                <p className="text-[11px] text-slate-400 mt-1">Local path: {item.local_path}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50 rounded-xl border-dashed border-2 border-slate-200">
                                <FileText className="w-12 h-12 mb-2 opacity-50" />
                                <p className="font-medium">No media evidence uploaded</p>
                                <p className="text-sm">Standard text-only claim submission</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
