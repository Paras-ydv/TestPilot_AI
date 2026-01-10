import { useMemo } from 'react';

type Props = {
    nodes: any[];
    metadata: {
        targetUrl: string;
        status: string;
        startedAt?: string;
        completedAt?: string;
    };
};

export default function StatsBanner({ nodes, metadata }: Props) {
    const stats = useMemo(() => {
        const total = nodes.length;
        const successful = nodes.filter(n => n.status === 'success').length;
        const failed = nodes.filter(n => n.status === 'error').length;
        const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

        let duration = "—";
        if (metadata.startedAt) {
            const start = new Date(metadata.startedAt).getTime();
            const end = metadata.completedAt ? new Date(metadata.completedAt).getTime() : Date.now();
            const diffSec = Math.floor((end - start) / 1000);
            const mins = Math.floor(diffSec / 60);
            const secs = diffSec % 60;
            duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        }

        return { total, successful, failed, successRate, duration };
    }, [nodes, metadata]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Target URL</span>
                <span className="text-sm font-semibold text-gray-700 truncate" title={metadata.targetUrl}>
                    {metadata.targetUrl || "No URL"}
                </span>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${metadata.status === 'completed' ? 'bg-green-100 text-green-700' :
                        metadata.status === 'running' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                            'bg-gray-100 text-gray-700'
                    }`}>
                    {metadata.status}
                </span>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Steps</span>
                <span className="text-2xl font-black text-indigo-600">{stats.total}</span>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Success Rate</span>
                <span className={`text-2xl font-black ${stats.successRate > 80 ? 'text-green-500' : stats.successRate > 50 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                    {stats.successRate}%
                </span>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Duration</span>
                <span className="text-2xl font-black text-gray-700">{stats.duration}</span>
            </div>
        </div>
    );
}
