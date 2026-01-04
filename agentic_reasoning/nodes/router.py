"""
Router Node

Makes control flow decision: CONTINUE / DEEP_TEST / TERMINATE

CRITICAL POSITION: Runs AFTER anomaly detection, BEFORE action planning.
This enables early termination without wasted planning cycles.

RESPONSIBILITIES:
- Evaluate termination conditions
- Decide if deep testing is needed
- Make control flow decision
- NO action selection

WRITES: state.decision.control
"""

from agentic_reasoning.schemas.agent_state import AgentState, ControlDecision
from agentic_reasoning.schemas.anomaly_report import AnomalySeverity


def should_terminate(state: AgentState) -> tuple[bool, str]:
    """
    Determine if execution should terminate.
    
    Termination conditions:
    1. No available actions
    2. Max steps reached
    3. Repeated high-severity anomalies (3+ consecutive)
    4. Critical invariant violations
    
    Args:
        state: Current AgentState
    
    Returns:
        Tuple of (should_terminate, reason)
    """
    # 1. No available actions
    if not state.ui_state.available_actions:
        return True, "No available actions remaining"
    
    # 2. Max steps reached
    if state.execution_context.step_count >= state.execution_context.max_steps:
        return True, f"Maximum steps reached ({state.execution_context.max_steps})"
    
    # 3. Repeated high-severity anomalies
    recent_anomalies = state.anomalies[-5:] if len(state.anomalies) >= 5 else state.anomalies
    
    high_severity_count = sum(
        1 for a in recent_anomalies
        if a.severity == AnomalySeverity.HIGH
    )
    
    if high_severity_count >= 3:
        return True, f"Repeated high-severity anomalies ({high_severity_count} in recent history)"
    
    # 4. Check for consecutive high-severity anomalies
    last_3_anomalies = state.anomalies[-3:] if len(state.anomalies) >= 3 else []
    
    if len(last_3_anomalies) == 3:
        all_high_severity = all(a.severity == AnomalySeverity.HIGH for a in last_3_anomalies)
        
        if all_high_severity:
            return True, "Three consecutive high-severity anomalies detected"
    
    # Check total anomaly count - if too many, system is unstable
    if len(state.anomalies) > 20:
        high_severity_ratio = sum(1 for a in state.anomalies if a.severity == AnomalySeverity.HIGH) / len(state.anomalies)
        
        if high_severity_ratio > 0.5:
            return True, "Excessive anomaly rate (>50% high severity)"
    
    return False, ""


def should_deep_test(state: AgentState) -> tuple[bool, str]:
    """
    Determine if deep testing mode should be activated.
    
    Deep test conditions:
    1. Medium severity anomaly detected
    2. Baseline deviation detected (regression)
    3. High risk score for recent action
    
    Args:
        state: Current AgentState
    
    Returns:
        Tuple of (should_deep_test, reason)
    """
    # Check recent anomalies
    recent_anomalies = state.anomalies[-3:] if len(state.anomalies) >= 3 else state.anomalies
    
    # 1. Medium severity anomaly
    has_medium_severity = any(
        a.severity == AnomalySeverity.MEDIUM
        for a in recent_anomalies
    )
    
    if has_medium_severity:
        return True, "Medium severity anomaly detected - activating deep test"
    
    # 2. Baseline deviation (regression category)
    has_regression = any(
        a.category.value == "REGRESSION"
        for a in recent_anomalies
    )
    
    if has_regression:
        return True, "Baseline deviation detected - activating deep test"
    
    # 3. High risk score for recent action
    action_history = state.execution_context.action_history
    if action_history:
        last_action = action_history[-1]
        risk_score = state.knowledge.risk_scores.get(last_action, 0.5)
        
        if risk_score > 0.75:
            return True, f"High risk action detected (risk={risk_score:.2f}) - activating deep test"
    
    # 4. Flaky behavior - same action getting different results
    # This would require more history tracking, placeholder for now
    
    return False, ""


def make_routing_decision(state: AgentState) -> ControlDecision:
    """
    Make control flow decision.
    
    Priority:
    1. TERMINATE if termination conditions met
    2. DEEP_TEST if instability detected
    3. CONTINUE otherwise
    
    Args:
        state: Current AgentState
    
    Returns:
        ControlDecision enum value
    """
    # Check termination first (highest priority)
    terminate, terminate_reason = should_terminate(state)
    
    if terminate:
        state.decision.reasoning = f"TERMINATE: {terminate_reason}"
        return ControlDecision.TERMINATE
    
    # Check deep test
    deep_test, deep_test_reason = should_deep_test(state)
    
    if deep_test:
        state.decision.reasoning = f"DEEP_TEST: {deep_test_reason}"
        return ControlDecision.DEEP_TEST
    
    # Default: continue
    state.decision.reasoning = "CONTINUE: No anomalies or termination conditions detected"
    return ControlDecision.CONTINUE


def router_node(state: AgentState) -> AgentState:
    """
    LangGraph node for routing decision.
    
    CRITICAL: This runs AFTER anomaly detection and BEFORE action planning.
    Enables early termination without wasted planning.
    
    READS: ui_state, execution_context, anomalies, knowledge
    WRITES: decision.control, decision.reasoning
    
    Args:
        state: Current AgentState
    
    Returns:
        State with decision.control updated
    """
    # Make routing decision
    control_decision = make_routing_decision(state)
    
    # Write to state
    state.decision.control = control_decision
    
    return state
