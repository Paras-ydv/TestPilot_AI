export type GraphRun = {
  id: string
  startedAt: string
  targetUrl: string
  status: "running" | "completed" | "error"
  totalNodes: number
}

export type GraphNode = {
  id: string
  runId: string
  stepIndex: number

  url: string
  pageTitle?: string
  screenshotUrl: string
  timestamp: string

  viewport?: {
    width: number
    height: number
  }

  action: {
    type: string
    selector?: string
    value?: string
  }

  reasoning: string

  network?: {
    requests: number
    failed: number
  }

  status: "success" | "error"

  error?: {
    message: string
    stack?: string
    consoleLogs?: string[]
  }
}

export type GraphEdge = {
  id: string
  runId: string
  from: string
  to: string
  action: string
}
