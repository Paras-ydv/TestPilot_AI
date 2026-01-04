"""
Core Invariants

Implements the 5 core invariants that the reasoning layer uses to detect
anomalies in system behavior.

PHILOSOPHY: These invariants validate COHERENCE, not CORRECTNESS.
We check that the system behaves consistently and predictably.

Invariants:
1. Cause-Effect: Actions cause observable changes
2. API-UI Consistency: Successful API calls reflect in UI
3. Entity Continuity: IDs persist across steps
4. Forward Progress: No silent stalls after success actions
5. (Stability is in baseline_checks.py)
"""

from typing import Dict, Any, Optional, Tuple, List
from agentic_reasoning.schemas.anomaly_report import AnomalyEvidence


class InvariantViolation:
    """Result of an invariant check."""
    
    def __init__(
        self,
        violated: bool,
        evidence: Optional[AnomalyEvidence] = None,
        description: str = ""
    ):
        self.violated = violated
        self.evidence = evidence
        self.description = description


def check_cause_effect_invariant(
    action_id: str,
    previous_observation: Dict[str, Any],
    current_observation: Dict[str, Any],
    action_was_successful: bool = True
) -> InvariantViolation:
    """
    Invariant: If an action executes successfully, some observable state should change.
    
    Args:
        action_id: ID of the action that was executed
        previous_observation: UI state before action
        current_observation: UI state after action
        action_was_successful: Whether the action reported success
    
    Returns:
        InvariantViolation indicating if invariant was violated
    """
    # If action failed, we don't expect state change
    if not action_was_successful:
        return InvariantViolation(violated=False)
    
    # Check if observations are identical
    observations_identical = previous_observation == current_observation
    
    if observations_identical:
        return InvariantViolation(
            violated=True,
            evidence=AnomalyEvidence(
                expected=f"Action '{action_id}' should cause observable state change",
                observed="UI state unchanged after action execution"
            ),
            description=f"Cause-Effect violation: Action '{action_id}' executed but no observable change detected"
        )
    
    return InvariantViolation(violated=False)


def check_api_ui_consistency(
    api_response: Optional[Dict[str, Any]],
    ui_observation: Dict[str, Any],
    expected_ui_fields: List[str]
) -> InvariantViolation:
    """
    Invariant: If API succeeds, the change should be reflected in UI/state.
    
    Args:
        api_response: Response from API call (if any)
        ui_observation: Current UI state observation
        expected_ui_fields: Fields expected to be present/updated in UI
    
    Returns:
        InvariantViolation indicating if invariant was violated
    """
    if api_response is None:
        # No API call, can't check this invariant
        return InvariantViolation(violated=False)
    
    # Check if API indicated success
    api_success = api_response.get('success', False) or api_response.get('status') == 'ok'
    
    if not api_success:
        # API failed, no UI consistency expected
        return InvariantViolation(violated=False)
    
    # Check if expected UI fields are present
    missing_fields = [field for field in expected_ui_fields if field not in ui_observation]
    
    if missing_fields:
        return InvariantViolation(
            violated=True,
            evidence=AnomalyEvidence(
                expected=f"API success should reflect in UI fields: {expected_ui_fields}",
                observed=f"Missing UI fields: {missing_fields}"
            ),
            description=f"API-UI Consistency violation: API succeeded but UI fields not updated"
        )
    
    return InvariantViolation(violated=False)


def check_entity_continuity(
    previous_entities: Dict[str, Any],
    current_entities: Dict[str, Any],
    action_id: str
) -> InvariantViolation:
    """
    Invariant: Entity IDs should persist across steps unless explicitly deleted.
    
    Args:
        previous_entities: Entity map from previous state (e.g., {"user_123": {...}})
        current_entities: Entity map from current state
        action_id: ID of action that was executed
    
    Returns:
        InvariantViolation indicating if invariant was violated
    """
    # Check if any previously existing entities disappeared
    disappeared_entities = []
    
    for entity_id in previous_entities.keys():
        if entity_id not in current_entities:
            # Entity disappeared - only OK if action was explicitly a delete
            if 'delete' not in action_id.lower() and 'remove' not in action_id.lower():
                disappeared_entities.append(entity_id)
    
    if disappeared_entities:
        return InvariantViolation(
            violated=True,
            evidence=AnomalyEvidence(
                expected="Entity IDs should persist unless explicitly deleted",
                observed=f"Entities disappeared: {disappeared_entities}",
                additional_context={"action_id": action_id}
            ),
            description=f"Entity Continuity violation: Entities {disappeared_entities} disappeared after non-delete action"
        )
    
    return InvariantViolation(violated=False)


def check_forward_progress(
    action_history: List[str],
    observation_history: List[Dict[str, Any]],
    max_identical_observations: int = 3
) -> InvariantViolation:
    """
    Invariant: System should make forward progress (no silent stalls).
    
    If the same observation repeats too many times despite different actions,
    the system is stalled.
    
    Args:
        action_history: Recent action IDs executed
        observation_history: Recent observations
        max_identical_observations: Max allowed identical consecutive observations
    
    Returns:
        InvariantViolation indicating if invariant was violated
    """
    if len(observation_history) < max_identical_observations:
        return InvariantViolation(violated=False)
    
    # Check last N observations
    recent_observations = observation_history[-max_identical_observations:]
    
    # Check if all recent observations are identical
    first_obs = recent_observations[0]
    all_identical = all(obs == first_obs for obs in recent_observations)
    
    if all_identical and len(action_history) >= max_identical_observations:
        recent_actions = action_history[-max_identical_observations:]
        
        return InvariantViolation(
            violated=True,
            evidence=AnomalyEvidence(
                expected="System should make forward progress",
                observed=f"Same observation repeated {max_identical_observations} times despite actions: {recent_actions}",
                additional_context={
                    "identical_observation_count": max_identical_observations,
                    "stalled_actions": recent_actions
                }
            ),
            description=f"Forward Progress violation: System stalled with identical observations"
        )
    
    return InvariantViolation(violated=False)


def check_action_availability_consistency(
    previous_available_actions: List[str],
    current_available_actions: List[str],
    action_executed: str
) -> InvariantViolation:
    """
    Invariant: Available actions should change logically.
    
    If available actions are identical after an action that should change state,
    something may be wrong.
    
    Args:
        previous_available_actions: Actions available before
        current_available_actions: Actions available now
        action_executed: Action that was executed
    
    Returns:
        InvariantViolation indicating if invariant was violated
    """
    # If action executed was a navigation or state-changing action,
    # available actions should typically change
    state_changing_keywords = ['submit', 'navigate', 'create', 'delete', 'update', 'login', 'logout']
    
    is_state_changing = any(keyword in action_executed.lower() for keyword in state_changing_keywords)
    
    if is_state_changing:
        actions_identical = set(previous_available_actions) == set(current_available_actions)
        
        if actions_identical:
            return InvariantViolation(
                violated=True,
                evidence=AnomalyEvidence(
                    expected=f"State-changing action '{action_executed}' should alter available actions",
                    observed=f"Available actions unchanged: {current_available_actions}",
                    additional_context={"action_executed": action_executed}
                ),
                description=f"Action Availability violation: State-changing action didn't affect available actions"
            )
    
    return InvariantViolation(violated=False)
