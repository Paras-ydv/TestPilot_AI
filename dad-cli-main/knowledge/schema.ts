export type KnowledgeType =
  | "route"
  | "error"
  | "fix"
  | "flow"
  | "metric"
  | "pattern"
  | "observation";

/**
 * Core knowledge object stored in vector DB
 */
export interface KnowledgeItem {
  /** Unique id (auto generated if missing) */
  id?: string;

  /** Type of knowledge */
  type: KnowledgeType;

  /** Main text used for embedding */
  content: string;

  /** Runtime session id */
  run_id: string;

  /** Vector similarity score (returned from search) */
  score?: number;

  /** Normalized error key */
  error_signature?: string;

  /** Root cause extracted by agent */
  root_cause?: string;

  /** Fix applied by agent */
  solution?: string;

  /** Step-by-step fix instructions */
  fix_steps?: string[];

  /** Result of applying solution */
  outcome?: "success" | "failure";

  /** Agent confidence (0-1) */
  confidence?: number;

  /** Usage tracking */
  usage_count?: number;

  /* ---------- Phase 5 additions ---------- */

  /** How many times fix succeeded */
  success_count?: number;

  /** How many times fix failed */
  failure_count?: number;

  /** Last time this memory was used */
  last_used?: number;

  /* -------------------------------------- */

  /** Metadata for filtering */
  metadata: {
    endpoint?: string;
    status?: number;
    env?: string;
    app_version?: string;

    /** ISO timestamp */
    timestamp: string;

    /** Framework / stack */
    framework?: string;

    /** Severity level */
    severity?: "low" | "medium" | "high" | "critical";

    /** Tags for search */
    tags?: string[];

    /** Action parameters (added for fixes) */
    parameters?: Record<string, any>;

    /** Allow other arbitrary metadata */
    [key: string]: any;
  };

  /** When this memory was created */
  created_at?: number;
}
