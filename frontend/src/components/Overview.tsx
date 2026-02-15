
import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, Briefcase, Activity, CheckCircle } from 'lucide-react'
import apiService, { AlertItem, AlertsSummary, Guideline, PolicyItem, Claim } from '../services/api'
import ClaimsChart from './ClaimsChart'

export default function Overview() {
    const [alertsSummary, setAlertsSummary] = useState<AlertsSummary | null>(null)
    const [alerts, setAlerts] = useState<AlertItem[]>([])
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [guidelines, setGuidelines] = useState<Guideline[]>([])
    const [claims, setClaims] = useState<Claim[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetch = async () => {
            try {
                const [summary, alertList, policyList, guidelineList, claimList] = await Promise.all([
                    apiService.getAlertsSummary(),
                    apiService.getAlerts(),
                    apiService.getPolicies(),
                    apiService.getGuidelines().catch(() => []),
                    apiService.getAllClaims().catch(() => [])
                ])
                setAlertsSummary(summary)
                setAlerts(alertList)
                setPolicies(policyList)
                setGuidelines(Array.isArray(guidelineList) ? guidelineList : [])
                setClaims(claimList)
            } catch (e) { console.error(e) }
            finally { setLoading(false) }
        }
        fetch()
    }, [])

    const totals = useMemo(() => {
        const totalPremium = policies.reduce((sum, p) => sum + (p.premium || 0), 0)
        const totalClaims = policies.reduce((sum, p) => sum + (p.total_claims || 0), 0)
        const lossRatio = totalPremium > 0 ? (totalClaims / totalPremium) * 100 : 0
        return { totalPremium, totalClaims, lossRatio }
    }, [policies])

    const counts = useMemo(() => {
        const now = new Date()
        const daysAgo = (d?: string | null, days: number = 30) => {
            if (!d) return false
            const date = new Date(d)
            const delta = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
            return delta >= 0 && delta <= days
        }
        const expiringSoon = (d?: string | null, days: number = 30) => {
            if (!d) return false
            const date = new Date(d)
            const delta = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            return delta >= 0 && delta <= days
        }

        return {
            newSubmissions: policies.filter(p => daysAgo(p.effective_date)).length,
            renewalsDue: policies.filter(p => expiringSoon(p.expiration_date)).length,
            claimsReview: policies.filter(p => (p.claim_count || 0) > 0).length,
            highRisk: policies.filter(p => p.risk_level === 'high').length,
        }
    }, [policies])

    const kpis = useMemo(() => {
        const lossRatio = totals.lossRatio
        const lossStatus = lossRatio > 65 ? 'critical' : lossRatio > 50 ? 'warning' : 'good'
        const premiumLabel = totals.totalPremium >= 1000000
            ? `$${(totals.totalPremium / 1000000).toFixed(1)}M`
            : `$${totals.totalPremium.toLocaleString()}`

        return [
            {
                label: 'Loss Ratio (YTD)',
                value: `${lossRatio.toFixed(1)}%`,
                trend: alertsSummary ? `${alertsSummary.warning + alertsSummary.critical} alerts` : '—',
                status: lossStatus,
                icon: Activity,
                desc: lossRatio > 0 ? 'Based on total claims vs premium.' : 'No claims data yet.'
            },
            {
                label: 'Written Premium',
                value: premiumLabel,
                trend: `${policies.length} policies`,
                status: 'good',
                icon: TrendingUp,
                desc: 'Total premium across active policies.'
            },
            {
                label: 'High Risk Policies',
                value: counts.highRisk.toString(),
                trend: `${counts.renewalsDue} renewals due`,
                status: counts.highRisk > 0 ? 'warning' : 'good',
                icon: CheckCircle,
                desc: 'Policies flagged as high risk.'
            }
        ]
    }, [alertsSummary, counts, policies.length, totals.lossRatio, totals.totalPremium])

    const topAlert = useMemo(() => alerts[0], [alerts])
    const actionAlerts = useMemo(() => alerts.filter(a => a.severity !== 'info').slice(0, 2), [alerts])

    const chartData = useMemo(() => {
        if (!claims.length) return []

        const claimDates = claims
            .map(c => new Date(c.claim_date))
            .filter(d => !Number.isNaN(d.getTime()))

        if (!claimDates.length) return []

        const latest = new Date(Math.max(...claimDates.map(d => d.getTime())))
        const months: { key: string; label: string; value: number }[] = []

        for (let i = 5; i >= 0; i -= 1) {
            const d = new Date(latest.getFullYear(), latest.getMonth() - i, 1)
            const key = `${d.getFullYear()}-${d.getMonth()}`
            months.push({ key, label: d.toLocaleString(undefined, { month: 'short' }), value: 0 })
        }

        claims.forEach((c) => {
            const date = new Date(c.claim_date)
            if (Number.isNaN(date.getTime())) return
            const key = `${date.getFullYear()}-${date.getMonth()}`
            const entry = months.find(m => m.key === key)
            if (entry) entry.value += c.claim_amount || 0
        })

        return months.map(m => ({
            month: m.label,
            value: m.value,
            label: m.value >= 1000 ? `$${(m.value / 1000).toFixed(0)}k` : `$${m.value.toFixed(0)}`
        }))
    }, [claims])

    const totalIncurred = useMemo(() => (
        chartData.reduce((sum, d) => sum + d.value, 0)
    ), [chartData])

    const trend = useMemo(() => {
        if (chartData.length < 2) return null
        const last = chartData[chartData.length - 1].value
        const prev = chartData[chartData.length - 2].value
        const delta = last - prev
        const pct = prev > 0 ? (delta / prev) * 100 : 0
        return { delta, pct }
    }, [chartData])

    const chartStats = useMemo(() => {
        if (!chartData.length) return null
        const avg = totalIncurred / chartData.length
        const peak = chartData.reduce((max, d) => (d.value > max.value ? d : max), chartData[0])
        return { avg, peak }
    }, [chartData, totalIncurred])

    const anomalies = useMemo(() => (
        alerts.filter(a => a.severity !== 'info').slice(0, 3)
    ), [alerts])

    const recentClaims = useMemo(() => (
        claims
            .map((c) => ({
                ...c,
                parsedDate: new Date(c.claim_date)
            }))
            .filter((c) => !Number.isNaN(c.parsedDate.getTime()))
            .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())
            .slice(0, 3)
    ), [claims])

    const insight = useMemo(() => {
        if (loading) {
            return {
                headline: 'Loading portfolio insights...',
                detail: 'Crunching current policy and claims data.'
            }
        }

        if (topAlert) {
            return {
                headline: topAlert.message,
                detail: `Policy ${topAlert.policy_number} · ${topAlert.policyholder}`
            }
        }

        if (totals.lossRatio > 0) {
            return {
                headline: `Portfolio loss ratio is ${totals.lossRatio.toFixed(1)}%`,
                detail: 'No critical alerts detected in the last review cycle.'
            }
        }

        return {
            headline: 'No active risk alerts detected.',
            detail: 'Import claims data to unlock AI insights.'
        }
    }, [loading, topAlert, totals.lossRatio])

    const chatQuery = (text: string) => `/chat?q=${encodeURIComponent(text)}`

    const buildAlertQuestion = (item: AlertItem) => (
        `Why is policy ${item.policy_number} flagged as ${item.severity} risk? Summarize the drivers and recent claims.`
    )

    const promptChips = useMemo(() => {
        const prompts = [
            'Summarize top emerging risks in the last 30 days.',
            'Which policies are trending toward high risk?',
            `Explain drivers behind the ${totals.lossRatio.toFixed(1)}% loss ratio.`,
            'Show claims that need underwriter review this week.'
        ]

        if (topAlert) {
            prompts.unshift(`Why is policy ${topAlert.policy_number} flagged as ${topAlert.severity} risk?`)
        }

        return prompts.slice(0, 4)
    }, [topAlert, totals.lossRatio])

    const trendClass = (trend: string) => {
        if (trend.startsWith('+')) return 'bg-emerald-50 text-emerald-700'
        if (trend.startsWith('-')) return 'bg-rose-50 text-rose-700'
        return 'bg-slate-100 text-slate-500'
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-7 animate-fadeIn pb-20 bg-slate-50 min-h-screen text-slate-900">
            {/* Header */}
            <div className="flex justify-end items-end pb-2 border-b border-slate-200/60 mb-2">
                <div className="text-right">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Good Morning, Alex</h1>
                    <p className="text-slate-500 text-base font-medium mt-1">Here's what's happening in your portfolio.</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 opacity-80">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* 0. Co-Pilot Insight - Clean & Professional */}
                <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center gap-6 relative overflow-hidden group shadow-sm mb-2">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 pointer-events-none"></div>

                    <div className="bg-white p-2.5 rounded-xl shadow-sm border border-indigo-100 shrink-0 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">AI</span>
                        </div>
                    </div>
                    <div className="flex-1 relative z-10">
                        <h3 className="font-bold text-base text-indigo-900 mb-0.5">Portfolio Intelligence</h3>
                        <p className="text-indigo-800 text-sm leading-relaxed">
                            <strong className="font-semibold">Heads up:</strong> {insight.headline}
                            <span className="opacity-75 ml-1">{insight.detail}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-indigo-700">
                            <span className="px-2.5 py-1 rounded-full bg-white/70 border border-indigo-100">
                                {policies.length} policies
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-white/70 border border-indigo-100">
                                ${totals.totalClaims.toLocaleString()} total claims
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-white/70 border border-indigo-100">
                                {totals.lossRatio.toFixed(1)}% loss ratio
                            </span>
                        </div>
                    </div>
                    <Link
                        to={topAlert ? `/analyze?policy=${topAlert.policy_number}` : '/alerts'}
                        className="relative z-10 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all shrink-0"
                    >
                        View Analysis
                    </Link>
                </div>

                <div className="grid grid-cols-12 gap-6 mt-8">
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
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${trendClass(k.trend)}`}>
                                    {k.trend}
                                    {k.trend.startsWith('+') && <ArrowUpRight className="w-3 h-3" />}
                                    {k.trend.startsWith('-') && <ArrowDownRight className="w-3 h-3" />}
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
                            {loading ? (
                                <div className="p-5 text-sm text-slate-400">Loading alerts...</div>
                            ) : actionAlerts.length === 0 ? (
                                <div className="p-5 text-sm text-slate-400">No action-required alerts right now.</div>
                            ) : (
                                actionAlerts.map((item) => (
                                    <div key={item.id} className="p-5 hover:bg-slate-50/50 transition-all flex md:items-center gap-5 group">
                                        <div className={`w-10 h-10 rounded-xl ${item.severity === 'critical' ? 'bg-rose-50' : 'bg-amber-50'} flex items-center justify-center shrink-0`}>
                                            <AlertTriangle className={`w-5 h-5 ${item.severity === 'critical' ? 'text-rose-600' : 'text-amber-600'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <Link to={`/analyze?policy=${item.policy_number}`} className="block font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">
                                                {item.message}
                                            </Link>
                                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                {item.policyholder} · {item.policy_number}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                                                <Link to={chatQuery(buildAlertQuestion(item))} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                                    Ask bot why
                                                </Link>
                                                <Link to={`/analyze?policy=${item.policy_number}`} className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                                                    Open analysis
                                                </Link>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className={`px-3 py-1.5 ${item.severity === 'critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'} text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0`}>
                                                {item.severity === 'critical' ? 'Review' : 'Prepare'}
                                            </span>
                                            <span className="text-[10px] text-slate-300 font-bold">
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chart - Clean & Simple */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Risk Pulse</h3>
                                <p className="text-xs text-slate-400 font-medium mt-1">AI summary from live claims + alerts</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-extrabold text-slate-900">
                                    {totalIncurred >= 1000 ? `$${(totalIncurred / 1000).toFixed(0)}k` : `$${totalIncurred.toFixed(0)}`}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Incurred</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Loss Heat Strip</div>
                                    <div className="mt-3 flex items-end gap-2">
                                        {chartData.length ? (
                                            chartData.map((d, i) => (
                                                <div key={`${d.month}-${i}`} className="flex-1 flex flex-col items-center gap-2">
                                                    <div
                                                        className={`w-full rounded-md ${i === chartData.length - 1 ? 'bg-indigo-600 shadow-lg shadow-indigo-200' : 'bg-slate-200'}`}
                                                        style={{ height: `${Math.max((d.value / (chartStats?.peak.value || 1)) * 100, 20)}%` }}
                                                    />
                                                    <span className="text-[10px] font-semibold text-slate-400">{d.month}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-slate-400">No claims to chart yet.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Outlook</span>
                                        {trend && (
                                            <span className={`text-[11px] font-semibold ${trend.delta >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {trend.delta >= 0 ? '+' : ''}{trend.pct.toFixed(1)}% MoM
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-slate-700">
                                        Loss Ratio: {totals.lossRatio.toFixed(1)}%
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                                        <div
                                            className={`${totals.lossRatio > 65 ? 'bg-rose-500' : totals.lossRatio > 50 ? 'bg-amber-500' : 'bg-emerald-500'} h-full`}
                                            style={{ width: `${Math.min(totals.lossRatio, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Anomaly Watch</div>
                                    <div className="mt-3 space-y-3">
                                        {loading ? (
                                            <div className="text-xs text-slate-400">Loading anomalies...</div>
                                        ) : anomalies.length === 0 ? (
                                            <div className="text-xs text-slate-400">No critical anomalies detected.</div>
                                        ) : (
                                            anomalies.map((a) => (
                                                <div key={a.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors">
                                                    <div className="text-xs font-semibold text-slate-900">{a.message}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1">{a.policy_number} · {a.policyholder}</div>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                                                        <Link to={`/analyze?policy=${a.policy_number}`} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                                                            Open analysis
                                                        </Link>
                                                        <Link to={chatQuery(buildAlertQuestion(a))} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                                            Ask bot why
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {chartStats && (
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                                            <div className="text-slate-400 font-semibold uppercase tracking-wide">Monthly Avg</div>
                                            <div className="text-slate-900 font-bold mt-1">
                                                {chartStats.avg >= 1000 ? `$${(chartStats.avg / 1000).toFixed(0)}k` : `$${chartStats.avg.toFixed(0)}`}
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                                            <div className="text-slate-400 font-semibold uppercase tracking-wide">Peak Month</div>
                                            <div className="text-slate-900 font-bold mt-1">
                                                {chartStats.peak.month} · {chartStats.peak.label}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Recent Claim Timeline</div>
                                    <div className="mt-3 space-y-3">
                                        {loading ? (
                                            <div className="text-xs text-slate-400">Loading timeline...</div>
                                        ) : recentClaims.length === 0 ? (
                                            <div className="text-xs text-slate-400">No recent claims to display.</div>
                                        ) : (
                                            recentClaims.map((c) => (
                                                <div key={c.claim_number} className="rounded-lg border border-slate-100 px-3 py-2 bg-white">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-slate-900">{c.claim_number}</span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {c.parsedDate.toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-1">
                                                        ${c.claim_amount.toLocaleString()} · {c.claim_type.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Sidebar (Right Column) - Light & Clean */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    {/* Ask RiskMind - Primary Self-Service Entry */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">Ask RiskMind</h3>
                            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider">Self-Service</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-2">
                            Use the conversational databot to explain risks, summarize trends, or draft analysis from live data.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {promptChips.map((q) => (
                                <Link key={q} to={chatQuery(q)} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                    {q}
                                </Link>
                            ))}
                        </div>
                        <Link to={chatQuery('Summarize top emerging risks in the last 30 days.')} className="mt-5 w-full py-3 bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                            Open DataBot
                        </Link>
                    </div>

                    {/* My Inbox - Reimagined as Clean White Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                                <span className="p-2 bg-slate-900 rounded-lg text-white"><Briefcase className="w-4 h-4" /></span>
                                My Inbox
                            </h3>
                            <span className="bg-slate-50 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-100">
                                {counts.newSubmissions + counts.renewalsDue + counts.claimsReview} Pending
                            </span>
                        </div>

                        <div className="space-y-3">
                            {[
                                { label: 'New Submissions', count: counts.newSubmissions, color: 'bg-emerald-500', ring: 'ring-emerald-100' },
                                { label: 'Renewals Due', count: counts.renewalsDue, color: 'bg-amber-500', ring: 'ring-amber-100' },
                                { label: 'Claims Review', count: counts.claimsReview, color: 'bg-rose-500', ring: 'ring-rose-100' }
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
                            {loading ? (
                                <div className="text-xs text-slate-400">Loading guidelines...</div>
                            ) : guidelines.length === 0 ? (
                                <div className="text-xs text-slate-400">No guidelines available yet.</div>
                            ) : (
                                guidelines.slice(0, 2).map((g, i) => (
                                    <div key={g.id}>
                                        <div className="group cursor-pointer">
                                            <span className="block font-bold text-slate-900 text-base mb-0.5 group-hover:text-indigo-600 transition-colors">
                                                {g.title}
                                            </span>
                                            <p className="text-slate-500 text-xs leading-relaxed">{g.content}</p>
                                        </div>
                                        {i === 0 && <div className="w-full h-px bg-slate-50"></div>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
    )
}
