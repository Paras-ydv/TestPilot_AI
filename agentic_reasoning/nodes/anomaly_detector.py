"""
Anomaly Detector Node

Applies invariants and detects violations.

RESPONSIBILITIES:
- Run all core invariants
- Check stability against baselines
- Generate AnomalyReports
- NO control decisions

WRITES: state.anomalies (append only)
"""

from typing import List, Optional
from agentic_reasoning.schemas.agent_state import AgentState
from agentic_reasoning.schemas.anomaly_report import (
    AnomalyReport,
    AnomalySeverity,
    AnomalyCategory,
)
from agentic_reasoning.invariants.core_invariants import (
    check_cause_effect_invariant,
    check_api_ui_consistency,
    check_entity_continuity,
    check_forward_progress,
    check_action_availability_consistency,
)
from agentic_reasoning.invariants.baseline_checks import (
    check_stability_against_baseline,
    extract_metrics_from_observation,
)


def detect_anomalies(state: AgentState) -> List[AnomalyReport]:
    """
    Run all invariant checks and detect anomalies.
    
    Args:
        state: Current AgentState
    
    Returns:
        List of detected anomalies (may be empty)
    """
    anomalies = []
    
    # Get context
    current_observation = state.ui_state.observation
    previous_observation = state.execution_context.previous_state or {}
    action_history = state.execution_context.action_history
    last_action = action_history[-1] if action_history else None
    
    # 1. Cause-Effect Invariant
    if last_action and previous_observation:
        cause_effect = check_cause_effect_invariant(
            action_id=last_action,
            previous_observation=previous_observation,
            current_observation=current_observation,
            action_was_successful=True  # Assume success unless we have failure info
        )
        
        if cause_effect.violated:
            anomalies.append(AnomalyReport(
                severity=AnomalySeverity.MEDIUM,
                category=AnomalyCategory.INVARIANT_VIOLATION,
                action_id=last_action,
                description=cause_effect.description,
                evidence=cause_effect.evidence
            ))
    
    # 2. API-UI Consistency (if we have API response data)
    api_response = current_observation.get('_api_response')
    if api_response:
        expected_ui_fields = current_observation.get('_expected_ui_fields', [])
        api_ui_check = check_api_ui_consistency(
            api_response=api_response,
            ui_observation=current_observation,
            expected_ui_fields=expected_ui_fields
        )
        
        if api_ui_check.violated:
            anomalies.append(AnomalyReport(
                severity=AnomalySeverity.HIGH,
                category=AnomalyCategory.INVARIANT_VIOLATION,
                action_id=last_action,
                description=api_ui_check.description,
                evidence=api_ui_check.evidence
            ))
    
    # 3. Entity Continuity
    previous_entities = previous_observation.get('entities', {})
    current_entities = current_observation.get('entities', {})
    
    if previous_entities and last_action:
        entity_check = check_entity_continuity(
            previous_entities=previous_entities,
            current_entities=current_entities,
            action_id=last_action
        )
        
        if entity_check.violated:
            anomalies.append(AnomalyReport(
                severity=AnomalySeverity.HIGH,
                category=AnomalyCategory.INVARIANT_VIOLATION,
                action_id=last_action,
                description=entity_check.description,
                evidence=entity_check.evidence
            ))
    
    # 4. Forward Progress
    # Need at least a few steps to check
    if state.execution_context.step_count >= 3:
        # Build observation history from what we have
        # In real implementation, this would be maintained in execution_context
        observation_history = [previous_observation, current_observation]
        
        progress_check = check_forward_progress(
            action_history=action_history,
            observation_history=observation_history,
            max_identical_observations=3
        )
        
        if progress_check.violated:
            anomalies.append(AnomalyReport(
                severity=AnomalySeverity.HIGH,
                category=AnomalyCategory.INSTABILITY,
                action_id=last_action,
                description=progress_check.description,
                evidence=progress_check.evidence
            ))
    
    # 5. Action Availability Consistency
    if previous_observation and last_action:
        prev_actions = previous_observation.get('_available_actions', [])
        curr_actions = state.ui_state.available_actions
        
        availability_check = check_action_availability_consistency(
            previous_available_actions=prev_actions,
            current_available_actions=curr_actions,
            action_executed=last_action
        )
        
        if availability_check.violated:
            anomalies.append(AnomalyReport(
                severity=AnomalySeverity.MEDIUM,
                category=AnomalyCategory.INVARIANT_VIOLATION,
                action_id=last_action,
                description=availability_check.description,
                evidence=availability_check.evidence
            ))
    
    # 6. Baseline Stability Checks
    # Extract metrics from observation
    metrics = extract_metrics_from_observation(current_observation, last_action)
    
    for metric_name, metric_value in metrics.items():
        baseline = state.knowledge.baselines.get(metric_name)
        
        stability_check, updated_baseline = check_stability_against_baseline(
            metric_name=metric_name,
            current_value=metric_value,
            baseline=baseline,
            sigma_threshold=2.0
        )
        
        # Update baseline in state (this is allowed)
        if updated_baseline:
            state.knowledge.baselines[metric_name] = updated_baseline.to_dict()
        
        if stability_check.violated:
            anomalies.append(AnomalyReport(
                severity=AnomalySeverity.MEDIUM,
                category=AnomalyCategory.REGRESSION,
                action_id=last_action,
                description=stability_check.description,
                evidence=stability_check.evidence
            ))
    
    return anomalies


def anomaly_detector_node(state: AgentState) -> AgentState:
    """
    LangGraph node for anomaly detection.
    
    Runs all invariant checks and appends detected anomalies to state.
    
    WRITES: state.anomalies (append only)
    WRITES: state.knowledge.baselines (update)
    
    Args:
        state: Current AgentState
    
    Returns:
        State with anomalies appended and baselines updated
    """
    # Detect anomalies
    new_anomalies = detect_anomalies(state)
    
    # Append to state anomalies
    state.anomalies.extend(new_anomalies)
    
    return state
