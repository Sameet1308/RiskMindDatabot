import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, BookOpen, Plus, Trash2, Paperclip, MessageSquare, Mic, MicOff, Camera, Volume2, VolumeOff } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import apiService, { ChatSession, ChatMessageOut } from '../services/api'

interface Message {
    id: number
    role: 'user' | 'assistant'
    content: string
    sources?: { section: string; title: string }[]
    file_url?: string | null
    timestamp: Date
}

export default function Chat() {
    const [searchParams] = useSearchParams()
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<number | undefined>(undefined)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [showCamera, setShowCamera] = useState(false)
    const [provider, setProvider] = useState<string>('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const recognitionRef = useRef<any>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => { loadSessions(); loadProvider() }, [])
    useEffect(() => {
        const q = searchParams.get('q')
        if (!q || input.trim()) return
        setInput(q)
    }, [searchParams, input])
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    const loadProvider = async () => {
        try { const info = await apiService.getProviderInfo(); setProvider(info.active_provider) } catch { }
    }

    const loadSessions = async () => {
        try { setSessions(await apiService.getChatSessions()) } catch { }
    }

    const loadSession = async (sessionId: number) => {
        setActiveSessionId(sessionId)
        try {
            const msgs = await apiService.getSessionMessages(sessionId)
            setMessages(msgs.map((m: ChatMessageOut) => ({
                id: m.id, role: m.role as 'user' | 'assistant', content: m.content,
                file_url: m.file_url, sources: m.sources ? JSON.parse(m.sources) : undefined,
                timestamp: new Date(m.created_at)
            })))
        } catch { }
    }

    const startNewChat = () => { setActiveSessionId(undefined); setMessages([]) }

    const deleteSession = async (id: number) => {
        try {
            await apiService.deleteSession(id)
            setSessions(prev => prev.filter(s => s.id !== id))
            if (activeSessionId === id) startNewChat()
        } catch { }
    }

    const handleSend = async () => {
        if (!input.trim() || loading) return
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: input, timestamp: new Date() }])
        const currentInput = input
        setInput('')
        setLoading(true)

        try {
            const response = await apiService.chat(currentInput, activeSessionId)
            if (!activeSessionId) setActiveSessionId(response.session_id)
            const assistantMsg: Message = {
                id: Date.now() + 1, role: 'assistant', content: response.response,
                sources: response.sources, timestamp: new Date()
            }
            setMessages(prev => [...prev, assistantMsg])
            loadSessions()
            if (isSpeaking) speakResponse(response.response)
        } catch {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Connection error.", timestamp: new Date() }])
        } finally { setLoading(false) }
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setLoading(true)
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: `📎 Uploading: ${file.name}`, timestamp: new Date() }])
        try {
            const result = await apiService.uploadFile(file, '', activeSessionId || 0)
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: result.analysis || `Uploaded: ${result.filename}`, timestamp: new Date() }])
        } catch {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Upload failed.", timestamp: new Date() }])
        } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
    }

    // Voice
    const toggleVoice = () => {
        if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SR) { alert('Voice not supported. Use Chrome.'); return }
        const recognition = new SR()
        recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US'
        recognition.onresult = (e: any) => { setInput(e.results[0][0].transcript); setIsListening(false) }
        recognition.onerror = () => setIsListening(false)
        recognition.onend = () => setIsListening(false)
        recognitionRef.current = recognition; recognition.start(); setIsListening(true)
    }

    const speakResponse = (text: string) => {
        const cleaned = text.replace(/[*#_`\[\]()]/g, '').substring(0, 800)
        const u = new SpeechSynthesisUtterance(cleaned); u.rate = 1.0; speechSynthesis.speak(u)
    }

    // Camera
    const toggleCamera = async () => {
        if (showCamera) { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false); return }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            streamRef.current = stream; setShowCamera(true)
            setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 100)
        } catch { alert('Camera access denied.') }
    }

    const captureAndAnalyze = async () => {
        if (!videoRef.current) return; setLoading(true)
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: '📷 Image captured from camera', timestamp: new Date() }])
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
        const b64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
        try {
            const r = await apiService.visionChat(b64, 'Analyze this for insurance underwriting.', activeSessionId)
            if (!activeSessionId) setActiveSessionId(r.session_id)
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: r.response, timestamp: new Date() }])
        } catch {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Vision analysis failed.", timestamp: new Date() }])
        } finally { setLoading(false) }
    }

    const providerBadge = provider === 'gemini' ? '🟢 Gemini' : provider === 'openai' ? '🔵 OpenAI' : '⚪ Mock'

    return (
        <div className="animate-fadeIn" style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 120px)' }}>
            {/* Session Sidebar */}
            <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>History</h3>
                    <button onClick={startNewChat} className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
                        <Plus style={{ width: '0.75rem', height: '0.75rem' }} /> New
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                    {sessions.length === 0 && (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                            Start a new conversation!
                        </div>
                    )}
                    {sessions.map(s => (
                        <div key={s.id} onClick={() => loadSession(s.id)} style={{
                            padding: '0.625rem', borderRadius: '0.5rem', cursor: 'pointer', marginBottom: '0.25rem',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: s.id === activeSessionId ? '#FFF1F1' : 'transparent',
                            border: s.id === activeSessionId ? '1px solid rgba(255,90,95,0.2)' : '1px solid transparent'
                        }}>
                            <MessageSquare style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0, color: 'var(--text-muted)' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{s.message_count} msgs · {new Date(s.updated_at).toLocaleDateString()}</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-light)', display: 'flex' }}>
                                <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, rgba(255,90,95,0.05), transparent)' }}>
                    <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: 'linear-gradient(135deg, #FF5A5F, #E5484D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot style={{ width: '1.125rem', height: '1.125rem', color: 'white' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.2 }}>RiskMind DataBot</h2>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI underwriting assistant · {providerBadge}</p>
                    </div>
                    <button onClick={() => setIsSpeaking(!isSpeaking)} title={isSpeaking ? 'Mute' : 'Read aloud'}
                        style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: isSpeaking ? '#FFF1F1' : 'var(--surface-alt)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: isSpeaking ? '#FF5A5F' : 'var(--text-muted)' }}>
                        {isSpeaking ? <Volume2 style={{ width: '0.875rem', height: '0.875rem' }} /> : <VolumeOff style={{ width: '0.875rem', height: '0.875rem' }} />}
                        {isSpeaking ? 'Speaking' : 'Muted'}
                    </button>
                </div>

                {/* Camera */}
                {showCamera && (
                    <div style={{ position: 'relative', background: '#000', borderBottom: '1px solid var(--border)' }}>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', bottom: '0.75rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.5rem' }}>
                            <button onClick={captureAndAnalyze} disabled={loading}
                                style={{ padding: '0.5rem 1.25rem', borderRadius: '2rem', border: '2px solid white', background: 'rgba(255,90,95,0.9)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                                📸 Capture & Analyze
                            </button>
                            <button onClick={toggleCamera}
                                style={{ padding: '0.5rem 1rem', borderRadius: '2rem', border: '2px solid white', background: 'rgba(0,0,0,0.5)', color: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>
                                ✕ Close
                            </button>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {messages.length === 0 && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ textAlign: 'center', maxWidth: '420px' }}>
                                <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', margin: '0 auto 1.5rem', background: 'linear-gradient(135deg, #FF5A5F, #E5484D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bot style={{ width: '2rem', height: '2rem', color: 'white' }} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>How can I help?</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                                    Ask about policies, claims, guidelines. Upload documents, use voice, or try the camera.
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                                    {["Analyze COMM-2024-001", "Show portfolio breakdown", "Which policies are high risk?", "What's the loss ratio threshold?"].map(q => (
                                        <button key={q} onClick={() => setInput(q)}
                                            style={{ padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid var(--border)', background: 'var(--surface-alt)', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((m) => (
                        <div key={m.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <div style={{
                                width: '1.75rem', height: '1.75rem', borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: m.role === 'assistant' ? 'linear-gradient(135deg, #FF5A5F, #E5484D)' : '#e2e8f0'
                            }}>
                                {m.role === 'assistant'
                                    ? <Bot style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} />
                                    : <User style={{ width: '0.875rem', height: '0.875rem', color: '#64748b' }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: m.role === 'user' ? '#f1f5f9' : 'transparent', fontSize: '0.9375rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                                    {m.content}
                                </div>
                                {m.sources && m.sources.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#FFF1F1', borderRadius: '0.5rem', fontSize: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600, color: '#FF5A5F', marginBottom: '0.25rem' }}>
                                            <BookOpen style={{ width: '0.625rem', height: '0.625rem' }} /> Sources
                                        </div>
                                        {m.sources.map((s, i) => <div key={i} style={{ color: 'var(--text-secondary)' }}>§{s.section} — {s.title}</div>)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem' }}>
                            <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: 'linear-gradient(135deg, #FF5A5F, #E5484D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Bot style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                                <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} /> Analyzing...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".pdf,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }} />

                    <button onClick={() => fileInputRef.current?.click()} disabled={loading} title="Upload PDF or image"
                        style={{ padding: '0.625rem', borderRadius: '0.625rem', border: '1px solid var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                        <Paperclip style={{ width: '1.125rem', height: '1.125rem' }} />
                    </button>

                    <button onClick={toggleVoice} title={isListening ? 'Stop listening' : 'Voice input'}
                        style={{
                            padding: '0.625rem', borderRadius: '0.625rem',
                            border: isListening ? '1px solid #FF5A5F' : '1px solid var(--border)',
                            background: isListening ? '#FFF1F1' : 'var(--surface-alt)', cursor: 'pointer', display: 'flex',
                            color: isListening ? '#FF5A5F' : 'var(--text-muted)',
                            animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none'
                        }}>
                        {isListening ? <MicOff style={{ width: '1.125rem', height: '1.125rem' }} /> : <Mic style={{ width: '1.125rem', height: '1.125rem' }} />}
                    </button>

                    <button onClick={toggleCamera} title={showCamera ? 'Close camera' : 'Open camera'}
                        style={{
                            padding: '0.625rem', borderRadius: '0.625rem',
                            border: showCamera ? '1px solid #FF5A5F' : '1px solid var(--border)',
                            background: showCamera ? '#FFF1F1' : 'var(--surface-alt)', cursor: 'pointer', display: 'flex',
                            color: showCamera ? '#FF5A5F' : 'var(--text-muted)'
                        }}>
                        <Camera style={{ width: '1.125rem', height: '1.125rem' }} />
                    </button>

                    <input type="text" value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={loading}
                        placeholder={isListening ? '🎙️ Listening...' : 'Ask about policies, risk, guidelines...'}
                        style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', fontSize: '0.9375rem', outline: 'none', background: 'var(--surface-alt)' }} />

                    <button onClick={handleSend} disabled={!input.trim() || loading} className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>
                        <Send style={{ width: '1.125rem', height: '1.125rem' }} />
                    </button>
                </div>
            </div>
        </div>
    )
}
