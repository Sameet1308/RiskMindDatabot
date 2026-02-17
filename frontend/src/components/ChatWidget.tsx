import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, MessageSquare, X, BookOpen, Paperclip, Mic, MicOff, Camera, Volume2, VolumeOff } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import apiService from '../services/api'

interface Message {
    id: number
    role: 'user' | 'assistant'
    content: string
    sources?: { section: string; title: string }[]
    suggestedPrompts?: string[]
    timestamp: Date
}

export default function ChatWidget() {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([{
        id: 1, role: 'assistant',
        content: "Hi! I'm RiskMind DataBot. Ask me anything about policies, claims, guidelines — or upload a document, use voice, or show me your camera 📷",
        timestamp: new Date()
    }])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [sessionId, setSessionId] = useState<number | undefined>(undefined)
    const [isListening, setIsListening] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [showCamera, setShowCamera] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const recognitionRef = useRef<any>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ── Send text message ──
    const handleSend = async () => {
        if (!input.trim() || loading) return
        const userMsg: Message = { id: Date.now(), role: 'user', content: input, timestamp: new Date() }
        setMessages(prev => [...prev, userMsg])
        const currentInput = input
        setInput('')
        setLoading(true)

        try {
            const response = await apiService.chat(currentInput, sessionId)
            if (!sessionId) setSessionId(response.session_id)
            const assistantMsg: Message = {
                id: Date.now() + 1, role: 'assistant', content: response.response,
                sources: response.sources, suggestedPrompts: response.suggested_prompts || [], timestamp: new Date()
            }
            setMessages(prev => [...prev, assistantMsg])
            speakResponse(response.response)
        } catch {
            setMessages(prev => [...prev, {
                id: Date.now() + 1, role: 'assistant',
                content: "Connection error. Is the backend running?", timestamp: new Date()
            }])
        } finally { setLoading(false) }
    }

    // ── File upload ──
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setLoading(true)
        const isVideo = file.type.startsWith('video/')
        const uploadMsg = isVideo ? `🎥 Uploading & Analyzing Video: ${file.name} (this may take a moment)...` : `📎 Uploading: ${file.name}`

        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: uploadMsg, timestamp: new Date() }])

        try {
            const result = await apiService.uploadFile(file, '', sessionId || 0)
            setMessages(prev => [...prev, {
                id: Date.now() + 1, role: 'assistant',
                content: result.analysis || `File uploaded: ${result.filename}`, timestamp: new Date()
            }])
        } catch {
            setMessages(prev => [...prev, {
                id: Date.now() + 1, role: 'assistant',
                content: "Upload failed.", timestamp: new Date()
            }])
        } finally {
            setLoading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // ── Voice: Speech-to-Text ──
    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop()
            setIsListening(false)
            return
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            alert('Voice input is not supported in this browser. Please use Chrome.')
            return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript
            setInput(transcript)
            setIsListening(false)
        }

        recognition.onerror = () => setIsListening(false)
        recognition.onend = () => setIsListening(false)

        recognitionRef.current = recognition
        recognition.start()
        setIsListening(true)
    }

    // ── Voice: Text-to-Speech ──
    const speakResponse = (text: string) => {
        if (!isSpeaking) return
        const cleaned = text.replace(/[*#_`\[\]()]/g, '').substring(0, 500)
        const utterance = new SpeechSynthesisUtterance(cleaned)
        utterance.rate = 1.0
        utterance.pitch = 1.0
        speechSynthesis.speak(utterance)
    }

    // ── Camera: Start/Stop ──
    const toggleCamera = async () => {
        if (showCamera) {
            streamRef.current?.getTracks().forEach(t => t.stop())
            streamRef.current = null
            setShowCamera(false)
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            streamRef.current = stream
            setShowCamera(true)
            setTimeout(() => {
                if (videoRef.current) videoRef.current.srcObject = stream
            }, 100)
        } catch {
            alert('Camera access denied or not available.')
        }
    }

    // ── Camera: Capture and analyze ──
    const captureAndAnalyze = async () => {
        if (!videoRef.current) return
        setLoading(true)
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: '📷 Captured image from camera', timestamp: new Date() }])

        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

        try {
            const response = await apiService.visionChat(base64, 'Analyze this image for insurance underwriting purposes.', sessionId)
            if (!sessionId) setSessionId(response.session_id)
            setMessages(prev => [...prev, {
                id: Date.now() + 1, role: 'assistant', content: response.response, timestamp: new Date()
            }])
        } catch {
            setMessages(prev => [...prev, {
                id: Date.now() + 1, role: 'assistant',
                content: "Vision analysis failed. Ensure an API key is configured.", timestamp: new Date()
            }])
        } finally { setLoading(false) }
    }

    return (
        <>
            {/* Floating Button */}
            {!open && (
                <button onClick={() => setOpen(true)} style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem',
                    width: '3.5rem', height: '3.5rem', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF5A5F, #E5484D)', color: 'white',
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(255, 90, 95, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
                    transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
                    <MessageSquare style={{ width: '1.5rem', height: '1.5rem' }} />
                </button>
            )}

            {/* Chat Panel */}
            {open && (
                <div style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem',
                    width: '420px', height: '580px', borderRadius: '1rem',
                    background: 'white',
                    boxShadow: '0 12px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                    display: 'flex', flexDirection: 'column', zIndex: 1000,
                    overflow: 'hidden', animation: 'slideUp 0.25s ease-out'
                }}>
                    {/* Header */}
                    <div style={{
                        background: 'linear-gradient(135deg, #FF5A5F, #E5484D)',
                        padding: '0.625rem 0.875rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'space-between', color: 'white'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Bot style={{ width: '1.125rem', height: '1.125rem' }} />
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>RiskMind DataBot</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button onClick={() => setIsSpeaking(!isSpeaking)} title={isSpeaking ? 'Mute' : 'Read aloud'}
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '0.375rem', padding: '0.25rem', display: 'flex' }}>
                                {isSpeaking ? <Volume2 style={{ width: '0.875rem', height: '0.875rem' }} /> : <VolumeOff style={{ width: '0.875rem', height: '0.875rem' }} />}
                            </button>
                            <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '0.375rem', padding: '0.25rem', display: 'flex' }}>
                                <X style={{ width: '0.875rem', height: '0.875rem' }} />
                            </button>
                        </div>
                    </div>

                    {/* Camera Preview */}
                    {showCamera && (
                        <div style={{ position: 'relative', background: '#000', borderBottom: '1px solid var(--border)' }}>
                            <video ref={videoRef} autoPlay playsInline muted
                                style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                            <button onClick={captureAndAnalyze} disabled={loading}
                                style={{
                                    position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)',
                                    padding: '0.375rem 1rem', borderRadius: '2rem', border: '2px solid white',
                                    background: 'rgba(255,90,95,0.9)', color: 'white', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '0.75rem'
                                }}>
                                📸 Capture & Analyze
                            </button>
                        </div>
                    )}

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {messages.map((m) => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div className="chat-widget-content" style={{
                                    maxWidth: '85%', padding: '0.5rem 0.75rem',
                                    borderRadius: m.role === 'user' ? '0.875rem 0.875rem 0.25rem 0.875rem' : '0.875rem 0.875rem 0.875rem 0.25rem',
                                    background: m.role === 'user' ? 'linear-gradient(135deg, #FF5A5F, #E5484D)' : '#f1f5f9',
                                    color: m.role === 'user' ? 'white' : 'var(--text)',
                                    fontSize: '0.8125rem', lineHeight: 1.5, whiteSpace: 'pre-wrap'
                                }}>
                                            {m.role === 'assistant' ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                                            ) : (
                                                m.content
                                            )}
                                    {m.sources && m.sources.length > 0 && (
                                        <div style={{
                                            marginTop: '0.375rem', padding: '0.25rem 0.5rem',
                                            background: 'rgba(0,0,0,0.05)', borderRadius: '0.375rem', fontSize: '0.6875rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                                                <BookOpen style={{ width: '0.5rem', height: '0.5rem' }} /> Sources
                                            </div>
                                            {m.sources.map((s, i) => <div key={i}>§{s.section} — {s.title}</div>)}
                                        </div>
                                    )}
                                    {m.role === 'assistant' && m.suggestedPrompts && m.suggestedPrompts.length > 0 && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Did you mean:</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                {m.suggestedPrompts.map((prompt, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            setInput(prompt)
                                                            handleSend()
                                                        }}
                                                        style={{
                                                            background: 'white',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '0.75rem',
                                                            padding: '0.35rem 0.65rem',
                                                            fontSize: '0.7rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255,90,95,0.08)'
                                                            e.currentTarget.style.borderColor = 'rgba(255,90,95,0.3)'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'white'
                                                            e.currentTarget.style.borderColor = 'var(--border)'
                                                        }}
                                                    >
                                                        {prompt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                <Loader2 style={{ width: '0.875rem', height: '0.875rem', animation: 'spin 1s linear infinite' }} />
                                Analyzing...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.mov,.avi,.mkv" style={{ display: 'none' }} />

                        <button onClick={() => fileInputRef.current?.click()} disabled={loading} title="Upload file"
                            style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                            <Paperclip style={{ width: '0.875rem', height: '0.875rem' }} />
                        </button>

                        <button onClick={toggleVoice} title={isListening ? 'Stop listening' : 'Voice input'}
                            style={{
                                padding: '0.5rem', borderRadius: '0.5rem',
                                border: isListening ? '1px solid #FF5A5F' : '1px solid var(--border)',
                                background: isListening ? '#FFF1F1' : 'var(--surface-alt)',
                                cursor: 'pointer', display: 'flex',
                                color: isListening ? '#FF5A5F' : 'var(--text-muted)',
                                animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none'
                            }}>
                            {isListening ? <MicOff style={{ width: '0.875rem', height: '0.875rem' }} /> : <Mic style={{ width: '0.875rem', height: '0.875rem' }} />}
                        </button>

                        <button onClick={toggleCamera} title={showCamera ? 'Close camera' : 'Open camera'}
                            style={{
                                padding: '0.5rem', borderRadius: '0.5rem',
                                border: showCamera ? '1px solid #FF5A5F' : '1px solid var(--border)',
                                background: showCamera ? '#FFF1F1' : 'var(--surface-alt)',
                                cursor: 'pointer', display: 'flex',
                                color: showCamera ? '#FF5A5F' : 'var(--text-muted)'
                            }}>
                            <Camera style={{ width: '0.875rem', height: '0.875rem' }} />
                        </button>

                        <input type="text" value={input} onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={loading}
                            placeholder={isListening ? '🎙️ Listening...' : 'Ask anything...'}
                            style={{
                                flex: 1, padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
                                border: '1px solid var(--border)', fontSize: '0.8125rem', outline: 'none',
                                background: 'var(--surface-alt)'
                            }} />
                        <button onClick={handleSend} disabled={!input.trim() || loading}
                            style={{
                                padding: '0.5rem', borderRadius: '0.5rem',
                                background: input.trim() ? 'var(--primary)' : 'var(--border)',
                                color: 'white', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex'
                            }}>
                            <Send style={{ width: '0.875rem', height: '0.875rem' }} />
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
