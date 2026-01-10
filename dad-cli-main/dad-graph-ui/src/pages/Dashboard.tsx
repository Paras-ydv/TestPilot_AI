import { useEffect, useState, useCallback } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { fetchGraph, fetchRuns, deleteRun } from "../api/graph";
import Inspector from "../components/Inspector";
import StatsBanner from "../components/StatsBanner";

export default function Dashboard() {
  const [runs, setRuns] = useState<any[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>({ targetUrl: "", status: "unknown" });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load handles
  const loadRuns = async () => {
    try {
      const r = await fetchRuns();
      setRuns(r);
      if (r.length > 0 && !currentRunId) {
        setCurrentRunId(r[0].runId);
      }
    } catch (err) {
      console.error("Failed to load runs:", err);
    }
  };

  const loadGraphData = useCallback(async (runId: string) => {
    if (!runId) return;
    try {
      const g = await fetchGraph(runId);

      const rfNodes = g.nodes.map((n: any) => ({
        id: n.id,
        position: {
          x: n.stepIndex * 350,
          y: 250
        },
        data: n,
        style: {
          background: n.status === "success" ? "#dcfce7" : "#fee2e2",
          border: `2px solid ${n.status === "success" ? "#22c55e" : "#ef4444"}`,
          borderRadius: "12px",
          width: 200,
          padding: "10px",
          textAlign: "center" as const,
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
        }
      }));

      setNodes(rfNodes);
      setEdges(g.edges.map((e: any) => ({
        ...e,
        source: e.from,
        target: e.to,
        label: e.action,
        style: { stroke: "#6366f1", strokeWidth: 2 },
        animated: true,
        labelStyle: { fill: "#4338ca", fontWeight: 700, fontSize: 10 }
      })));

      if (g.metadata) {
        setMetadata(g.metadata);
      }
    } catch (err) {
      console.error("Failed to load graph:", err);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    if (currentRunId) {
      loadGraphData(currentRunId);
    }
  }, [currentRunId, loadGraphData]);

  // Auto-refresh logic
  useEffect(() => {
    let interval: any;
    if (autoRefresh && currentRunId) {
      interval = setInterval(() => {
        loadGraphData(currentRunId);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, currentRunId, loadGraphData]);

  const handleDelete = async () => {
    if (!currentRunId) return;
    if (!confirm(`Are you sure you want to delete run ${currentRunId}?`)) return;

    try {
      setLoading(true);
      await deleteRun(currentRunId);
      const newRuns = runs.filter(r => r.runId !== currentRunId);
      setRuns(newRuns);
      if (newRuns.length > 0) {
        setCurrentRunId(newRuns[0].runId);
      } else {
        setCurrentRunId(null);
        setNodes([]);
        setEdges([]);
        setMetadata({ targetUrl: "", status: "unknown" });
      }
      alert("Run deleted successfully");
    } catch (err) {
      alert("Failed to delete run");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">D</div>
          <h1 className="text-xl font-black tracking-tight text-slate-800">DAD AGENT <span className="text-indigo-600">LIVE</span></h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${autoRefresh
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
          >
            {autoRefresh ? "📡 AUTO-REFRESH ON" : "📡 AUTO-REFRESH OFF"}
          </button>

          <select
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm min-w-[200px]"
            value={currentRunId || ""}
            onChange={(e) => setCurrentRunId(e.target.value)}
          >
            {runs.length === 0 && <option value="">No runs found</option>}
            {runs.map((r) => (
              <option key={r.runId} value={r.runId}>
                {r.runId} ({new Date(r.startedAt).toLocaleTimeString()})
              </option>
            ))}
          </select>

          <button
            onClick={handleDelete}
            disabled={!currentRunId || loading}
            className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors disabled:opacity-50 border border-rose-200"
          >
            {loading ? "DELETING..." : "DELETE RUN"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden p-6 gap-6">
        <div className="flex-1 flex flex-col min-w-0">
          <StatsBanner nodes={nodes} metadata={metadata} />

          <div className="flex-1 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative">
            {nodes.length > 0 ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodeClick={(_, n) => setSelectedNode(n)}
                fitView
              >
                <Background color="#cbd5e1" gap={20} />
                <Controls />
              </ReactFlow>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium">
                No graph data available for this run
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-96 bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-bold text-slate-700 uppercase tracking-widest text-xs">Node Inspector</h2>
            {selectedNode && (
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            <Inspector node={selectedNode} />
          </div>
        </aside>
      </main>
    </div>
  );
}
