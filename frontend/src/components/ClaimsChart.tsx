
type ChartPoint = {
    month: string
    value: number
    label: string
}

export default function ClaimsChart({ data }: { data: ChartPoint[] }) {
    if (!data.length) {
        return (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
                No claim history available yet.
            </div>
        )
    }

    const max = Math.max(...data.map(d => d.value), 1)

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
