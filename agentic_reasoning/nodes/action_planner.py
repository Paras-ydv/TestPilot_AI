"""
Action Planner Node

Selects the next action to execute based on coverage and risk.

RESPONSIBILITIES:
- Choose action from available_actions ONLY
- NEVER invent actions
- Use coverage-guided exploration
- Respect risk scores
- Make selection deterministic when possible

WRITES: state.decision.next_action
"""

from typing import Optional
from agentic_reasoning.schemas.agent_state import AgentState, ControlDecision
from agentic_reasoning.schemas.action_contract import ActionContract
from agentic_reasoning.policies.exploration import select_action_by_coverage
from agentic_reasoning.policies.risk import update_risks_from_anomalies


def plan_next_action(state: AgentState) -> Optional[ActionContract]:
    """
    Select the next action to execute.
    
    Uses coverage-guided exploration with risk awareness.
    
    CRITICAL: Only selects from state.ui_state.available_actions.
    NEVER invents actions.
    
    Args:
        state: Current AgentState
    
    Returns:
        ActionContract for next action, or None if no valid action
    """
    available_actions = state.ui_state.available_actions
    
    # If no actions available, cannot plan
    if not available_actions:
        return None
    
    # Update risk scores based on recent anomalies
    updated_risks = update_risks_from_anomalies(
        current_risks=state.knowledge.risk_scores,
        anomalies=state.anomalies,
        recent_anomalies_only=10
    )
    
    # Write updated risks back to state (this is allowed)
    state.knowledge.risk_scores = updated_risks
    
    # Select action using coverage strategy
    selected_action_id = select_action_by_coverage(
        available_actions=available_actions,
        action_history=state.execution_context.action_history,
        risk_scores=updated_risks,
        max_risk_threshold=0.9  # Allow most actions unless extremely risky
    )
    
    if not selected_action_id:
        return None
    
    # Create action contract
    # Parameters are empty by default - external modules will inject if needed
    action_contract = ActionContract(
        action_id=selected_action_id,
        parameters={}
    )
    
    return action_contract


def action_planner_node(state: AgentState) -> AgentState:
    """
    LangGraph node for action planning.
    
    Selects next action and writes to state.decision.
    
    READS: ui_state, execution_context, knowledge, anomalies
    WRITES: decision.next_action, knowledge.risk_scores
    
    Args:
        state: Current AgentState
    
    Returns:
        State with decision.next_action updated
    """
    # Plan next action
    next_action = plan_next_action(state)
    
    # Write to decision
    state.decision.next_action = next_action
    
    # Add reasoning
    if next_action:
        coverage_info = f"Selecting action '{next_action.action_id}' from {len(state.ui_state.available_actions)} available actions"
        risk_score = state.knowledge.risk_scores.get(next_action.action_id, 0.5)
        risk_info = f"Risk score: {risk_score:.2f}"
        
        state.decision.reasoning = f"{coverage_info}. {risk_info}"
    else:
        state.decision.reasoning = "No valid actions available"
    
    return state
