import { useEffect, useState, useRef } from 'react'
import { Bookmark, FileText, Sparkles, Trash2, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { exportElementAsPdf, exportAllSavedAsPdf } from '../utils/exportPdf'

type SavedItem = {
    id: string
    type: 'summary' | 'card' | 'memo' | 'dashboard' | 'decision' | 'narrative' | 'geo_map'
    title: string
    output_type?: string
    inferred_intent?: string
    context?: {
        policy_number?: string
        claim_number?: string
        submission_id?: string
    }
    artifact?: Record<string, any>
    content?: string
    provenance?: Record<string, any> | null
    created_at: string
}

export default function SavedIntelligence() {
    const [items, setItems] = useState<SavedItem[]>([])
    const listRef = useRef<HTMLDivElement>(null)
    const outputLabels: Record<string, string> = {
        analysis: 'Summary',
        dashboard: 'Dashboard',
        card: 'HyperIntelligence Card',
        memo: 'Underwriter Memo',
        decision: 'Decision Recommendation',
        summary: 'Summary',
        narrative: 'Conversation Insight',
        geo_map: 'Geospatial Intelligence',
    }

    useEffect(() => {
        const raw = localStorage.getItem('riskmind_saved')
        if (raw) {
            try {
                setItems(JSON.parse(raw))
            } catch {
                setItems([])
            }
        }
    }, [])

    const removeItem = (id: string) => {
        const updated = items.filter(item => item.id !== id)
        setItems(updated)
        localStorage.setItem('riskmind_saved', JSON.stringify(updated))
    }

    const handleExportItem = (id: string) => {
        const el = document.getElementById(`saved-${id}`)
        if (el) exportElementAsPdf(el, `riskmind-saved-${id}.pdf`)
    }

    const handleExportAll = () => {
        if (listRef.current) exportAllSavedAsPdf(listRef.current, `riskmind-intelligence-report-${Date.now()}.pdf`)
    }

    const renderSummary = (item: SavedItem) => {
        const metrics = item.artifact?.metrics || {}
        const bullets = item.artifact?.bullets || []
        return (
            <div className="summary-kpis">
                <div>
                    <span>Policy</span>
                    <strong>{item.context?.policy_number || 'Portfolio'}</strong>
                </div>
                <div>
                    <span>Claims</span>
                    <strong>{metrics.claim_count ?? 'N/A'}</strong>
                </div>
                <div>
                    <span>Total Loss</span>
                    <strong>{metrics.total_amount != null ? `$${Number(metrics.total_amount).toLocaleString()}` : 'N/A'}</strong>
                </div>
                <div>
                    <span>Loss Ratio</span>
                    <strong>{metrics.loss_ratio != null ? `${metrics.loss_ratio}%` : 'N/A'}</strong>
                </div>
                {bullets.length > 0 && (
                    <div className="summary-drivers">
                        <h4>Key drivers</h4>
                        <ul>
                            {bullets.map((bullet: string) => (
                                <li key={bullet}>{bullet}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )
    }

    const renderCard = (item: SavedItem) => {
        const card = item.artifact || {}
        return (
            <div className="hyper-card">
                <div className="hyper-header">
                    <div className="hyper-title">
                        <span className={`hyper-severity ${card.severity || 'info'}`} />
                        <strong>{card.insight || item.title}</strong>
                    </div>
                    <div className="hyper-meta">
                        <span className="hyper-confidence">{card.confidence || '\u2014'} Confidence</span>
                    </div>
                </div>
                <div className="hyper-metrics">
                    {(card.metrics || []).map((metric: any) => (
                        <div key={metric.label}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                        </div>
                    ))}
                </div>
                {card.action && (
                    <div className="hyper-action">
                        <div>
                            <strong>{card.action.title}</strong>
                            <span>{card.action.detail}</span>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const renderMemo = (item: SavedItem) => {
        const memo = item.artifact || {}
        return (
            <div className="canvas-memo">
                <h4>{memo.policy_number || item.context?.policy_number || 'Memo'}</h4>
                <div className="memo-section">
                    <h5>Executive Summary</h5>
                    <p>{memo.memo_text || 'Not available'}</p>
                </div>
                <div className="memo-section">
                    <h5>Recommendation</h5>
                    <p>{memo.recommendation || 'Not available'}</p>
                </div>
            </div>
        )
    }

    const renderDashboard = (item: SavedItem) => {
        const widgets = item.artifact?.widgets || []
        return (
            <div className="dashboard-widgets">
                {widgets.length === 0 ? (
                    <p className="canvas-muted">Not available</p>
                ) : (
                    widgets.map((widget: any) => (
                        <div key={widget.id} className="dashboard-widget-card">
                            <div className="dashboard-widget-header">
                                <div>
                                    <strong>{widget.title}</strong>
                                    {widget.description && <span>{widget.description}</span>}
                                </div>
                            </div>
                            <pre className="widget-sql">{widget.sql || 'Not available'}</pre>
                        </div>
                    ))
                )}
            </div>
        )
    }

    const renderDecision = (item: SavedItem) => {
        return (
            <div className="canvas-recommendation">
                <strong>{item.artifact?.recommendation || item.title}</strong>
                <span>Decision guidance snapshot.</span>
            </div>
        )
    }

    const renderNarrative = (item: SavedItem) => {
        const text = item.content || item.artifact?.content || 'No content available.'
        return (
            <div className="conversation-view">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
        )
    }

    const renderGeoMap = (item: SavedItem) => {
        const text = item.content || item.artifact?.content || 'Geospatial risk analysis snapshot.'
        return (
            <div className="conversation-view">
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                    Geospatial Risk Map ({item.artifact?.policy_count || 'N/A'} policies analyzed)
                </p>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
        )
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Saved Intelligence</h1>
                    <p className="page-subtitle">Evidence-backed insights captured from RiskMind Copilot.</p>
                </div>
                {items.length > 0 && (
                    <button className="btn btn-primary" onClick={handleExportAll}>
                        <Download style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} />
                        Export All as PDF
                    </button>
                )}
            </div>

            {items.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <Sparkles style={{ width: '2rem', height: '2rem', color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
                    <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No saved intelligence yet</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Save insight cards or memos from RiskMind to keep them here.</p>
                </div>
            ) : (
                <div ref={listRef} style={{ display: 'grid', gap: '1rem' }}>
                    {items.map((item) => (
                        <div key={item.id} id={`saved-${item.id}`} className="card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Bookmark style={{ width: '1rem', height: '1rem', color: 'var(--primary)' }} />
                                    <strong>{item.title}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                        onClick={() => handleExportItem(item.id)}
                                        title="Export as PDF"
                                    >
                                        <Download style={{ width: '0.75rem', height: '0.75rem' }} />
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#ef4444' }}
                                        onClick={() => removeItem(item.id)}
                                        title="Delete"
                                    >
                                        <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
                                    </button>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleString()}</span>
                                </div>
                            </div>
                            {item.type === 'summary' && renderSummary(item)}
                            {item.type === 'card' && renderCard(item)}
                            {item.type === 'memo' && renderMemo(item)}
                            {item.type === 'dashboard' && renderDashboard(item)}
                            {item.type === 'decision' && renderDecision(item)}
                            {item.type === 'narrative' && renderNarrative(item)}
                            {item.type === 'geo_map' && renderGeoMap(item)}
                            {item.content && !['narrative', 'geo_map'].includes(item.type) && (
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', marginTop: '0.5rem', fontSize: '0.875rem' }}>{item.content}</p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.75rem' }}>
                                <FileText style={{ width: '0.75rem', height: '0.75rem' }} />
                                {outputLabels[item.output_type || item.type] || (item.output_type || item.type).toUpperCase()}
                                {item.context?.policy_number ? ` \u00B7 ${item.context.policy_number}` : ''}
                                {item.context?.claim_number ? ` \u00B7 ${item.context.claim_number}` : ''}
                                {item.context?.submission_id ? ` \u00B7 ${item.context.submission_id}` : ''}
                                {item.inferred_intent ? ` \u00B7 ${item.inferred_intent}` : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
