import { useEffect, useRef, useState } from 'react'
import {
    LayoutGrid,
    BarChart3,
    TrendingUp,
    Play,
    Plus,
    X,
    Loader2,
    SlidersHorizontal,
    PieChart as PieChartIcon,
    Activity,
    Download,
    FileSpreadsheet,
    MessageSquare,
    Send,
    Bot,
} from 'lucide-react'
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from 'recharts'
import apiService, {
    AnalyticsMeta,
    AnalyticsQueryResult,
} from '../services/api'
import { exportElementAsPdf } from '../utils/exportPdf'

type Viz = 'grid' | 'bar' | 'line' | 'pie' | 'area'

interface FilterRow {
    field: string
    op: string
    values: string[]
}

interface GridPanel {
    id: string
    label: string
    dims: string[]
    metrics: string[]
    filters: FilterRow[]
    result: AnalyticsQueryResult | null
    viz: Viz
    ran: boolean
    loading: boolean
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const CHART_COLORS = ['#FF5A5F', '#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#8b5cf6']

const tooltipStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
}

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

const VIZ_OPTIONS: [Viz, any][] = [
    ['grid', LayoutGrid],
    ['bar', BarChart3],
    ['line', TrendingUp],
    ['pie', PieChartIcon],
    ['area', Activity],
]

export default function Analytics() {
    const gridIdRef = useRef(1)
    const makeGrid = (): GridPanel => {
        const num = gridIdRef.current++
        return {
            id: `grid-${num}`,
            label: `Grid ${num}`,
            dims: [],
            metrics: [],
            filters: [],
            result: null,
            viz: 'grid',
            ran: false,
            loading: false,
        }
    }

    const [meta, setMeta] = useState<AnalyticsMeta | null>(null)
    const [grids, setGrids] = useState<GridPanel[]>(() => [
        { id: 'grid-1', label: 'Grid 1', dims: [], metrics: [], filters: [], result: null, viz: 'grid', ran: false, loading: false },
    ])
    const [activeGridId, setActiveGridId] = useState('grid-1')
    const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({})

    // Chatbot
    const [chatOpen, setChatOpen] = useState(false)
    const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Export ref
    const resultsRef = useRef<HTMLDivElement>(null)

    const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('riskmind_user') || '{}') } catch { return {} }
    })()

    const activeGrid = grids.find(g => g.id === activeGridId)

    useEffect(() => {
        apiService.getAnalyticsMeta().then(setMeta).catch(console.error)
    }, [])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ── Grid CRUD ──

    const addGrid = () => {
        const g = makeGrid()
        setGrids(prev => [...prev, g])
        setActiveGridId(g.id)
    }

    const removeGrid = (id: string) => {
        const remaining = grids.filter(g => g.id !== id)
        if (remaining.length === 0) {
            const g = makeGrid()
            setGrids([g])
            setActiveGridId(g.id)
        } else {
            setGrids(remaining)
            if (id === activeGridId) setActiveGridId(remaining[0].id)
        }
    }

    const updateGrid = (id: string, updates: Partial<GridPanel>) => {
        setGrids(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g))
    }

    // ── Sidebar → active grid ──

    const toggleDim = (key: string) => {
        if (!activeGrid) return
        const dims = activeGrid.dims.includes(key)
            ? activeGrid.dims.filter(d => d !== key)
            : [...activeGrid.dims, key]
        updateGrid(activeGridId, { dims })
    }

    const toggleMetric = (key: string) => {
        if (!activeGrid) return
        const metrics = activeGrid.metrics.includes(key)
            ? activeGrid.metrics.filter(m => m !== key)
            : [...activeGrid.metrics, key]
        updateGrid(activeGridId, { metrics })
    }

    const addFilter = () => {
        if (!activeGrid) return
        const firstAttr = meta?.attributes[0]?.key || 'industry_type'
        updateGrid(activeGridId, {
            filters: [...activeGrid.filters, { field: firstAttr, op: 'in', values: [] }],
        })
    }

    const removeFilter = (idx: number) => {
        if (!activeGrid) return
        updateGrid(activeGridId, {
            filters: activeGrid.filters.filter((_, i) => i !== idx),
        })
    }

    const updateFilterField = async (idx: number, field: string) => {
        if (!activeGrid) return
        updateGrid(activeGridId, {
            filters: activeGrid.filters.map((f, i) => i === idx ? { ...f, field, values: [] } : f),
        })
        if (!filterOptions[field]) {
            try {
                const vals = await apiService.getAnalyticsFilterValues(field)
                setFilterOptions(prev => ({ ...prev, [field]: vals }))
            } catch { /* ignore */ }
        }
    }

    const toggleFilterValue = (idx: number, val: string) => {
        if (!activeGrid) return
        updateGrid(activeGridId, {
            filters: activeGrid.filters.map((f, i) => {
                if (i !== idx) return f
                const vals = f.values.includes(val)
                    ? f.values.filter(v => v !== val)
                    : [...f.values, val]
                return { ...f, values: vals }
            }),
        })
    }

    const canRun = activeGrid ? activeGrid.dims.length > 0 && activeGrid.metrics.length > 0 : false

    const runQuery = async () => {
        if (!activeGrid || !canRun) return
        updateGrid(activeGridId, { loading: true })
        try {
            const data = await apiService.runAnalyticsQuery({
                dimensions: activeGrid.dims,
                metrics: activeGrid.metrics,
                filters: activeGrid.filters.filter(f => f.values.length > 0),
                user_email: currentUser.email,
            })
            updateGrid(activeGridId, { result: data, ran: true, loading: false })
        } catch (err) {
            console.error('Analytics query failed', err)
            updateGrid(activeGridId, { loading: false })
        }
    }

    const labelOf = (key: string): string => {
        const a = meta?.attributes.find(at => at.key === key)
        if (a) return a.label
        const m = meta?.metrics.find(mt => mt.key === key)
        if (m) return m.label
        return key
    }

    // ── Export ──

    const handleExportPdf = () => {
        if (!resultsRef.current) return
        exportElementAsPdf(resultsRef.current, 'riskmind-analytics.pdf')
    }

    const handleExportCsv = () => {
        if (!activeGrid?.result || activeGrid.result.row_count === 0) return
        const r = activeGrid.result
        const headers = r.columns.map(c => labelOf(c))
        const csvRows = [headers.join(',')]
        r.rows.forEach(row => {
            const vals = r.columns.map(col => {
                const v = row[col]
                const s = v == null ? '' : String(v)
                return s.includes(',') ? `"${s}"` : s
            })
            csvRows.push(vals.join(','))
        })
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `riskmind-${activeGrid.label.toLowerCase().replace(/\s+/g, '-')}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // ── Chatbot ──

    const buildContext = (): string => {
        const parts: string[] = []
        grids.forEach(g => {
            if (g.result && g.ran) {
                const dimLabels = g.dims.map(labelOf).join(', ')
                const metLabels = g.metrics.map(labelOf).join(', ')
                const filterCount = g.filters.filter(f => f.values.length > 0).length
                const totalsStr = Object.entries(g.result.totals).map(([k, v]) => `${labelOf(k)}: ${fmtNum(v, k)}`).join(', ')
                parts.push(`[${g.label}: Dims: ${dimLabels}. Metrics: ${metLabels}. ${filterCount} filters. ${g.result.row_count} rows. Totals: ${totalsStr}]`)
            }
        })
        return parts.join(' ')
    }

    const sendChatMessage = async () => {
        const msg = chatInput.trim()
        if (!msg || chatLoading) return
        setChatMessages(prev => [...prev, { role: 'user', content: msg }])
        setChatInput('')
        setChatLoading(true)
        try {
            const context = buildContext()
            const fullMessage = context ? `${context}\nUser question: ${msg}` : msg
            const resp = await apiService.chat(fullMessage, undefined, currentUser.email || 'demo@apexuw.com')
            setChatMessages(prev => [...prev, { role: 'assistant', content: resp.response }])
        } catch {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not process your request.' }])
        } finally {
            setChatLoading(false)
        }
    }

    const activeFilterCount = activeGrid?.filters.filter(f => f.values.length > 0).length || 0

    // ── Render chart/table for a single grid ──

    const renderGridContent = (grid: GridPanel) => {
        if (grid.loading) {
            return (
                <div className="ap-gp-empty">
                    <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite', color: 'var(--text-light)' }} />
                    <span>Running query...</span>
                </div>
            )
        }
        if (!grid.ran) {
            return (
                <div className="ap-gp-empty">
                    <SlidersHorizontal style={{ width: '1.25rem', height: '1.25rem', color: 'var(--text-light)' }} />
                    <span>Select attributes & run query</span>
                </div>
            )
        }
        if (!grid.result || grid.result.row_count === 0) {
            return (
                <div className="ap-gp-empty">
                    <span>No results found</span>
                </div>
            )
        }

        const dims = grid.result.columns.filter(c => grid.dims.includes(c))
        const metricCols = grid.result.columns.filter(c => grid.metrics.includes(c))
        const xKey = dims[0] || ''

        switch (grid.viz) {
            case 'grid':
                return (
                    <div style={{ overflowX: 'auto', flex: 1 }}>
                        <table className="wb-table" style={{ fontSize: '0.8125rem' }}>
                            <thead>
                                <tr>
                                    {grid.result.columns.map(col => (
                                        <th key={col}>{labelOf(col)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {grid.result.rows.map((row, i) => (
                                    <tr key={i}>
                                        {grid.result!.columns.map(col => (
                                            <td key={col}>
                                                {grid.metrics.includes(col) ? fmtNum(row[col], col) : String(row[col] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )

            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={grid.result.rows} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} angle={-30} textAnchor="end" />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                            {metricCols.map((m, idx) => (
                                <Bar key={m} dataKey={m} name={labelOf(m)} radius={[4, 4, 0, 0]} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                )

            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={grid.result.rows} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} angle={-30} textAnchor="end" />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                            {metricCols.map((m, idx) => (
                                <Line key={m} type="monotone" dataKey={m} name={labelOf(m)} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )

            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={grid.result.rows}
                                dataKey={metricCols[0] || 'claim_amount'}
                                nameKey={xKey}
                                cx="50%" cy="50%"
                                innerRadius={40} outerRadius={100}
                                paddingAngle={2}
                                label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${fmtNum(value, metricCols[0])}`}
                            >
                                {grid.result.rows.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                        </PieChart>
                    </ResponsiveContainer>
                )

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={grid.result.rows} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                            <defs>
                                {metricCols.map((m, idx) => (
                                    <linearGradient key={m} id={`ag-${grid.id}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} angle={-30} textAnchor="end" />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                            {metricCols.map((m, idx) => (
                                <Area
                                    key={m} type="monotone" dataKey={m} name={labelOf(m)}
                                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                                    fill={`url(#ag-${grid.id}-${idx})`}
                                    strokeWidth={2}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                )

            default:
                return null
        }
    }

    // ── Layout column calculation ──
    const gridCols = grids.length <= 2
        ? `repeat(${grids.length}, 1fr)`
        : 'repeat(auto-fill, minmax(380px, 1fr))'

    return (
        <div className="ap-layout">
            {/* ── Sidebar ── */}
            <aside className="ap-sidebar">
                <div className="ap-sidebar-header">
                    <SlidersHorizontal style={{ width: '1.125rem', height: '1.125rem' }} />
                    <span>Query Builder</span>
                    {activeGrid && (
                        <span className="ap-sidebar-badge">{activeGrid.label}</span>
                    )}
                </div>

                {/* Dimensions */}
                <div className="ap-section">
                    <h4 className="ap-section-title">Dimensions</h4>
                    {meta?.attributes.map(attr => (
                        <label key={attr.key} className="ap-check-item">
                            <input
                                type="checkbox"
                                checked={activeGrid?.dims.includes(attr.key) || false}
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
                                checked={activeGrid?.metrics.includes(m.key) || false}
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
                        {activeFilterCount > 0 && (
                            <span className="ap-filter-badge">{activeFilterCount}</span>
                        )}
                        <button className="ap-add-btn" onClick={addFilter}>
                            <Plus style={{ width: '0.875rem', height: '0.875rem' }} />
                        </button>
                    </h4>
                    {activeGrid?.filters.map((f, idx) => (
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

                {/* Run Query */}
                <button
                    className="ap-run-btn"
                    disabled={!canRun || (activeGrid?.loading || false)}
                    onClick={runQuery}
                >
                    {activeGrid?.loading ? (
                        <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <Play style={{ width: '1rem', height: '1rem' }} />
                    )}
                    {activeGrid?.loading ? 'Running...' : 'Run Query'}
                </button>
            </aside>

            {/* ── Results — Grid Workspace ── */}
            <main className="ap-results" ref={resultsRef}>
                {/* Toolbar */}
                <div className="ap-toolbar">
                    <h2 className="ap-page-title">Analytics Playground</h2>
                    <div className="ap-toolbar-actions">
                        <button
                            className="ap-export-btn"
                            onClick={handleExportPdf}
                            disabled={!grids.some(g => g.ran)}
                            title="Export as PDF"
                        >
                            <Download style={{ width: '0.875rem', height: '0.875rem' }} />
                            PDF
                        </button>
                        <button
                            className="ap-export-btn"
                            onClick={handleExportCsv}
                            disabled={!activeGrid?.result || activeGrid.result.row_count === 0}
                            title="Export active grid as CSV"
                        >
                            <FileSpreadsheet style={{ width: '0.875rem', height: '0.875rem' }} />
                            CSV
                        </button>
                        <button className="ap-add-grid-btn" onClick={addGrid}>
                            <Plus style={{ width: '1rem', height: '1rem' }} />
                            Add Grid
                        </button>
                    </div>
                </div>

                {/* Grid Workspace */}
                <div className="ap-grid-workspace" style={{ gridTemplateColumns: gridCols }}>
                    {grids.map(grid => (
                        <div
                            key={grid.id}
                            className={`ap-gp${grid.id === activeGridId ? ' ap-gp--active' : ''}`}
                            onClick={() => setActiveGridId(grid.id)}
                        >
                            {/* Panel header */}
                            <div className="ap-gp-header">
                                <span className="ap-gp-label">{grid.label}</span>

                                {/* Per-grid viz toggle */}
                                <div className="ap-gp-viz">
                                    {VIZ_OPTIONS.map(([v, Icon]) => (
                                        <button
                                            key={v}
                                            className={`ap-gp-viz-btn${grid.viz === v ? ' ap-gp-viz-btn--on' : ''}`}
                                            onClick={e => { e.stopPropagation(); updateGrid(grid.id, { viz: v }) }}
                                            title={v.charAt(0).toUpperCase() + v.slice(1)}
                                        >
                                            <Icon style={{ width: '0.8125rem', height: '0.8125rem' }} />
                                        </button>
                                    ))}
                                </div>

                                {grids.length > 1 && (
                                    <button
                                        className="ap-gp-remove"
                                        onClick={e => { e.stopPropagation(); removeGrid(grid.id) }}
                                        title="Remove grid"
                                    >
                                        <X style={{ width: '0.875rem', height: '0.875rem' }} />
                                    </button>
                                )}
                            </div>

                            {/* Selected chips */}
                            {(grid.dims.length > 0 || grid.metrics.length > 0) && (
                                <div className="ap-gp-chips">
                                    {grid.dims.map(d => (
                                        <span key={d} className="ap-gp-chip ap-gp-chip--dim">{labelOf(d)}</span>
                                    ))}
                                    {grid.metrics.map(m => (
                                        <span key={m} className="ap-gp-chip ap-gp-chip--met">{labelOf(m)}</span>
                                    ))}
                                </div>
                            )}

                            {/* Totals strip */}
                            {grid.result && grid.result.row_count > 0 && (
                                <div className="ap-gp-totals">
                                    {grid.result.columns.filter(c => grid.metrics.includes(c)).map(m => (
                                        <div key={m} className="ap-gp-total">
                                            <span className="ap-gp-total-val">{fmtNum(grid.result!.totals[m], m)}</span>
                                            <span className="ap-gp-total-lbl">{labelOf(m)}</span>
                                        </div>
                                    ))}
                                    <div className="ap-gp-total">
                                        <span className="ap-gp-total-val">{grid.result.row_count}</span>
                                        <span className="ap-gp-total-lbl">Rows</span>
                                    </div>
                                </div>
                            )}

                            {/* Content */}
                            <div className="ap-gp-content">
                                {renderGridContent(grid)}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* ── Floating Chatbot ── */}
            {chatOpen && (
                <div className="ap-chat-panel">
                    <div className="ap-chat-header">
                        <Bot style={{ width: '1.125rem', height: '1.125rem' }} />
                        <span>Analytics Assistant</span>
                        <button className="ap-chat-close" onClick={() => setChatOpen(false)}>
                            <X style={{ width: '1rem', height: '1rem' }} />
                        </button>
                    </div>
                    <div className="ap-chat-messages">
                        {chatMessages.length === 0 && (
                            <div className="ap-chat-empty">
                                Ask me anything about your analytics data. I can see your current query context.
                            </div>
                        )}
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`ap-chat-msg ap-chat-msg--${msg.role}`}>
                                {msg.content}
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="ap-chat-msg ap-chat-msg--assistant">
                                <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="ap-chat-input-row">
                        <input
                            className="ap-chat-input"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Ask about your data..."
                        />
                        <button className="ap-chat-send" onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                            <Send style={{ width: '1rem', height: '1rem' }} />
                        </button>
                    </div>
                </div>
            )}
            <button
                className={`ap-chat-fab ${chatOpen ? 'ap-chat-fab--active' : ''}`}
                onClick={() => setChatOpen(prev => !prev)}
                title="Analytics Assistant"
            >
                <MessageSquare style={{ width: '1.375rem', height: '1.375rem' }} />
            </button>
        </div>
    )
}
