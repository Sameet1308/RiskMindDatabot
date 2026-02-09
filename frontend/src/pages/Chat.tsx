import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User } from 'lucide-react'

interface Message {
    id: number
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

const INITIAL_MESSAGES: Message[] = [
    {
        id: 1,
        role: 'assistant',
        content: "Hello! I'm your RiskMind AI assistant. I can help you with underwriting questions, policy analysis, and guideline interpretations. What would you like to know?",
        timestamp: new Date()
    }
]

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async () => {
        if (!input.trim() || loading) return

        const userMessage: Message = {
            id: Date.now(),
            role: 'user',
            content: input,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setLoading(true)

        // Simulated AI response (mock)
        setTimeout(() => {
            const responses: Record<string, string> = {
                'policy': "I can help you analyze any policy. Just go to the Analyze page and enter a policy number like COMM-2024-001. I'll show you the claims history, risk assessment, and relevant guidelines.",
                'risk': "Risk levels are determined by multiple factors: claim frequency, claim severity, loss ratios, and policy type. Our guidelines define thresholds - for example, 5+ claims annually triggers a HIGH FREQUENCY flag per Section 3.1.1.",
                'guideline': "Our underwriting guidelines cover eligibility, pricing, frequency thresholds, and severity limits. You can browse all guidelines in the Guidelines page, or ask me about specific sections.",
                'claim': "Claims are analyzed based on amount, frequency, and type. A single claim over $100,000 requires senior underwriter review per Section 4.3.2. Multiple smaller claims may indicate a pattern worth investigating.",
            }

            const lowercaseInput = input.toLowerCase()
            let response = "I understand you're asking about underwriting. Could you be more specific? I can help with:\n\n• Policy analysis and risk assessment\n• Understanding underwriting guidelines\n• Claims history interpretation\n• Risk level explanations"

            for (const [key, value] of Object.entries(responses)) {
                if (lowercaseInput.includes(key)) {
                    response = value
                    break
                }
            }

            const assistantMessage: Message = {
                id: Date.now(),
                role: 'assistant',
                content: response,
                timestamp: new Date()
            }

            setMessages(prev => [...prev, assistantMessage])
            setLoading(false)
        }, 1000)
    }

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">AI Chat Assistant</h1>
                    <p className="page-subtitle">Ask questions about policies, guidelines, and risk assessment</p>
                </div>
            </div>

            {/* Chat Container */}
            <div className="chat-container">
                {/* Messages */}
                <div className="chat-messages">
                    {messages.map((message) => (
                        <div key={message.id} className={`chat-message ${message.role}`}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                <div style={{
                                    width: '2rem',
                                    height: '2rem',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: message.role === 'assistant' ? 'var(--primary)' : 'transparent',
                                    flexShrink: 0
                                }}>
                                    {message.role === 'assistant' ? (
                                        <Bot style={{ width: '1rem', height: '1rem', color: 'white' }} />
                                    ) : (
                                        <User style={{ width: '1rem', height: '1rem', color: 'white' }} />
                                    )}
                                </div>
                                <div style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{message.content}</div>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="chat-message assistant">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 1s linear infinite' }} />
                                <span>Thinking...</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="chat-input-container">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about policies, risk assessment, or guidelines..."
                        className="chat-input"
                        disabled={loading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="btn btn-primary"
                        style={{ padding: '0.875rem 1.25rem' }}
                    >
                        <Send style={{ width: '1.125rem', height: '1.125rem' }} />
                    </button>
                </div>
            </div>
        </div>
    )
}
