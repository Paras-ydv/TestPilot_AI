"""
Test fixtures for agentic reasoning tests.

Provides mock AgentState instances for testing.
"""

from agentic_reasoning.schemas.agent_state import (
    AgentState,
    UIState,
    ExecutionContext,
    Knowledge,
    Decision,
    ControlDecision,
)
from agentic_reasoning.schemas.action_contract import ActionContract
from agentic_reasoning.schemas.anomaly_report import (
    AnomalyReport,
    AnomalySeverity,
    AnomalyCategory,
    AnomalyEvidence,
)


def create_basic_state() -> AgentState:
    """Create a basic valid AgentState for testing."""
    return AgentState(
        ui_state=UIState(
            available_actions=["click_submit", "fill_input", "navigate_back"],
            observation={
                "form_visible": True,
                "error_message": None,
                "element_count": 5
            },
            page_url="https://example.com/test",
            page_title="Test Page"
        ),
        execution_context=ExecutionContext(
            step_count=1,
            max_steps=100,
            action_history=["navigate_to_page"],
            previous_state={
                "form_visible": False,
                "element_count": 3
            }
        ),
        knowledge=Knowledge(
            baselines={},
            risk_scores={}
        ),
        decision=Decision(
            next_action=None,
            control=ControlDecision.CONTINUE,
            reasoning=None
        ),
        anomalies=[]
    )


def create_state_with_anomalies() -> AgentState:
    """Create AgentState with anomalies for testing."""
    state = create_basic_state()
    
    state.anomalies = [
        AnomalyReport(
            severity=AnomalySeverity.MEDIUM,
            category=AnomalyCategory.INVARIANT_VIOLATION,
            action_id="click_submit",
            description="Cause-effect violation",
            evidence=AnomalyEvidence(
                expected="State should change after action",
                observed="State unchanged"
            )
        )
    ]
    
    return state


def create_state_with_high_severity_anomalies() -> AgentState:
    """Create AgentState with multiple HIGH severity anomalies."""
    state = create_basic_state()
    
    state.anomalies = [
        AnomalyReport(
            severity=AnomalySeverity.HIGH,
            category=AnomalyCategory.INVARIANT_VIOLATION,
            action_id="action_1",
            description="Critical violation 1",
            evidence=AnomalyEvidence(
                expected="Expected behavior",
                observed="Actual behavior"
            )
        ),
        AnomalyReport(
            severity=AnomalySeverity.HIGH,
            category=AnomalyCategory.INVARIANT_VIOLATION,
            action_id="action_2",
            description="Critical violation 2",
            evidence=AnomalyEvidence(
                expected="Expected behavior",
                observed="Actual behavior"
            )
        ),
        AnomalyReport(
            severity=AnomalySeverity.HIGH,
            category=AnomalyCategory.INVARIANT_VIOLATION,
            action_id="action_3",
            description="Critical violation 3",
            evidence=AnomalyEvidence(
                expected="Expected behavior",
                observed="Actual behavior"
            )
        )
    ]
    
    return state


def create_state_no_actions() -> AgentState:
    """Create AgentState with no available actions."""
    state = create_basic_state()
    state.ui_state.available_actions = []
    return state


def create_state_max_steps() -> AgentState:
    """Create AgentState at max steps."""
    state = create_basic_state()
    state.execution_context.step_count = 100
    state.execution_context.max_steps = 100
    return state


def create_state_with_baselines() -> AgentState:
    """Create AgentState with learned baselines."""
    state = create_basic_state()
    
    state.knowledge.baselines = {
        "response_time_ms": {
            "mean": 200.0,
            "std_dev": 50.0,
            "count": 10
        },
        "element_count": {
            "mean": 5.0,
            "std_dev": 1.0,
            "count": 10
        }
    }
    
    state.knowledge.risk_scores = {
        "click_submit": 0.2,
        "fill_input": 0.1,
        "navigate_back": 0.3
    }
    
    return state


def create_state_with_action_history() -> AgentState:
    """Create AgentState with substantial action history."""
    state = create_basic_state()
    
    state.execution_context.action_history = [
        "navigate_to_page",
        "click_submit",
        "fill_input",
        "click_submit",
        "navigate_back"
    ]
    state.execution_context.step_count = 5
    
    return state
