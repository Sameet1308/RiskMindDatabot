import { useEffect, useState } from 'react'
import {
    LayoutGrid,
    BarChart3,
    TrendingUp,
    Play,
    Plus,
    X,
    Loader2,
    SlidersHorizontal,
} from 'lucide-react'
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts'
import apiService, {
    AnalyticsMeta,
    AnalyticsQueryResult,
} from '../services/api'

type Viz = 'grid' | 'bar' | 'line'

interface FilterRow {
    field: string
    op: string
    values: string[]
}

const CHART_COLORS = ['#FF5A5F', '#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#8b5cf6']

const fmtNum = (v: any, key?: string): string => {
    if (v == null || v === '') return '-'
    const n = Number(v)
    if (isNaN(n)) return String(v)
    if (key === 'loss_ratio') return `${n.toFixed(1)}%`
    if (key === 'premium' || key === 'claim_amount' || key === 'avg_claim' || key === 'max_claim')
        return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    if (key === 'claim_count') return n.toLocaleString()
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    return String(n)
}

export default function Analytics() {
    const [meta, setMeta] = useState<AnalyticsMeta | null>(null)
    const [selDims, setSelDims] = useState<Set<string>>(new Set(['industry_type']))
    const [selMetrics, setSelMetrics] = useState<Set<string>>(new Set(['claim_amount', 'claim_count']))
    const [filters, setFilters] = useState<FilterRow[]>([])
    const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({})
    const [result, setResult] = useState<AnalyticsQueryResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [viz, setViz] = useState<Viz>('grid')
    const [ran, setRan] = useState(false)

    const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('riskmind_user') || '{}') } catch { return {} }
    })()

    useEffect(() => {
        apiService.getAnalyticsMeta().then(setMeta).catch(console.error)
    }, [])

    const toggleDim = (key: string) => {
        setSelDims(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }

    const toggleMetric = (key: string) => {
        setSelMetrics(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }

    const addFilter = () => {
        const firstAttr = meta?.attributes[0]?.key || 'industry_type'
        setFilters(prev => [...prev, { field: firstAttr, op: 'in', values: [] }])
    }

    const removeFilter = (idx: number) => {
        setFilters(prev => prev.filter((_, i) => i !== idx))
    }

    const updateFilterField = async (idx: number, field: string) => {
        setFilters(prev => prev.map((f, i) => i === idx ? { ...f, field, values: [] } : f))
        if (!filterOptions[field]) {
            try {
                const vals = await apiService.getAnalyticsFilterValues(field)
                setFilterOptions(prev => ({ ...prev, [field]: vals }))
            } catch { /* ignore */ }
        }
    }

    const toggleFilterValue = (idx: number, val: string) => {
        setFilters(prev => prev.map((f, i) => {
            if (i !== idx) return f
            const vals = f.values.includes(val)
                ? f.values.filter(v => v !== val)
                : [...f.values, val]
            return { ...f, values: vals }
        }))
    }

    const canRun = selDims.size > 0 && selMetrics.size > 0

    const runQuery = async () => {
        if (!canRun) return
        setLoading(true)
        try {
            const data = await apiService.runAnalyticsQuery({
                dimensions: Array.from(selDims),
                metrics: Array.from(selMetrics),
                filters: filters.filter(f => f.values.length > 0),
                user_email: currentUser.email,
            })
            setResult(data)
            setRan(true)
        } catch (err) {
            console.error('Analytics query failed', err)
        } finally {
            setLoading(false)
        }
    }

    // Label lookup
    const labelOf = (key: string): string => {
        const a = meta?.attributes.find(a => a.key === key)
        if (a) return a.label
        const m = meta?.metrics.find(m => m.key === key)
        if (m) return m.label
        return key
    }

    // Chart data: first dimension as X, first metric as Y
    const dims = result ? result.columns.filter(c => selDims.has(c)) : []
    const metricCols = result ? result.columns.filter(c => selMetrics.has(c)) : []
    const chartXKey = dims[0] || ''
    const chartYKey = metricCols[0] || ''

    return (
        <div className="ap-layout">
            {/* Sidebar */}
            <aside className="ap-sidebar">
                <div className="ap-sidebar-header">
                    <SlidersHorizontal style={{ width: '1.125rem', height: '1.125rem' }} />
                    <span>Query Builder</span>
                </div>

                {/* Dimensions */}
                <div className="ap-section">
                    <h4 className="ap-section-title">Dimensions</h4>
                    {meta?.attributes.map(attr => (
                        <label key={attr.key} className="ap-check-item">
                            <input
                                type="checkbox"
                                checked={selDims.has(attr.key)}
                                onChange={() => toggleDim(attr.key)}
                            />
                            <span>{attr.label}</span>
                        </label>
                    ))}
                </div>

                {/* Metrics */}
                <div className="ap-section">
                    <h4 className="ap-section-title">Measures</h4>
                    {meta?.metrics.map(m => (
                        <label key={m.key} className="ap-check-item">
                            <input
                                type="checkbox"
                                checked={selMetrics.has(m.key)}
                                onChange={() => toggleMetric(m.key)}
                            />
                            <span>{m.label}</span>
                        </label>
                    ))}
                </div>

                {/* Filters */}
                <div className="ap-section">
                    <h4 className="ap-section-title">
                        Filters
                        <button className="ap-add-btn" onClick={addFilter}>
                            <Plus style={{ width: '0.875rem', height: '0.875rem' }} />
                        </button>
                    </h4>
                    {filters.map((f, idx) => (
                        <div key={idx} className="ap-filter-row">
                            <select
                                value={f.field}
                                onChange={e => updateFilterField(idx, e.target.value)}
                                className="ap-filter-select"
                            >
                                {meta?.attributes.map(a => (
                                    <option key={a.key} value={a.key}>{a.label}</option>
                                ))}
                            </select>
                            <button className="ap-filter-remove" onClick={() => removeFilter(idx)}>
                                <X style={{ width: '0.75rem', height: '0.75rem' }} />
                            </button>
                            {filterOptions[f.field] && (
                                <div className="ap-filter-chips">
                                    {filterOptions[f.field].map(val => (
                                        <button
                                            key={val}
                                            className={`ap-chip ${f.values.includes(val) ? 'ap-chip--active' : ''}`}
                                            onClick={() => toggleFilterValue(idx, val)}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Run */}
                <button
                    className="ap-run-btn"
                    disabled={!canRun || loading}
                    onClick={runQuery}
                >
                    {loading ? (
                        <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <Play style={{ width: '1rem', height: '1rem' }} />
                    )}
                    {loading ? 'Running...' : 'Run Query'}
                </button>
            </aside>

            {/* Results */}
            <main className="ap-results">
                {/* Toolbar */}
                <div className="ap-toolbar">
                    <h2 className="ap-page-title">Analytics Playground</h2>
                    <div className="ap-viz-group">
                        {([['grid', LayoutGrid], ['bar', BarChart3], ['line', TrendingUp]] as const).map(([v, Icon]) => (
                            <button
                                key={v}
                                className={`ap-viz-btn ${viz === v ? 'ap-viz-btn--active' : ''}`}
                                onClick={() => setViz(v)}
                                title={v.charAt(0).toUpperCase() + v.slice(1)}
                            >
                                <Icon style={{ width: '1rem', height: '1rem' }} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Totals KPI strip */}
                {result && result.row_count > 0 && (
                    <div className="ap-totals">
                        {metricCols.map(m => (
                            <div key={m} className="ap-total-card">
                                <span className="ap-total-value">{fmtNum(result.totals[m], m)}</span>
                                <span className="ap-total-label">{labelOf(m)}</span>
                            </div>
                        ))}
                        <div className="ap-total-card">
                            <span className="ap-total-value">{result.row_count}</span>
                            <span className="ap-total-label">Rows</span>
                        </div>
                    </div>
                )}

                {/* Content area */}
                {!ran ? (
                    <div className="ap-empty">
                        <SlidersHorizontal style={{ width: '2.5rem', height: '2.5rem', color: 'var(--text-light)' }} />
                        <h3>Build your query</h3>
                        <p>Select dimensions and measures from the sidebar, then click <strong>Run Query</strong> to explore your portfolio data.</p>
                    </div>
                ) : result && result.row_count === 0 ? (
                    <div className="ap-empty">
                        <h3>No results</h3>
                        <p>Try adjusting your filters or dimensions.</p>
                    </div>
                ) : result && viz === 'grid' ? (
                    <div className="wb-table-card" style={{ margin: 0 }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="wb-table">
                                <thead>
                                    <tr>
                                        {result.columns.map(col => (
                                            <th key={col}>{labelOf(col)}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((row, i) => (
                                        <tr key={i}>
                                            {result.columns.map(col => (
                                                <td key={col}>
                                                    {selMetrics.has(col) ? fmtNum(row[col], col) : String(row[col] ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : result && (viz === 'bar' || viz === 'line') ? (
                    <div className="ap-chart-wrap">
                        <ResponsiveContainer width="100%" height={400}>
                            {viz === 'bar' ? (
                                <BarChart data={result.rows} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis
                                        dataKey={chartXKey}
                                        tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                                        angle={-30}
                                        textAnchor="end"
                                    />
                                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.8125rem',
                                        }}
                                    />
                                    {metricCols.map((m, idx) => (
                                        <Bar key={m} dataKey={m} name={labelOf(m)} radius={[4, 4, 0, 0]}>
                                            {result.rows.map((_, i) => (
                                                <Cell key={i} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    ))}
                                </BarChart>
                            ) : (
                                <LineChart data={result.rows} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis
                                        dataKey={chartXKey}
                                        tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                                        angle={-30}
                                        textAnchor="end"
                                    />
                                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.8125rem',
                                        }}
                                    />
                                    {metricCols.map((m, idx) => (
                                        <Line
                                            key={m}
                                            type="monotone"
                                            dataKey={m}
                                            name={labelOf(m)}
                                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                        />
                                    ))}
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                ) : null}
            </main>
        </div>
    )
}
