"""
Tests for invariant checks.

Tests all core invariants and baseline checks.
"""

import pytest
from agentic_reasoning.invariants.core_invariants import (
    check_cause_effect_invariant,
    check_api_ui_consistency,
    check_entity_continuity,
    check_forward_progress,
    check_action_availability_consistency,
)
from agentic_reasoning.invariants.baseline_checks import (
    BaselineMetrics,
    check_stability_against_baseline,
    extract_metrics_from_observation,
)


class TestCauseEffectInvariant:
    """Test cause-effect invariant."""
    
    def test_violation_when_no_state_change(self):
        """Test violation when state doesn't change after action."""
        previous = {"button_enabled": True}
        current = {"button_enabled": True}
        
        result = check_cause_effect_invariant(
            action_id="click_submit",
            previous_observation=previous,
            current_observation=current,
            action_was_successful=True
        )
        
        assert result.violated is True
        assert result.evidence is not None
    
    def test_no_violation_when_state_changes(self):
        """Test no violation when state changes."""
        previous = {"button_enabled": True}
        current = {"button_enabled": False, "form_submitted": True}
        
        result = check_cause_effect_invariant(
            action_id="click_submit",
            previous_observation=previous,
            current_observation=current,
            action_was_successful=True
        )
        
        assert result.violated is False
    
    def test_no_violation_when_action_failed(self):
        """Test no violation expected when action failed."""
        previous = {"state": "A"}
        current = {"state": "A"}
        
        result = check_cause_effect_invariant(
            action_id="failing_action",
            previous_observation=previous,
            current_observation=current,
            action_was_successful=False
        )
        
        assert result.violated is False


class TestAPIUIConsistency:
    """Test API-UI consistency invariant."""
    
    def test_violation_when_api_success_but_ui_not_updated(self):
        """Test violation when API succeeds but UI missing fields."""
        api_response = {"success": True, "user_id": "123"}
        ui_observation = {"error": "Not found"}
        expected_fields = ["user_id", "username"]
        
        result = check_api_ui_consistency(
            api_response=api_response,
            ui_observation=ui_observation,
            expected_ui_fields=expected_fields
        )
        
        assert result.violated is True
    
    def test_no_violation_when_ui_fields_present(self):
        """Test no violation when expected UI fields present."""
        api_response = {"success": True}
        ui_observation = {"user_id": "123", "username": "john"}
        expected_fields = ["user_id", "username"]
        
        result = check_api_ui_consistency(
            api_response=api_response,
            ui_observation=ui_observation,
            expected_ui_fields=expected_fields
        )
        
        assert result.violated is False
    
    def test_no_check_when_no_api_response(self):
        """Test invariant skipped when no API response."""
        result = check_api_ui_consistency(
            api_response=None,
            ui_observation={},
            expected_ui_fields=[]
        )
        
        assert result.violated is False


class TestEntityContinuity:
    """Test entity continuity invariant."""
    
    def test_violation_when_entity_disappears(self):
        """Test violation when entity disappears without delete."""
        previous = {"user_123": {"name": "John"}, "post_456": {"title": "Hello"}}
        current = {"user_123": {"name": "John"}}
        
        result = check_entity_continuity(
            previous_entities=previous,
            current_entities=current,
            action_id="create_comment"
        )
        
        assert result.violated is True
        assert "post_456" in str(result.evidence.observed)
    
    def test_no_violation_for_delete_action(self):
        """Test no violation when entity disappears during delete."""
        previous = {"user_123": {"name": "John"}, "post_456": {"title": "Hello"}}
        current = {"user_123": {"name": "John"}}
        
        result = check_entity_continuity(
            previous_entities=previous,
            current_entities=current,
            action_id="delete_post"
        )
        
        assert result.violated is False
    
    def test_no_violation_when_entities_persist(self):
        """Test no violation when entities persist."""
        previous = {"user_123": {"name": "John"}}
        current = {"user_123": {"name": "John"}, "post_456": {"title": "New"}}
        
        result = check_entity_continuity(
            previous_entities=previous,
            current_entities=current,
            action_id="create_post"
        )
        
        assert result.violated is False


class TestForwardProgress:
    """Test forward progress invariant."""
    
    def test_violation_when_stalled(self):
        """Test violation when observations identical despite actions."""
        actions = ["action1", "action2", "action3"]
        observations = [
            {"state": "A"},
            {"state": "A"},
            {"state": "A"}
        ]
        
        result = check_forward_progress(
            action_history=actions,
            observation_history=observations,
            max_identical_observations=3
        )
        
        assert result.violated is True
    
    def test_no_violation_with_progress(self):
        """Test no violation when state changes."""
        actions = ["action1", "action2"]
        observations = [
            {"state": "A"},
            {"state": "B"}
        ]
        
        result = check_forward_progress(
            action_history=actions,
            observation_history=observations,
            max_identical_observations=3
        )
        
        assert result.violated is False
    
    def test_no_violation_with_insufficient_history(self):
        """Test no violation when not enough history."""
        actions = ["action1"]
        observations = [{"state": "A"}]
        
        result = check_forward_progress(
            action_history=actions,
            observation_history=observations,
            max_identical_observations=3
        )
        
        assert result.violated is False


class TestActionAvailabilityConsistency:
    """Test action availability consistency."""
    
    def test_violation_when_state_changing_action_no_effect(self):
        """Test violation when state-changing action doesn't affect actions."""
        previous_actions = ["login", "fill_username", "fill_password"]
        current_actions = ["login", "fill_username", "fill_password"]
        
        result = check_action_availability_consistency(
            previous_available_actions=previous_actions,
            current_available_actions=current_actions,
            action_executed="submit_login"
        )
        
        assert result.violated is True
    
    def test_no_violation_for_non_state_changing_action(self):
        """Test no violation for non-state-changing actions."""
        previous_actions = ["click_button"]
        current_actions = ["click_button"]
        
        result = check_action_availability_consistency(
            previous_available_actions=previous_actions,
            current_available_actions=current_actions,
            action_executed="hover_element"
        )
        
        assert result.violated is False


class TestBaselineChecks:
    """Test baseline stability checks."""
    
    def test_baseline_metrics_initialization(self):
        """Test creating baseline metrics."""
        baseline = BaselineMetrics(mean=100.0, std_dev=10.0, count=5)
        
        assert baseline.mean == 100.0
        assert baseline.std_dev == 10.0
        assert baseline.count == 5
    
    def test_baseline_metrics_update(self):
        """Test updating baseline with new value."""
        baseline = BaselineMetrics(mean=100.0, std_dev=10.0, count=5)
        updated = baseline.update(120.0)
        
        # Mean should move toward new value
        assert updated.count == 6
        assert updated.mean > 100.0
    
    def test_stability_check_no_violation_within_threshold(self):
        """Test no violation when value within threshold."""
        baseline = {"mean": 200.0, "std_dev": 50.0, "count": 10}
        
        violation, updated = check_stability_against_baseline(
            metric_name="response_time_ms",
            current_value=220.0,  # Within 2σ
            baseline=baseline,
            sigma_threshold=2.0
        )
        
        assert violation.violated is False
        assert updated is not None
    
    def test_stability_check_violation_beyond_threshold(self):
        """Test violation when value exceeds threshold."""
        baseline = {"mean": 200.0, "std_dev": 50.0, "count": 10}
        
        violation, updated = check_stability_against_baseline(
            metric_name="response_time_ms",
            current_value=500.0,  # Way beyond 2σ
            baseline=baseline,
            sigma_threshold=2.0
        )
        
        assert violation.violated is True
        assert "z" in str(violation.evidence.observed).lower() or "deviation" in str(violation.evidence.observed).lower()
    
    def test_stability_check_initializes_baseline(self):
        """Test baseline initialization on first observation."""
        violation, baseline = check_stability_against_baseline(
            metric_name="new_metric",
            current_value=100.0,
            baseline=None,
            sigma_threshold=2.0
        )
        
        # No violation on first observation
        assert violation.violated is False
        
        # Baseline should be initialized
        assert baseline is not None
        assert baseline.mean == 100.0
        assert baseline.count == 1
    
    def test_extract_metrics_from_observation(self):
        """Test extracting metrics from observation."""
        observation = {
            "response_time_ms": 250,
            "element_count": 10,
            "error_count": 0,
            "other_field": "ignored"
        }
        
        metrics = extract_metrics_from_observation(observation)
        
        assert "response_time_ms" in metrics
        assert metrics["response_time_ms"] == 250.0
        assert "element_count" in metrics
