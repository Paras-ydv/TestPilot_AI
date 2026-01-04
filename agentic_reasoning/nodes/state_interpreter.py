"""
State Interpreter Node

Reads AgentState and extracts meaningful signals for other nodes.

RESPONSIBILITIES:
- Extract available actions
- Summarize observations
- Detect state deltas (changes from previous state)
- NO decision making

READ-ONLY - does not modify state.
"""

from typing import Dict, Any, List
from agentic_reasoning.schemas.agent_state import AgentState


def interpret_state(state: AgentState) -> Dict[str, Any]:
    """
    Extract meaningful signals from current state.
    
    This node provides context for downstream nodes without making decisions.
    
    Args:
        state: Current AgentState
    
    Returns:
        Dictionary containing:
        - available_actions: List of action IDs
        - signals: Key observations from UI
        - context: Summary of current situation
        - state_delta: Changes from previous state (if available)
    """
    # Extract available actions
    available_actions = state.ui_state.available_actions
    
    # Extract key observations
    observation = state.ui_state.observation
    signals = extract_signals(observation)
    
    # Compute state delta if we have previous state
    state_delta = None
    if state.execution_context.previous_state:
        state_delta = compute_state_delta(
            previous=state.execution_context.previous_state,
            current=observation
        )
    
    # Summarize context
    context = {
        "step_count": state.execution_context.step_count,
        "actions_executed": len(state.execution_context.action_history),
        "anomalies_detected": len(state.anomalies),
        "page_url": state.ui_state.page_url,
        "page_title": state.ui_state.page_title,
    }
    
    return {
        "available_actions": available_actions,
        "signals": signals,
        "context": context,
        "state_delta": state_delta,
    }


def extract_signals(observation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract meaningful signals from observation.
    
    Signals are notable conditions or patterns in the UI state.
    
    Args:
        observation: UI state observation
    
    Returns:
        Dictionary of signal_name -> value
    """
    signals = {}
    
    # Check for error indicators
    if 'error' in observation or 'error_message' in observation:
        signals['error_present'] = True
        signals['error_details'] = observation.get('error') or observation.get('error_message')
    else:
        signals['error_present'] = False
    
    # Check for loading/busy states
    if observation.get('loading', False) or observation.get('is_busy', False):
        signals['system_busy'] = True
    else:
        signals['system_busy'] = False
    
    # Check for empty states
    if observation.get('empty_state', False) or observation.get('no_data', False):
        signals['data_present'] = False
    else:
        signals['data_present'] = True
    
    # Extract success indicators
    if 'success' in observation or 'success_message' in observation:
        signals['success_present'] = True
        signals['success_details'] = observation.get('success') or observation.get('success_message')
    
    # Extract counts and metrics
    for key in ['element_count', 'item_count', 'result_count', 'error_count']:
        if key in observation:
            signals[key] = observation[key]
    
    # Form/input state
    if 'form_visible' in observation:
        signals['form_visible'] = observation['form_visible']
    
    if 'inputs_filled' in observation:
        signals['inputs_filled'] = observation['inputs_filled']
    
    return signals


def compute_state_delta(
    previous: Dict[str, Any],
    current: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compute delta between previous and current state.
    
    Args:
        previous: Previous observation
        current: Current observation
    
    Returns:
        Dictionary describing changes:
        - added_keys: Keys present in current but not previous
        - removed_keys: Keys present in previous but not current
        - changed_values: Keys with different values
        - unchanged: Whether states are identical
    """
    prev_keys = set(previous.keys())
    curr_keys = set(current.keys())
    
    added_keys = list(curr_keys - prev_keys)
    removed_keys = list(prev_keys - curr_keys)
    
    # Check changed values in common keys
    common_keys = prev_keys & curr_keys
    changed_values = {}
    
    for key in common_keys:
        if previous[key] != current[key]:
            changed_values[key] = {
                "previous": previous[key],
                "current": current[key]
            }
    
    unchanged = (
        len(added_keys) == 0 and
        len(removed_keys) == 0 and
        len(changed_values) == 0
    )
    
    return {
        "added_keys": added_keys,
        "removed_keys": removed_keys,
        "changed_values": changed_values,
        "unchanged": unchanged,
    }


def state_interpreter_node(state: AgentState) -> AgentState:
    """
    LangGraph node for state interpretation.
    
    This node is READ-ONLY and does not modify state.
    Interpretation results are implicitly available to other nodes
    through shared state reading.
    
    Args:
        state: Current AgentState
    
    Returns:
        Unmodified state (interpretation is side-effect free)
    """
    # Perform interpretation (results can be logged but not stored in state)
    interpretation = interpret_state(state)
    
    # In a real implementation, this could be logged for debugging
    # For now, interpretation results are implicit - other nodes
    # extract the same signals when they read the state
    
    return state
