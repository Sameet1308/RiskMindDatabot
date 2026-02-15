
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, Clock, Briefcase, Activity, CheckCircle, BookOpen } from 'lucide-react'
import apiService, { AlertsSummary } from '../services/api'
import ClaimsChart from './ClaimsChart'

export default function Overview() {
    const [alertsSummary, setAlertsSummary] = useState<AlertsSummary | null>(null)
    const [loading, setLoading] = useState(true)

    // Mock KPI Data (Simulation of "Morning Data Feed")
    const kpis = [
        {
            label: "Loss Ratio (YTD)",
            value: "68.2%",
            trend: "+4.1%",
            status: "critical",
            icon: Activity,
            desc: "Above target (60%). Action required."
        },
        {
            label: "Written Premium",
            value: "$4.2M",
            trend: "+12.5%",
            status: "good",
            icon: TrendingUp,
            desc: "On track to hit Q1 Goal ($5M)."
        },
        {
            label: "Bind Ratio",
            value: "22%",
            trend: "-1.2%",
            status: "warning",
            icon: CheckCircle,
            desc: "Slightly below target (25%)."
        }
    ]

    useEffect(() => {
        const fetch = async () => {
            try {
                const s = await apiService.getAlertsSummary()
                setAlertsSummary(s)
            } catch (e) { console.error(e) }
            finally { setLoading(false) }
        }
        fetch()
    }, [])

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-in fade-in zoom-in duration-500 pb-20 bg-slate-50 min-h-screen font-sans text-slate-900">
            {/* Header */}
            <div className="flex justify-end items-end pb-2 border-b border-slate-200/60 mb-2">
                <div className="text-right">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Good Morning, Alex</h1>
                    <p className="text-slate-500 text-base font-medium mt-1">Here's what's happening in your portfolio.</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 opacity-80">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            {/* 0. Co-Pilot Insight - Clean & Professional */}
            <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center gap-6 relative overflow-hidden group mb-8 shadow-sm">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 pointer-events-none"></div>

                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-indigo-100 shrink-0 relative z-10">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">AI</span>
                    </div>
                </div>
                <div className="flex-1 relative z-10">
                    <h3 className="font-bold text-base text-indigo-900 mb-0.5">Portfolio Intelligence</h3>
                    <p className="text-indigo-800 text-sm leading-relaxed">
                        <strong className="font-semibold">Heads up:</strong> Detected a <span className="border-b-2 border-indigo-300 font-bold">15% loss ratio spike</span> in restaurant renewals.
                        <span className="opacity-75 ml-1">3 policies affected.</span>
                    </p>
                </div>
                <button className="relative z-10 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all shrink-0">
                    View Analysis
                </button>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* 1. KPI Cards - Clean & Minimal */}
                {kpis.map((k, i) => (
                    <div key={i} className="col-span-12 md:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-slate-200 transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${k.status === 'critical' ? 'bg-rose-50 text-rose-600' : k.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    <k.icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{k.label}</h3>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${k.trend.startsWith('+') && k.status === 'critical' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {k.trend} {k.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            </span>
                        </div>
                        <div>
                            <p className="text-4xl font-extrabold text-slate-900 tracking-tight -ml-1 text-slate-900/90">{k.value}</p>
                            <p className="text-xs text-slate-400 font-medium mt-2 pl-1">{k.desc}</p>
                        </div>
                    </div>
                ))}

                {/* 2. Main Feed (Left Column) */}
                <div className="col-span-12 lg:col-span-8 space-y-6">
                    {/* Urgent Alerts - Spacious List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-rose-500 rounded-full"></div>
                                Action Required
                            </h3>
                            <Link to="/alerts" className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors">See All</Link>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {[
                                { color: 'bg-rose-500', icon: AlertTriangle, title: 'Large Loss: $250k Claim', sub: 'BuildRight Contractors', time: '2h ago', action: 'Review', link: '/claims/30', bg: 'bg-rose-50', text: 'text-rose-600' },
                                { color: 'bg-amber-500', icon: Clock, title: 'Renewal: Restaurant Theme', sub: 'Expiring 15 days', time: 'Today', action: 'Prepare', link: '/workbench', bg: 'bg-amber-50', text: 'text-amber-600' }
                            ].map((item, i) => (
                                <div key={i} className="p-5 hover:bg-slate-50/50 transition-all flex md:items-center gap-5 group cursor-pointer">
                                    <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                                        <item.icon className={`w-5 h-5 ${item.text}`} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">{item.title}</h4>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">{item.sub}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`px-3 py-1.5 ${item.bg} ${item.text} text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0`}>
                                            {item.action}
                                        </span>
                                        <span className="text-[10px] text-slate-300 font-bold">{item.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chart - Clean & Simple */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Loss Trends</h3>
                                <p className="text-xs text-slate-400 font-medium mt-1">6-Month Rolling Analysis</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-extrabold text-slate-900">$357k</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Incurred</div>
                            </div>
                        </div>
                        <ClaimsChart />
                    </div>
                </div>

                {/* 3. Sidebar (Right Column) - Light & Clean */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    {/* My Inbox - Reimagined as Clean White Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                                <span className="p-2 bg-slate-900 rounded-lg text-white"><Briefcase className="w-4 h-4" /></span>
                                My Inbox
                            </h3>
                            <span className="bg-slate-50 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-100">12 Pending</span>
                        </div>

                        <div className="space-y-3">
                            {[
                                { label: 'New Submissions', count: 5, color: 'bg-emerald-500', ring: 'ring-emerald-100' },
                                { label: 'Renewals Due', count: 3, color: 'bg-amber-500', ring: 'ring-amber-100' },
                                { label: 'Claims Review', count: 4, color: 'bg-rose-500', ring: 'ring-rose-100' }
                            ].map((item, i) => (
                                <Link to="/workbench" key={i} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100 group/item">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${item.color} ring-4 ${item.ring}`}></div>
                                        <span className="text-slate-600 text-sm font-bold group-hover/item:text-slate-900 transition-colors">{item.label}</span>
                                    </div>
                                    <span className="text-slate-900 font-bold bg-slate-50 px-2.5 py-0.5 rounded-md min-w-[2rem] text-center text-xs">{item.count}</span>
                                </Link>
                            ))}
                        </div>

                        <Link to="/workbench" className="mt-6 w-full py-3 bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                            Go to Workbench <ArrowUpRight className="w-3 h-3" />
                        </Link>
                    </div>

                    {/* Guidelines - Simple Text */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
                            Latest Guidelines
                        </h3>
                        <div className="space-y-4">
                            <div className="group cursor-pointer">
                                <span className="block font-bold text-slate-900 text-base mb-0.5 group-hover:text-indigo-600 transition-colors">Restaurant Class</span>
                                <p className="text-slate-500 text-xs leading-relaxed">Grease trap warranty updated for 2024 forms.</p>
                            </div>
                            <div className="w-full h-px bg-slate-50"></div>
                            <div className="group cursor-pointer">
                                <span className="block font-bold text-slate-900 text-base mb-0.5 group-hover:text-indigo-600 transition-colors">Construction</span>
                                <p className="text-slate-500 text-xs leading-relaxed">Wood Frame rates increased +5% in coastal zones.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
