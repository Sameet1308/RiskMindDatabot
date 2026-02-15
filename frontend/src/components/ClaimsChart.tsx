
import { BarChart3 } from 'lucide-react'

export default function ClaimsChart() {
    const data = [
        { month: 'Aug', value: 45, label: '$45k' },
        { month: 'Sep', value: 62, label: '$62k' },
        { month: 'Oct', value: 38, label: '$38k' },
        { month: 'Nov', value: 85, label: '$85k' },
        { month: 'Dec', value: 55, label: '$55k' },
        { month: 'Jan', value: 72, label: '$72k' },
    ]

    const max = Math.max(...data.map(d => d.value))

    return (
        <div className="h-64 flex items-end justify-between gap-4">
            {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-2 group w-full">
                    <div className="mb-2 font-semibold text-slate-700">{d.label}</div>
                    <div
                        className={`w-full rounded-lg transition-all duration-500 hover:opacity-80 ${i === data.length - 1 ? 'bg-indigo-600 shadow-lg shadow-indigo-200' : 'bg-slate-200 hover:bg-slate-300'
                            }`}
                        style={{ height: `${Math.max((d.value / max) * 100, 15)}%` }}
                    />
                    <span className="text-sm font-bold text-slate-400 mt-2">{d.month}</span>
                </div>
            ))}
        </div>
    )
}
