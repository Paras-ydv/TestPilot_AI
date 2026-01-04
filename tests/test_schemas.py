"""
Tests for schema validation.

Tests Pydantic schemas for correctness and validation rules.
"""

import pytest
from pydantic import ValidationError
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


class TestActionContract:
    """Test ActionContract schema."""
    
    def test_valid_action_contract(self):
        """Test creating valid ActionContract."""
        action = ActionContract(
            action_id="click_submit",
            parameters={"wait": True}
        )
        
        assert action.action_id == "click_submit"
        assert action.parameters == {"wait": True}
    
    def test_action_contract_rejects_empty_action_id(self):
        """Test that empty action_id is rejected."""
        with pytest.raises(ValidationError):
            ActionContract(action_id="", parameters={})
    
    def test_action_contract_rejects_selectors(self):
        """CRITICAL: Test that selectors are rejected."""
        with pytest.raises(ValidationError):
            ActionContract(
                action_id="click_button",
                parameters={"selector": "#submit-btn"}
            )
    
    def test_action_contract_rejects_dom_references(self):
        """CRITICAL: Test that DOM references are rejected."""
        with pytest.raises(ValidationError):
            ActionContract(
                action_id="click_button",
                parameters={"dom": "<div>...</div>"}
            )
    
    def test_action_contract_allows_valid_parameters(self):
        """Test that valid parameters are allowed."""
        action = ActionContract(
            action_id="wait_for_element",
            parameters={
                "timeout_ms": 5000,
                "retry_count": 3,
                "wait_for_response": True
            }
        )
        
        assert action.parameters["timeout_ms"] == 5000


class TestAnomalyReport:
    """Test AnomalyReport schema."""
    
    def test_valid_anomaly_report(self):
        """Test creating valid AnomalyReport."""
        report = AnomalyReport(
            severity=AnomalySeverity.HIGH,
            category=AnomalyCategory.INVARIANT_VIOLATION,
            action_id="click_submit",
            description="Test anomaly",
            evidence=AnomalyEvidence(
                expected="State change",
                observed="No change"
            )
        )
        
        assert report.severity == AnomalySeverity.HIGH
        assert report.category == AnomalyCategory.INVARIANT_VIOLATION
        assert report.description == "Test anomaly"
    
    def test_anomaly_severities(self):
        """Test all severity levels."""
        for severity in [AnomalySeverity.LOW, AnomalySeverity.MEDIUM, AnomalySeverity.HIGH]:
            report = AnomalyReport(
                severity=severity,
                category=AnomalyCategory.REGRESSION,
                description="Test",
                evidence=AnomalyEvidence(expected="A", observed="B")
            )
            assert report.severity == severity
    
    def test_anomaly_categories(self):
        """Test all categories."""
        categories = [
            AnomalyCategory.INVARIANT_VIOLATION,
            AnomalyCategory.REGRESSION,
            AnomalyCategory.INSTABILITY
        ]
        
        for category in categories:
            report = AnomalyReport(
                severity=AnomalySeverity.MEDIUM,
                category=category,
                description="Test",
                evidence=AnomalyEvidence(expected="A", observed="B")
            )
            assert report.category == category


class TestAgentState:
    """Test AgentState schema."""
    
    def test_valid_agent_state(self):
        """Test creating valid AgentState."""
        state = AgentState(
            ui_state=UIState(
                available_actions=["action1", "action2"],
                observation={"key": "value"}
            ),
            execution_context=ExecutionContext(
                step_count=1,
                max_steps=100
            )
        )
        
        assert len(state.ui_state.available_actions) == 2
        assert state.execution_context.step_count == 1
    
    def test_agent_state_defaults(self):
        """Test default values."""
        state = AgentState()
        
        assert state.ui_state is not None
        assert state.execution_context is not None
        assert state.knowledge is not None
        assert state.decision is not None
        assert isinstance(state.anomalies, list)
        assert len(state.anomalies) == 0
    
    def test_agent_state_decision_defaults(self):
        """Test Decision defaults."""
        state = AgentState()
        
        assert state.decision.next_action is None
        assert state.decision.control == ControlDecision.CONTINUE
        assert state.decision.reasoning is None


class TestUIState:
    """Test UIState schema."""
    
    def test_ui_state_with_actions(self):
        """Test UIState with actions."""
        ui_state = UIState(
            available_actions=["click", "type", "navigate"],
            observation={"visible": True}
        )
        
        assert len(ui_state.available_actions) == 3
        assert ui_state.observation["visible"] is True
    
    def test_ui_state_empty_actions(self):
        """Test UIState with no actions."""
        ui_state = UIState(
            available_actions=[],
            observation={}
        )
        
        assert len(ui_state.available_actions) == 0


class TestKnowledge:
    """Test Knowledge schema."""
    
    def test_knowledge_baselines(self):
        """Test Knowledge baselines."""
        knowledge = Knowledge(
            baselines={
                "response_time_ms": {"mean": 200, "std_dev": 50}
            }
        )
        
        assert "response_time_ms" in knowledge.baselines
        assert knowledge.baselines["response_time_ms"]["mean"] == 200
    
    def test_knowledge_risk_scores(self):
        """Test Knowledge risk scores."""
        knowledge = Knowledge(
            risk_scores={
                "action1": 0.2,
                "action2": 0.8
            }
        )
        
        assert knowledge.risk_scores["action1"] == 0.2
        assert knowledge.risk_scores["action2"] == 0.8
