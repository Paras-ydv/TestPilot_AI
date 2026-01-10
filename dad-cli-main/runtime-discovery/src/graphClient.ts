import axios from "axios"

const api = axios.create({
  baseURL: process.env.AZURE_GRAPH_API,
  headers: {
    "x-api-key": process.env.AZURE_API_KEY
  }
})

export async function createRun(data:any){
  return api.post("/run", data)
}

export async function sendNode(data:any){
  return api.post("/node", data)
}

export async function sendEdge(data:any){
  return api.post("/edge", data)
}
