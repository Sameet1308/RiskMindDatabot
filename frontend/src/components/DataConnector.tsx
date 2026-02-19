import { useState, useEffect, useCallback } from 'react'
import { Database, CheckCircle2, Table2, Loader2, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import apiService from '../services/api'

interface TableInfo {
    table: string
    label: string
    description: string
    rows: number
    columns: number
}

interface ConnectorState {
    phase: 'connecting' | 'schema' | 'ready'
    tables: TableInfo[]
    totalRecords: number
    vectorStore: { guidelines_indexed: number; knowledge_indexed: number; embedding_provider: string }
    dbName: string
    error: string | null
}

const DB_OPTIONS = [
    { id: 'sqlite', label: 'SQLite', active: true },
    { id: 'postgres', label: 'PostgreSQL', active: false },
    { id: 'snowflake', label: 'Snowflake', active: false },
    { id: 'oracle', label: 'Oracle', active: false },
]

const PHASE_STEPS = [
    { key: 'connect', label: 'Connecting to database' },
    { key: 'schema', label: 'Discovering schema' },
    { key: 'index', label: 'Indexing knowledge base' },
    { key: 'ready', label: 'Building context' },
]

export default function DataConnector({ onComplete }: { onComplete: () => void }) {
    const [state, setState] = useState<ConnectorState>({
        phase: 'connecting',
        tables: [],
        totalRecords: 0,
        vectorStore: { guidelines_indexed: 0, knowledge_indexed: 0, embedding_provider: '' },
        dbName: '',
        error: null,
    })
    const [currentStep, setCurrentStep] = useState(0)
    const [showSchema, setShowSchema] = useState(false)
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

    const runConnection = useCallback(async () => {
        // Step 0: connecting
        setCurrentStep(0)
        await new Promise(r => setTimeout(r, 800))
        setCompletedSteps(prev => new Set(prev).add(0))

        // Step 1: discovering schema
        setCurrentStep(1)
        try {
            const data = await apiService.getDataStatus()
            await new Promise(r => setTimeout(r, 600))
            setCompletedSteps(prev => new Set(prev).add(1))

            setState(s => ({
                ...s,
                phase: 'schema',
                tables: data.tables,
                totalRecords: data.total_records,
                vectorStore: data.vector_store,
                dbName: data.database_name,
            }))

            // Step 2: indexing
            setCurrentStep(2)
            await new Promise(r => setTimeout(r, 700))
            setCompletedSteps(prev => new Set(prev).add(2))

            // Step 3: building context
            setCurrentStep(3)
            await new Promise(r => setTimeout(r, 500))
            setCompletedSteps(prev => new Set(prev).add(3))

            setState(s => ({ ...s, phase: 'ready' }))
        } catch {
            setState(s => ({ ...s, error: 'Connection failed. Retrying...' }))
            // Retry once
            await new Promise(r => setTimeout(r, 2000))
            try {
                const data = await apiService.getDataStatus()
                setCompletedSteps(new Set([0, 1, 2, 3]))
                setState({
                    phase: 'ready',
                    tables: data.tables,
                    totalRecords: data.total_records,
                    vectorStore: data.vector_store,
                    dbName: data.database_name,
                    error: null,
                })
            } catch {
                setState(s => ({ ...s, error: 'Unable to connect to backend. Is the server running?' }))
            }
        }
    }, [])

    useEffect(() => { runConnection() }, [runConnection])

    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem('riskmind_user') || '{}')
        } catch { return {} }
    })()

    return (
        <div className="dc-overlay">
            <div className="dc-card animate-slideUp">
                {/* Header */}
                <div className="dc-header">
                    <div className="dc-logo">
                        <Database style={{ width: '1.25rem', height: '1.25rem' }} />
                    </div>
                    <div>
                        <h2 className="dc-title">Data Connector</h2>
                        <p className="dc-subtitle">
                            {user.name ? `Setting up workspace for ${user.name}` : 'Connecting to your data sources'}
                        </p>
                    </div>
                </div>

                {/* Database selector (mock) */}
                <div className="dc-db-selector">
                    {DB_OPTIONS.map(db => (
                        <div key={db.id} className={`dc-db-option${db.active ? ' dc-db-active' : ' dc-db-disabled'}`}>
                            <span className="dc-db-dot" />
                            <span>{db.label}</span>
                        </div>
                    ))}
                </div>

                {/* Progress steps */}
                <div className="dc-steps">
                    {PHASE_STEPS.map((step, i) => {
                        const done = completedSteps.has(i)
                        const active = currentStep === i && !done
                        return (
                            <div key={step.key} className={`dc-step${done ? ' dc-step-done' : ''}${active ? ' dc-step-active' : ''}`}>
                                <div className="dc-step-icon">
                                    {done ? (
                                        <CheckCircle2 style={{ width: '1.125rem', height: '1.125rem', color: '#10b981' }} />
                                    ) : active ? (
                                        <Loader2 style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} className="dc-spinner" />
                                    ) : (
                                        <div className="dc-step-pending" />
                                    )}
                                </div>
                                <span className="dc-step-label">{step.label}</span>
                                {done && step.key === 'connect' && state.dbName && (
                                    <span className="dc-step-meta">{state.dbName}</span>
                                )}
                                {done && step.key === 'schema' && state.tables.length > 0 && (
                                    <span className="dc-step-meta">{state.tables.length} tables found</span>
                                )}
                                {done && step.key === 'index' && state.vectorStore.knowledge_indexed > 0 && (
                                    <span className="dc-step-meta">{state.vectorStore.guidelines_indexed + state.vectorStore.knowledge_indexed} vectors</span>
                                )}
                                {done && step.key === 'ready' && (
                                    <span className="dc-step-meta">{state.totalRecords.toLocaleString()} records</span>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Error */}
                {state.error && (
                    <div className="dc-error">{state.error}</div>
                )}

                {/* Schema preview (expandable) */}
                {state.phase === 'ready' && state.tables.length > 0 && (
                    <div className="dc-schema-section">
                        <button className="dc-schema-toggle" onClick={() => setShowSchema(!showSchema)}>
                            <Table2 style={{ width: '0.875rem', height: '0.875rem' }} />
                            <span>Schema discovered</span>
                            <span className="dc-schema-badge">{state.tables.length} tables</span>
                            {showSchema ? <ChevronUp style={{ width: '0.875rem', height: '0.875rem' }} /> : <ChevronDown style={{ width: '0.875rem', height: '0.875rem' }} />}
                        </button>
                        {showSchema && (
                            <div className="dc-schema-grid">
                                {state.tables.map(t => (
                                    <div key={t.table} className="dc-schema-row">
                                        <span className="dc-schema-name">{t.label}</span>
                                        <span className="dc-schema-desc">{t.description}</span>
                                        <span className="dc-schema-count">{t.rows.toLocaleString()} rows</span>
                                        <span className="dc-schema-cols">{t.columns} cols</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Ready summary + Continue button */}
                {state.phase === 'ready' && !state.error && (
                    <div className="dc-ready">
                        <div className="dc-ready-summary">
                            <div className="dc-ready-item">
                                <span className="dc-ready-num">{state.tables.reduce((s, t) => s + t.rows, 0).toLocaleString()}</span>
                                <span className="dc-ready-label">Records</span>
                            </div>
                            <div className="dc-ready-divider" />
                            <div className="dc-ready-item">
                                <span className="dc-ready-num">{state.tables.length}</span>
                                <span className="dc-ready-label">Tables</span>
                            </div>
                            <div className="dc-ready-divider" />
                            <div className="dc-ready-item">
                                <span className="dc-ready-num">{(state.vectorStore.guidelines_indexed + state.vectorStore.knowledge_indexed).toLocaleString()}</span>
                                <span className="dc-ready-label">AI Indexed</span>
                            </div>
                        </div>

                        <button className="dc-continue-btn" onClick={onComplete}>
                            Continue to RiskMind
                            <ArrowRight style={{ width: '1rem', height: '1rem' }} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
