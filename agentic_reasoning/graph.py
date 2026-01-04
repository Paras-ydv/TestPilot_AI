"""
LangGraph Orchestration

Wires all nodes together to create the reasoning workflow.

CONTROL FLOW (Safety-First Design):
  interpret → detect_anomalies → router
  router:
    CONTINUE → plan_action → learn → interpret (loop)
    DEEP_TEST → plan_action → learn → interpret (loop)
    TERMINATE → END

Router makes termination decision BEFORE planning to avoid wasted cycles.
"""

from typing import Literal
from langgraph.graph import StateGraph, END
from agentic_reasoning.schemas.agent_state import AgentState, ControlDecision
from agentic_reasoning.nodes.state_interpreter import state_interpreter_node
from agentic_reasoning.nodes.anomaly_detector import anomaly_detector_node
from agentic_reasoning.nodes.router import router_node
from agentic_reasoning.nodes.action_planner import action_planner_node
from agentic_reasoning.nodes.learner import learner_node


def determine_next_step(state: AgentState) -> Literal["plan_action", "terminate"]:
    """
    Conditional edge function for router.
    
    Routes based on state.decision.control value.
    
    Args:
        state: Current AgentState
    
    Returns:
        Next node name or "terminate"
    """
    control = state.decision.control
    
    if control == ControlDecision.TERMINATE:
        return "terminate"
    elif control == ControlDecision.CONTINUE:
        return "plan_action"
    elif control == ControlDecision.DEEP_TEST:
        return "plan_action"  # Deep test proceeds to planning
    else:
        # Default to planning
        return "plan_action"


def create_reasoning_graph() -> StateGraph:
    """
    Create the LangGraph reasoning workflow.
    
    Executes ONE reasoning cycle:
    - interpret → detect_anomalies → route
    - If TERMINATE → END
    - If CONTINUE/DEEP_TEST → plan_action → learn → END
    
    For multi-cycle execution, the external system should call repeatedly.
    
    Returns:
        Compiled StateGraph ready for execution
    """
    # Initialize workflow
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("interpret", state_interpreter_node)
    workflow.add_node("detect_anomalies", anomaly_detector_node)
    workflow.add_node("route", router_node)
    workflow.add_node("plan_action", action_planner_node)
    workflow.add_node("learn", learner_node)
    
    # Define linear flow: interpret → detect_anomalies → route
    workflow.add_edge("interpret", "detect_anomalies")
    workflow.add_edge("detect_anomalies", "route")
    
    # Router makes termination decision BEFORE planning
    # This prevents wasted planning when termination should occur
    workflow.add_conditional_edges(
        "route",
        determine_next_step,
        {
            "plan_action": "plan_action",
            "terminate": END
        }
    )
    
    # After planning, learn and TERMINATE
    # External system is responsible for multi-cycle execution
    workflow.add_edge("plan_action", "learn")
    workflow.add_edge("learn", END)  # Changed from loop-back to  END
    
    # Set entry point
    workflow.set_entry_point("interpret")
    
    # Compile and return
    return workflow.compile()


def run_reasoning_cycle(
    graph: StateGraph,
    initial_state: AgentState,
    max_iterations: int = 100
) -> AgentState:
    """
    Run the reasoning graph for one complete cycle.
    
    Args:
        graph: Compiled LangGraph
        initial_state: Starting state
        max_iterations: Safety limit on iterations
    
    Returns:
        Final state after execution
    """
    # Execute graph
    # LangGraph will handle the iteration automatically
    final_state = graph.invoke(initial_state)
    
    return final_state


# Example usage documentation
"""
USAGE EXAMPLE:

from agentic_reasoning import create_reasoning_graph, AgentState
from agentic_reasoning.schemas.agent_state import UIState, ExecutionContext

# Create graph
graph = create_reasoning_graph()

# Create initial state
initial_state = AgentState(
    ui_state=UIState(
        available_actions=["click_login", "fill_username", "fill_password"],
        observation={"form_visible": True},
        page_url="https://example.com/login"
    ),
    execution_context=ExecutionContext(
        step_count=0,
        max_steps=50
    )
)

# Run reasoning
final_state = graph.invoke(initial_state)

# Check decision
print(f"Control: {final_state.decision.control}")
print(f"Next action: {final_state.decision.next_action}")
print(f"Anomalies: {len(final_state.anomalies)}")
"""
