import { useEffect, useState } from 'react'
import { Bookmark, FileText, Sparkles } from 'lucide-react'

type SavedItem = {
    id: string
    type: 'card' | 'memo' | 'dashboard'
    title: string
    policy_number?: string
    content: string
    created_at: string
}

export default function SavedIntelligence() {
    const [items, setItems] = useState<SavedItem[]>([])

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

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Saved Intelligence</h1>
                    <p className="page-subtitle">Evidence-backed insights captured from RiskMind Copilot.</p>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <Sparkles style={{ width: '2rem', height: '2rem', color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
                    <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No saved intelligence yet</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Save insight cards or memos from RiskMind to keep them here.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {items.map((item) => (
                        <div key={item.id} className="card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Bookmark style={{ width: '1rem', height: '1rem', color: 'var(--primary)' }} />
                                    <strong>{item.title}</strong>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleString()}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{item.content}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                <FileText style={{ width: '0.75rem', height: '0.75rem' }} />
                                {item.type.toUpperCase()} {item.policy_number ? `· ${item.policy_number}` : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
