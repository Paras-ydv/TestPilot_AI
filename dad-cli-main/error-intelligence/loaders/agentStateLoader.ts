import fs from "fs";
import path from "path";
import { AgentState } from "../types.js";

export function loadAgentState(agentStatePath: string): AgentState {
  const fullPath = path.resolve(agentStatePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`AgentState file not found at: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw);
}
