import { AgentState } from "../types.js";
import {
  checkApiUiInvariant
} from "../invariants/apiUiInvariant.js";
import {
  checkRouteInvariant
} from "../invariants/routeInvariant.js";
import {
  checkConsoleErrors
} from "../invariants/consoleErrorInvariant.js";

export function anomalyDetector(state: AgentState): AgentState {
  const anomalies = [];

  const checks = [
    checkApiUiInvariant,
    checkRouteInvariant,
    checkConsoleErrors
  ];

  for (const check of checks) {
    const result = check(state);
    if (result) anomalies.push(result);
  }

  return {
    ...state,
    anomalies: anomalies.length ? anomalies : state.anomalies ?? []
  };
}
