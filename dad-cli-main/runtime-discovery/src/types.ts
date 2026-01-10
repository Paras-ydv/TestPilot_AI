// Re-export from shared types
export * from "../../shared/types.js";

// Additional runtime-specific types
export type DiscoveredAction = {
  id: string;
  type: "button" | "link" | "input" | "select" | "checkbox" | "radio";
  label?: string;
  viewportSafe: boolean;
  inputType?: string;
  options?: string[];
  isModal?: boolean;
};
