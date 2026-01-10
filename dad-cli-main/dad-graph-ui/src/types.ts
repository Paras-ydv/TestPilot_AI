export type GraphNode = {
  id: string;
  runId: string;
  stepIndex: number;
  url: string;
  pageTitle?: string;
  screenshotUrl: string;
  timestamp: string;
  action: {
    type: string;
    selector?: string;
    value?: string;
  };
  reasoning: string;
  status: "success" | "error";
  error?: {
    message: string;
    consoleLogs?: string[];
  };
};

export type GraphEdge = {
  id: string;
  runId: string;
  from: string;
  to: string;
  action: string;
};
