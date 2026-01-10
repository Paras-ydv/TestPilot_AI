import { buildPrompt3Graph } from "./graph.js";
import { AgentState } from "./types.js";

const graph = buildPrompt3Graph();

export async function runPrompt3(state: AgentState): Promise<AgentState> {
  try {
    if (!state) {
      throw new Error("Invalid state: state is null or undefined");
    }

    const result = await graph.invoke(state);

    if (!result) {
      throw new Error("LangGraph returned null result");
    }

    return result;
  } catch (error) {
    console.error("❌ LangGraph execution failed:", error instanceof Error ? error.message : String(error));
    return {
      ...state,
      decision: {
        next_action: null,
        control: "TERMINATE"
      },
      next_action: null,
      control: "TERMINATE"
    };
  }
}
