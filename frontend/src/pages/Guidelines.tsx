import { useState, useEffect } from 'react'
import { Search, FileText, Scale, DollarSign, MapPin, AlertCircle } from 'lucide-react'
import apiService, { Guideline } from '../services/api'

const categoryIcons: Record<string, any> = {
    'eligibility': FileText,
    'pricing': DollarSign,
    'frequency': AlertCircle,
    'severity': Scale,
    'coverage': MapPin,
}

const categoryColors: Record<string, string> = {
    'eligibility': 'blue',
    'pricing': 'green',
    'frequency': 'amber',
    'severity': 'red',
    'coverage': 'purple',
}

export default function Guidelines() {
    const [guidelines, setGuidelines] = useState<Guideline[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadGuidelines()
    }, [])

    const loadGuidelines = async () => {
        try {
            const data = await apiService.getGuidelines()
            setGuidelines(data)
        } catch (err) {
            console.error('Failed to load guidelines:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredGuidelines = guidelines.filter(g => {
        const matchesSearch = !searchQuery ||
            g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.section_code.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = !selectedCategory || g.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    const categories = Array.from(new Set(guidelines.map(g => g.category)))

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Underwriting Guidelines</h1>
                    <p className="page-subtitle">Browse and search company guidelines</p>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="section">
                <div className="card">
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ position: 'relative' }}>
                                <Search style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '1.125rem',
                                    height: '1.125rem',
                                    color: 'var(--text-light)'
                                }} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search guidelines by title, content, or section code..."
                                    className="input-field"
                                    style={{ paddingLeft: '2.75rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={selectedCategory === null ? 'btn btn-primary' : 'btn btn-secondary'}
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                >
                                    All
                                </button>
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={selectedCategory === cat ? 'btn btn-primary' : 'btn btn-secondary'}
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textTransform: 'capitalize' }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Guidelines List */}
            <div className="section">
                {loading ? (
                    <div className="card">
                        <div className="card-body" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <div style={{
                                width: '3rem',
                                height: '3rem',
                                border: '3px solid var(--border)',
                                borderTopColor: 'var(--primary)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto'
                            }} />
                            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading guidelines...</p>
                        </div>
                    </div>
                ) : filteredGuidelines.length === 0 ? (
                    <div className="card">
                        <div className="card-body" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>No guidelines found matching your search.</p>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {filteredGuidelines.map((guideline) => {
                            const IconComponent = categoryIcons[guideline.category] || FileText
                            const color = categoryColors[guideline.category] || 'blue'

                            return (
                                <div key={guideline.id} className="card" style={{ overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                                        <div style={{
                                            width: '4px',
                                            background: color === 'blue' ? '#2563eb' :
                                                color === 'green' ? '#059669' :
                                                    color === 'amber' ? '#d97706' :
                                                        color === 'red' ? '#dc2626' : '#7c3aed'
                                        }} />
                                        <div className="card-body" style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                <div className={`stat-icon ${color}`} style={{ width: '2.5rem', height: '2.5rem', flexShrink: 0 }}>
                                                    <IconComponent style={{ width: '1.25rem', height: '1.25rem' }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                                        <span style={{
                                                            fontFamily: 'monospace',
                                                            fontSize: '0.8125rem',
                                                            fontWeight: 600,
                                                            color: 'var(--primary)',
                                                            background: '#dbeafe',
                                                            padding: '0.25rem 0.625rem',
                                                            borderRadius: '0.375rem'
                                                        }}>
                                                            {guideline.section_code}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            color: 'var(--text-muted)',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.05em'
                                                        }}>
                                                            {guideline.category}
                                                        </span>
                                                    </div>
                                                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
                                                        {guideline.title}
                                                    </h3>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                                                        {guideline.content}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
