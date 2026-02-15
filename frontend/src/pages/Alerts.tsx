import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Info, Filter, RefreshCw, Shield } from 'lucide-react'
import apiService, { AlertItem, AlertsSummary } from '../services/api'

export default function Alerts() {
    const [alerts, setAlerts] = useState<AlertItem[]>([])
    const [summary, setSummary] = useState<AlertsSummary>({ total: 0, critical: 0, warning: 0, info: 0 })
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('')

    useEffect(() => {
        loadAlerts()
    }, [filter])

    const loadAlerts = async () => {
        setLoading(true)
        try {
            const [alertsData, summaryData] = await Promise.all([
                apiService.getAlerts(undefined, filter || undefined),
                apiService.getAlertsSummary()
            ])
            setAlerts(alertsData)
            setSummary(summaryData)
        } catch (err) {
            console.error('Failed to load alerts:', err)
        } finally {
            setLoading(false)
        }
    }

    const severityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertTriangle style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444' }} />
            case 'warning': return <AlertCircle style={{ width: '1.25rem', height: '1.25rem', color: '#f59e0b' }} />
            case 'info': return <Info style={{ width: '1.25rem', height: '1.25rem', color: '#3b82f6' }} />
            default: return <Info style={{ width: '1.25rem', height: '1.25rem' }} />
        }
    }

    const severityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' }
            case 'warning': return { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' }
            case 'info': return { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' }
            default: return { bg: 'transparent', border: 'transparent', text: 'inherit' }
        }
    }

    const typeLabel = (type: string) => {
        switch (type) {
            case 'high_frequency': return 'High Frequency'
            case 'severity': return 'Severity'
            case 'loss_ratio': return 'Loss Ratio'
            case 'aggregate': return 'Aggregate'
            case 'renewal': return 'Renewal'
            default: return type
        }
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Risk Alerts</h1>
                    <p className="page-subtitle">Real-time risk alerts generated from policy and claims data</p>
                </div>
                <button className="btn btn-primary" onClick={loadAlerts} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw style={{ width: '1rem', height: '1rem' }} /> Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <div className="stat-label">Total Alerts</div>
                    <div className="stat-value">{summary.total}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                    <div className="stat-label">Critical</div>
                    <div className="stat-value" style={{ color: '#ef4444' }}>{summary.critical}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div className="stat-label">Warning</div>
                    <div className="stat-value" style={{ color: '#f59e0b' }}>{summary.warning}</div>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <div className="stat-label">Info</div>
                    <div className="stat-value" style={{ color: '#3b82f6' }}>{summary.info}</div>
                </div>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Filter style={{ width: '1rem', height: '1rem', color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Filter:</span>
                {['', 'critical', 'warning', 'info'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                    >
                        {f || 'All'}
                    </button>
                ))}
            </div>

            {/* Alerts List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading alerts...</div>
            ) : alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <Shield style={{ width: '3rem', height: '3rem', color: '#22c55e', margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>No alerts matching your filter. All clear!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {alerts.map(alert => {
                        const colors = severityColor(alert.severity)
                        return (
                            <div key={alert.id} className="card" style={{
                                background: colors.bg,
                                border: `1px solid ${colors.border}`,
                                padding: '1rem 1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                    <div style={{ marginTop: '0.15rem' }}>
                                        {severityIcon(alert.severity)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                                {alert.policy_number}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                {alert.policyholder}
                                            </span>
                                            <span style={{
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '999px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                background: colors.border,
                                                color: colors.text
                                            }}>
                                                {alert.severity}
                                            </span>
                                            <span style={{
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '999px',
                                                fontSize: '0.7rem',
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                {typeLabel(alert.type)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            {alert.message}
                                        </div>
                                        {alert.guideline_ref && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                📖 {alert.guideline_ref}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
