"""
Learner Node

Updates knowledge baselines from observations.

RESPONSIBILITIES:
- Extract metrics from observations
- Update baseline statistics
- Learn "normal" behavior patterns
- NO decision making

WRITES: knowledge.baselines (already updated in anomaly detector)
        Can add additional learning here if needed
"""

from typing import Dict, Any
from agentic_reasoning.schemas.agent_state import AgentState
from agentic_reasoning.invariants.baseline_checks import (
    extract_metrics_from_observation,
    BaselineMetrics
)


def learn_from_observation(state: AgentState) -> Dict[str, Any]:
    """
    Extract learnings from current observation.
    
    Updates baselines and identifies patterns.
    
    Args:
        state: Current AgentState
    
    Returns:
        Dictionary of learned insights
    """
    insights = {}
    
    # Get last action
    action_history = state.execution_context.action_history
    last_action = action_history[-1] if action_history else None
    
    # Extract metrics
    observation = state.ui_state.observation
    metrics = extract_metrics_from_observation(observation, last_action)
    
    # Baselines are already updated in anomaly_detector
    # Here we can add additional learning logic if needed
    
    # Learn action patterns
    if last_action:
        # Track successful action completions
        action_success_key = f"{last_action}_success_count"
        current_count = state.knowledge.baselines.get(action_success_key, {}).get("mean", 0)
        state.knowledge.baselines[action_success_key] = {
            "mean": current_count + 1,
            "std_dev": 0,
            "count": 1
        }
    
    # Learn page patterns
    if state.ui_state.page_url:
        page_visit_key = f"page_visits_{state.ui_state.page_url}"
        current_visits = state.knowledge.baselines.get(page_visit_key, {}).get("mean", 0)
        state.knowledge.baselines[page_visit_key] = {
            "mean": current_visits + 1,
            "std_dev": 0,
            "count": 1
        }
    
    insights["metrics_extracted"] = len(metrics)
    insights["baselines_updated"] = True
    
    return insights


def update_action_success_rates(state: AgentState) -> None:
    """
    Track success/failure rates for actions.
    
    An action is considered successful if it didn't trigger HIGH severity anomalies.
    
    Args:
        state: Current AgentState
    """
    action_history = state.execution_context.action_history
    
    if not action_history:
        return
    
    last_action = action_history[-1]
    
    # Check if last action triggered HIGH severity anomaly
    recent_anomalies = state.anomalies[-3:] if len(state.anomalies) > 0 else []
    
    high_severity_triggered = any(
        a.action_id == last_action and a.severity.value == "HIGH"
        for a in recent_anomalies
    )
    
    # Update success rate
    success_rate_key = f"{last_action}_success_rate"
    
    if success_rate_key not in state.knowledge.baselines:
        # Initialize
        state.knowledge.baselines[success_rate_key] = {
            "mean": 1.0 if not high_severity_triggered else 0.0,
            "std_dev": 0.0,
            "count": 1
        }
    else:
        # Update incrementally
        baseline = BaselineMetrics.from_dict(state.knowledge.baselines[success_rate_key])
        new_value = 1.0 if not high_severity_triggered else 0.0
        updated = baseline.update(new_value)
        state.knowledge.baselines[success_rate_key] = updated.to_dict()


def learner_node(state: AgentState) -> AgentState:
    """
    LangGraph node for learning and memory updates.
    
    Updates baselines and learns patterns from observations.
    
    READS: ui_state, execution_context, anomalies
    WRITES: knowledge.baselines
    
    Args:
        state: Current AgentState
    
    Returns:
        State with updated knowledge baselines
    """
    # Learn from current observation
    insights = learn_from_observation(state)
    
    # Update action success rates
    update_action_success_rates(state)
    
    # Insights could be logged but not stored in state
    # (state doesn't have a field for insights)
    
    return state
