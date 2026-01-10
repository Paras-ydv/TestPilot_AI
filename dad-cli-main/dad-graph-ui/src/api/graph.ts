import axios from "axios";

export const graphApi = axios.create({
  baseURL: import.meta.env.VITE_GRAPH_API || "http://localhost:5050/graph",
  headers: {
    "x-api-key": import.meta.env.VITE_API_KEY || "daddychill123supersecretkey" // Default key used in other files
  }
});

export async function fetchGraph(runId: string) {
  const res = await graphApi.get(`/run/${runId}`);
  return res.data;
}

export const fetchRuns = async () => {
  const response = await graphApi.get("/runs");
  return response.data;
};

export const deleteRun = async (runId: string) => {
  const response = await graphApi.delete(`/run/${runId}`);
  return response.data;
};
