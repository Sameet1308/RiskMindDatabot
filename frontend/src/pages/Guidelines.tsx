import { useState, useEffect } from 'react'
import { Search, BookOpen, AlertCircle, CheckSquare } from 'lucide-react'
import apiService from '../services/api'

interface Guideline {
    section_code: string
    title: string
    content: string
    category: string
    action: string
}

export default function Guidelines() {
    const [guidelines, setGuidelines] = useState<Guideline[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')

    const categories = ['all', 'Eligibility', 'Pricing', 'Frequency', 'Severity']

    useEffect(() => {
        loadGuidelines()
    }, [])

    const loadGuidelines = async () => {
        try {
            const data = await apiService.getGuidelines()
            setGuidelines(data.data)
        } catch (err) {
            console.error('Failed to load guidelines', err)
        } finally {
            setLoading(false)
        }
    }

    const getActionBadge = (action: string) => {
        const styles: Record<string, string> = {
            APPROVE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            REVIEW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            ENHANCED_REVIEW: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            REFER: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        }
        return styles[action] || styles.REVIEW
    }

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Eligibility': return <CheckSquare className="w-5 h-5 text-blue-400" />
            case 'Pricing': return <BookOpen className="w-5 h-5 text-emerald-400" />
            case 'Frequency': return <AlertCircle className="w-5 h-5 text-amber-400" />
            case 'Severity': return <AlertCircle className="w-5 h-5 text-red-400" />
            default: return <BookOpen className="w-5 h-5 text-slate-400" />
        }
    }

    const filteredGuidelines = guidelines.filter(g => {
        const matchesCategory = selectedCategory === 'all' || g.category === selectedCategory
        const matchesSearch = searchQuery === '' ||
            g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.content.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCategory && matchesSearch
    })

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Underwriting Guidelines</h1>
                <p className="text-slate-400 mt-1">Reference documentation for risk assessment rules</p>
            </div>

            {/* Search and Filter */}
            <div className="glass-box p-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search guidelines..."
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {cat === 'all' ? 'All' : cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Guidelines List */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-slate-400 mt-4">Loading guidelines...</p>
                </div>
            ) : filteredGuidelines.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    No guidelines found matching your criteria.
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredGuidelines.map((guideline) => (
                        <div key={guideline.section_code} className="glass-box p-6 hover:bg-slate-800/80 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {getCategoryIcon(guideline.category)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className="text-blue-400 font-mono text-sm">{guideline.section_code}</span>
                                        <span className="text-slate-500">•</span>
                                        <span className="text-slate-400 text-sm">{guideline.category}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getActionBadge(guideline.action)}`}>
                                            {guideline.action.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-2">{guideline.title}</h3>
                                    <p className="text-slate-300">{guideline.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
