import { useEffect, useState, useRef } from 'react'
import {
    Bookmark,
    FileText,
    Sparkles,
    Trash2,
    Download,
    ChevronDown,
    ChevronRight,
    Shield,
    FileSignature,
    Scale,
    MessageSquare,
    MapPin,
    BarChart3,
    Layers,
    User,
    Building2,
    Hash,
    Tag,
} from 'lucide-react'
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
    created_at?: string
    // Workbench-specific fields
    timestamp?: string
    policy_number?: string
    policyholder?: string
    data?: Record<string, any>
}

// ── Category definitions ──

type CategoryKey = 'risk_analysis' | 'memos' | 'decisions' | 'conversations' | 'geospatial' | 'analytics' | 'other'

interface CategoryDef {
    key: CategoryKey
    label: string
    icon: any
    color: string
}

const CATEGORIES: CategoryDef[] = [
    { key: 'risk_analysis', label: 'Risk Analysis', icon: Shield, color: '#FF5A5F' },
    { key: 'memos', label: 'Underwriter Memos', icon: FileSignature, color: '#7c3aed' },
    { key: 'decisions', label: 'Decisions', icon: Scale, color: '#f59e0b' },
    { key: 'conversations', label: 'Conversation Insights', icon: MessageSquare, color: '#06b6d4' },
    { key: 'geospatial', label: 'Geospatial Intelligence', icon: MapPin, color: '#10b981' },
    { key: 'analytics', label: 'Analytics', icon: BarChart3, color: '#ec4899' },
    { key: 'other', label: 'Other', icon: Layers, color: '#6b7280' },
]

// ── Helpers ──

const classifyItem = (item: SavedItem): CategoryKey => {
    if (item.id.startsWith('analytics-')) return 'analytics'
    switch (item.type) {
        case 'summary': case 'card': return 'risk_analysis'
        case 'memo': return 'memos'
        case 'decision': return 'decisions'
        case 'narrative': return 'conversations'
        case 'geo_map': return 'geospatial'
        case 'dashboard': return 'other'
        default: return 'other'
    }
}

const getSource = (item: SavedItem): string => {
    if (item.id.startsWith('analytics-')) return 'Analytics'
    if (item.id.startsWith('wb-')) return 'Workbench'
    return 'RiskMind'
}

const getTimestamp = (item: SavedItem): string => {
    const raw = item.created_at || item.timestamp
    if (!raw) return ''
    return new Date(raw).toLocaleString()
}

const extractTags = (item: SavedItem): { label: string; icon: any; color: string }[] => {
    const tags: { label: string; icon: any; color: string }[] = []

    // Policy number
    const policyNum = item.context?.policy_number || item.policy_number || item.artifact?.policy_number || item.data?.policy_number
    if (policyNum) tags.push({ label: policyNum, icon: Hash, color: '#FF5A5F' })

    // Claim number
    const claimNum = item.context?.claim_number || item.artifact?.claim_number
    if (claimNum) tags.push({ label: claimNum, icon: Hash, color: '#f59e0b' })

    // Policyholder
    const holder = item.policyholder || item.artifact?.policyholder_name || item.data?.policyholder_name
    if (holder) tags.push({ label: holder, icon: Building2, color: '#7c3aed' })

    // Source
    const source = getSource(item)
    tags.push({ label: source, icon: Tag, color: source === 'Workbench' ? '#06b6d4' : source === 'Analytics' ? '#ec4899' : '#10b981' })

    // Intent
    if (item.inferred_intent) tags.push({ label: item.inferred_intent, icon: Sparkles, color: '#6366f1' })

    // Saved by
    try {
        const user = JSON.parse(localStorage.getItem('riskmind_user') || '{}')
        if (user.full_name) tags.push({ label: user.full_name, icon: User, color: '#64748b' })
    } catch { /* ignore */ }

    return tags
}

// ── Component ──

export default function SavedIntelligence() {
    const [items, setItems] = useState<SavedItem[]>([])
    const [collapsed, setCollapsed] = useState<Record<CategoryKey, boolean>>({} as any)
    const [filterTag, setFilterTag] = useState<string | null>(null)
    const listRef = useRef<HTMLDivElement>(null)

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

    const toggleCategory = (key: CategoryKey) => {
        setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
    }

    // ── Grouped items ──

    const grouped: Record<CategoryKey, SavedItem[]> = {
        risk_analysis: [], memos: [], decisions: [], conversations: [], geospatial: [], analytics: [], other: [],
    }
    items.forEach(item => {
        const cat = classifyItem(item)
        grouped[cat].push(item)
    })

    // Filter by tag
    const filteredGrouped: Record<CategoryKey, SavedItem[]> = {} as any
    for (const cat of CATEGORIES) {
        if (filterTag) {
            filteredGrouped[cat.key] = grouped[cat.key].filter(item => {
                const tags = extractTags(item)
                return tags.some(t => t.label === filterTag)
            })
        } else {
            filteredGrouped[cat.key] = grouped[cat.key]
        }
    }

    // All unique tags for quick filter
    const allTags = new Map<string, { icon: any; color: string; count: number }>()
    items.forEach(item => {
        extractTags(item).forEach(tag => {
            const existing = allTags.get(tag.label)
            if (existing) {
                existing.count++
            } else {
                allTags.set(tag.label, { icon: tag.icon, color: tag.color, count: 1 })
            }
        })
    })

    const totalFiltered = CATEGORIES.reduce((sum, cat) => sum + filteredGrouped[cat.key].length, 0)

    // ── Render helpers ──

    const renderSummary = (item: SavedItem) => {
        const metrics = item.artifact?.metrics || {}
        const bullets = item.artifact?.bullets || []
        return (
            <div className="si-content-body">
                <div className="si-kpi-row">
                    <div className="si-kpi"><span>Claims</span><strong>{metrics.claim_count ?? 'N/A'}</strong></div>
                    <div className="si-kpi"><span>Total Loss</span><strong>{metrics.total_amount != null ? `$${Number(metrics.total_amount).toLocaleString()}` : 'N/A'}</strong></div>
                    <div className="si-kpi"><span>Loss Ratio</span><strong>{metrics.loss_ratio != null ? `${metrics.loss_ratio}%` : 'N/A'}</strong></div>
                </div>
                {bullets.length > 0 && (
                    <ul className="si-bullets">
                        {bullets.slice(0, 3).map((b: string, i: number) => <li key={i}>{b}</li>)}
                    </ul>
                )}
            </div>
        )
    }

    const renderMemo = (item: SavedItem) => {
        const memo = item.artifact || item.data || {}
        return (
            <div className="si-content-body">
                <p className="si-memo-text">{memo.memo_text || item.content || 'Not available'}</p>
                {memo.recommendation && (
                    <div className="si-memo-rec">
                        <strong>Recommendation:</strong> {memo.recommendation}
                    </div>
                )}
            </div>
        )
    }

    const renderDecision = (item: SavedItem) => {
        const decision = item.artifact?.decision || item.data?.decision || item.artifact?.recommendation
        return (
            <div className="si-content-body">
                <div className="si-decision-badge" data-decision={typeof decision === 'string' ? decision.toLowerCase() : ''}>
                    {decision || item.title}
                </div>
                {item.content && <p className="si-decision-text">{item.content}</p>}
            </div>
        )
    }

    const renderNarrative = (item: SavedItem) => {
        const text = item.content || item.artifact?.content || 'No content available.'
        return (
            <div className="si-content-body si-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text.length > 300 ? text.slice(0, 300) + '...' : text}</ReactMarkdown>
            </div>
        )
    }

    const renderGeoMap = (item: SavedItem) => {
        const text = item.content || item.artifact?.content || 'Geospatial risk analysis snapshot.'
        return (
            <div className="si-content-body">
                <p className="si-geo-meta">{item.artifact?.policy_count || 'N/A'} policies analyzed</p>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text.length > 250 ? text.slice(0, 250) + '...' : text}</ReactMarkdown>
            </div>
        )
    }

    const renderContent = (item: SavedItem) => {
        switch (item.type) {
            case 'summary': case 'card': return renderSummary(item)
            case 'memo': return renderMemo(item)
            case 'decision': return renderDecision(item)
            case 'narrative': return renderNarrative(item)
            case 'geo_map': return renderGeoMap(item)
            default:
                return item.content ? (
                    <div className="si-content-body">
                        <p>{item.content.length > 200 ? item.content.slice(0, 200) + '...' : item.content}</p>
                    </div>
                ) : null
        }
    }

    return (
        <div className="si-page animate-fadeIn">
            {/* Header */}
            <div className="si-header">
                <div>
                    <h1 className="si-title">Saved Intelligence</h1>
                    <p className="si-subtitle">{items.length} items saved{filterTag ? ` (filtered by "${filterTag}")` : ''}</p>
                </div>
                <div className="si-header-actions">
                    {items.length > 0 && (
                        <button className="si-export-all-btn" onClick={handleExportAll}>
                            <Download style={{ width: '0.875rem', height: '0.875rem' }} />
                            Export All PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Tag filter bar */}
            {allTags.size > 0 && (
                <div className="si-tag-bar">
                    <button
                        className={`si-tag-filter${!filterTag ? ' si-tag-filter--active' : ''}`}
                        onClick={() => setFilterTag(null)}
                    >
                        All ({items.length})
                    </button>
                    {Array.from(allTags.entries())
                        .sort((a, b) => b[1].count - a[1].count)
                        .slice(0, 12)
                        .map(([label, meta]) => {
                            const Icon = meta.icon
                            return (
                                <button
                                    key={label}
                                    className={`si-tag-filter${filterTag === label ? ' si-tag-filter--active' : ''}`}
                                    onClick={() => setFilterTag(filterTag === label ? null : label)}
                                    style={filterTag === label ? { borderColor: meta.color, color: meta.color } : undefined}
                                >
                                    <Icon style={{ width: '0.6875rem', height: '0.6875rem' }} />
                                    {label}
                                    <span className="si-tag-count">{meta.count}</span>
                                </button>
                            )
                        })}
                </div>
            )}

            {/* Empty state */}
            {items.length === 0 ? (
                <div className="si-empty">
                    <Sparkles style={{ width: '2.5rem', height: '2.5rem', color: 'var(--text-light)' }} />
                    <h3>No saved intelligence yet</h3>
                    <p>Save insights, memos, or decisions from RiskMind, Workbench, or Analytics to see them here.</p>
                </div>
            ) : totalFiltered === 0 ? (
                <div className="si-empty">
                    <h3>No items match this filter</h3>
                    <p>Try a different tag or click "All" to see everything.</p>
                </div>
            ) : (
                <div ref={listRef} className="si-groups">
                    {CATEGORIES.map(cat => {
                        const catItems = filteredGrouped[cat.key]
                        if (catItems.length === 0) return null
                        const Icon = cat.icon
                        const isCollapsed = collapsed[cat.key]

                        return (
                            <div key={cat.key} className="si-group">
                                {/* Group header */}
                                <button className="si-group-header" onClick={() => toggleCategory(cat.key)}>
                                    <div className="si-group-icon" style={{ background: cat.color }}>
                                        <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
                                    </div>
                                    <span className="si-group-label">{cat.label}</span>
                                    <span className="si-group-count">{catItems.length}</span>
                                    {isCollapsed
                                        ? <ChevronRight style={{ width: '1rem', height: '1rem', color: 'var(--text-light)' }} />
                                        : <ChevronDown style={{ width: '1rem', height: '1rem', color: 'var(--text-light)' }} />
                                    }
                                </button>

                                {/* Group items */}
                                {!isCollapsed && (
                                    <div className="si-group-items">
                                        {catItems.map(item => {
                                            const tags = extractTags(item)
                                            return (
                                                <div key={item.id} id={`saved-${item.id}`} className="si-card">
                                                    {/* Card header */}
                                                    <div className="si-card-header">
                                                        <div className="si-card-type" style={{ background: cat.color }}>
                                                            <Icon style={{ width: '0.6875rem', height: '0.6875rem' }} />
                                                        </div>
                                                        <div className="si-card-title-row">
                                                            <strong className="si-card-title">{item.title}</strong>
                                                            <span className="si-card-time">{getTimestamp(item)}</span>
                                                        </div>
                                                        <div className="si-card-actions">
                                                            <button
                                                                className="si-card-action"
                                                                onClick={() => handleExportItem(item.id)}
                                                                title="Export PDF"
                                                            >
                                                                <Download style={{ width: '0.75rem', height: '0.75rem' }} />
                                                            </button>
                                                            <button
                                                                className="si-card-action si-card-action--delete"
                                                                onClick={() => removeItem(item.id)}
                                                                title="Delete"
                                                            >
                                                                <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Tags */}
                                                    <div className="si-card-tags">
                                                        {tags.map((tag, i) => {
                                                            const TIcon = tag.icon
                                                            return (
                                                                <button
                                                                    key={i}
                                                                    className="si-tag"
                                                                    style={{ borderColor: `${tag.color}30`, color: tag.color }}
                                                                    onClick={() => setFilterTag(filterTag === tag.label ? null : tag.label)}
                                                                >
                                                                    <TIcon style={{ width: '0.625rem', height: '0.625rem' }} />
                                                                    {tag.label}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>

                                                    {/* Content preview */}
                                                    {renderContent(item)}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
