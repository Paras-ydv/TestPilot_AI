import { useState, useEffect } from "react";
import type { Node } from "reactflow";
import axios from "axios";

type Props = {
  node: Node | null;
};

export default function Inspector({ node }: Props) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Clear analysis when node changes
  useEffect(() => {
    setAnalysis(null);
    setLoading(false);
  }, [node?.id]);

  if (!node) {
    return (
      <div className="p-4 text-gray-500">
        Select a node to inspect
      </div>
    );
  }

  const d = node.data;

  const analyzeScreenshot = async () => {
    if (!d.screenshotUrl) return;
    setLoading(true);
    setAnalysis(null);

    try {
      const filename = d.screenshotUrl.split('/').pop();
      const screenshotPath = `screenshots/${filename}`;

      const response = await axios.post('http://localhost:5050/vision/analyze-local', {
        screenshotPath
      }, {
        headers: {
          "x-api-key": "daddychill123supersecretkey"
        }
      });

      setAnalysis(response.data);
    } catch (error) {
      console.error('Vision analysis failed:', error);
      setAnalysis({ error: "Analysis failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-auto h-full bg-gray-50 max-w-full">
      <div className="bg-white p-3 rounded-lg shadow-sm border overflow-hidden">
        <h3 className="font-bold mb-2 text-gray-700">Visual Context</h3>
        {d.screenshotUrl && (
          <div className="space-y-3">
            <img
              src={`http://localhost:5050/graph${d.screenshotUrl}`}
              className="w-full rounded border shadow-inner"
              alt="Screenshot"
            />
            <button
              onClick={analyzeScreenshot}
              disabled={loading}
              className={`w-full py-2 px-4 rounded text-sm font-medium transition-colors ${loading
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                }`}
            >
              {loading ? "Analyzing..." : "Analyze with Azure Vision"}
            </button>
          </div>
        )}

        {analysis && (
          <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-sm space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden">
            <h4 className="font-bold text-indigo-900 border-b border-indigo-200 pb-1">AI Insights</h4>
            {analysis.caption && (
              <p className="italic text-indigo-800 break-words">"{analysis.caption}"</p>
            )}
            {Array.isArray(analysis.tags) && (
              <div className="flex flex-wrap gap-1 mt-1">
                {analysis.tags.slice(0, 10).map((tag: string, idx: number) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded text-[10px] text-indigo-700 break-all">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {Array.isArray(analysis.objects) && analysis.objects.length > 0 && (
              <p className="text-[11px] text-indigo-600 mt-2 break-words">
                <b>Detected:</b> {analysis.objects.join(', ')}
              </p>
            )}
            {analysis.error && (
              <p className="text-red-600 font-medium">⚠️ {analysis.error}</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-3 rounded-lg shadow-sm border space-y-2 text-sm overflow-hidden text-wrap">
        <h3 className="font-bold mb-1 text-gray-700 border-b pb-1">Execution Details</h3>
        <p><b className="text-gray-500">Action:</b> <span className="font-mono bg-gray-100 px-1 rounded break-all">{d.action?.type || "unknown"}</span></p>
        <p><b className="text-gray-500">Selector:</b> <span className="font-mono text-[11px] break-all">{d.action?.selector || "N/A"}</span></p>
        <p><b className="text-gray-500">Value:</b> <span className="font-mono break-all">{d.action?.value || "—"}</span></p>
        <p><b className="text-gray-500">Reasoning:</b> <span className="italic break-words whitespace-pre-wrap">{d.reasoning || "No reasoning provided by AI."}</span></p>

        {d.error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded">
            <p className="text-red-700 font-bold text-xs uppercase mb-1">Error Details</p>
            <p className="text-red-600 text-xs break-words">{d.error.message}</p>
            {d.error.consoleLogs && d.error.consoleLogs.length > 0 && (
              <div className="mt-1">
                <p className="text-[10px] text-red-400 font-bold uppercase">Console Errors:</p>
                <div className="max-h-24 overflow-y-auto mt-1 space-y-1">
                  {d.error.consoleLogs.map((log: string, i: number) => (
                    <div key={i} className="text-[10px] font-mono text-red-500 bg-white p-1 rounded border border-red-50 break-all">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center py-1 border-t mt-2 pt-2">
          <p><b className="text-gray-500">Status:</b>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
              {d.status}
            </span>
          </p>
          <p className="text-[10px] text-gray-400">{new Date(d.timestamp).toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
}
