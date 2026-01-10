// Unified types for DAD Agent system
export type ControlSignal = "CONTINUE" | "DEEP_TEST" | "TERMINATE";

export interface ActionContract {
  action_id: string;
  parameters: Record<string, any>;
}

export interface DecisionOutput {
  next_action: ActionContract | null;
  control: ControlSignal;
  confidence?: number;
  reasoning?: string;
  anomalies?: AnomalyReport[];
}

export interface AnomalyReport {
  severity: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  action_id: string;
  description: string;
  evidence?: Record<string, any>;
}

export type NetworkCall = {
  method: string;
  url: string;
  status: number;
  failed?: boolean;
};

export type Observation = {
  actionId: string;
  networkCalls: NetworkCall[];
  consoleErrors: string[];
  screenshotPath?: string;
  skipped?: boolean;
  selector?: string;
  state_delta?: Record<string, any>;
};

export type UIState = {
  state_id: string;
  route: string;
  title: string;
  available_actions: any[];
  entities: Record<string, any>;
  viewport?: {
    width: number;
    height: number;
  };
};

export type AgentStep = {
  step: number;
  action: ActionContract;
  observation: Observation;
  state_id?: string; // Captures the resulting state ID
  anomalies?: AnomalyReport[];
};

// Unified AgentState with all required fields
export interface AgentState {
  schema_version: string;
  run_id: string;

  // Screenshot URL for the current state (used by graph tracker)
  screenshot_url?: string;

  runtime: {
    url: string;
    browser: string;
    timestamp: string;
    execute?: (action_id: string, parameters: Record<string, any>) => Promise<void>;
  };

  ui_state?: UIState;
  steps: AgentStep[];

  // LangGraph fields
  decision?: DecisionOutput;
  next_action?: ActionContract;
  control?: ControlSignal;
  anomalies?: AnomalyReport[];

  // Memory context
  memories?: any[];
  knowledge_context?: {
    memories?: any[];
    confidence?: number;
  };

  // Node outputs
  diagnosis?: any;
  execution?: {
    action_id?: string;
    parameters?: Record<string, any>;
    timestamp?: number;
    skipped?: boolean;
    reason?: string;
  };
  validation?: any;
  reasoning?: string;
}