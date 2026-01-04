"""
End-to-end tests for the reasoning graph.

Tests the complete LangGraph workflow with various scenarios.
"""

import pytest
from agentic_reasoning.graph import create_reasoning_graph
from agentic_reasoning.schemas.agent_state import ControlDecision, AgentState
from tests.fixtures import (
    create_basic_state,
    create_state_with_anomalies,
    create_state_with_high_severity_anomalies,
    create_state_no_actions,
    create_state_max_steps,
)


def get_state(result) -> AgentState:
    """Convert LangGraph result to AgentState."""
    if isinstance(result, dict):
        return AgentState(**result)
    return result


class TestReasoningGraphExecution:
    """Test end-to-end graph execution."""
    
    def test_graph_executes_with_basic_state(self):
        """Test that graph runs successfully with basic state."""
        graph = create_reasoning_graph()
        initial_state = create_basic_state()
        
        # Execute graph
        result = graph.invoke(initial_state)
        final_state = get_state(result)
        
        assert final_state is not None
        assert final_state.decision is not None
        assert final_state.anomalies is not None
    
    def test_graph_continues_with_no_anomalies(self):
        """Test that graph decides to CONTINUE when no anomalies."""
        graph = create_reasoning_graph()
        initial_state = create_basic_state()
        
        result = graph.invoke(initial_state)
        final_state = get_state(result)
        
        # Should decide to continue
        assert final_state.decision.control == ControlDecision.CONTINUE
        
        # Should select an action
        assert final_state.decision.next_action is not None
        assert final_state.decision.next_action.action_id in initial_state.ui_state.available_actions
    
    def test_graph_terminates_with_no_actions(self):
        """Test that graph terminates when no actions available."""
        graph = create_reasoning_graph()
        initial_state = create_state_no_actions()
        
        result = graph.invoke(initial_state)
        final_state = get_state(result)
        
        # Should terminate
        assert final_state.decision.control == ControlDecision.TERMINATE
        
        # No action should be selected
        assert final_state.decision.next_action is None
    
    def test_graph_terminates_at_max_steps(self):
        """Test that graph terminates at max steps."""
        graph = create_reasoning_graph()
        initial_state = create_state_max_steps()
        
        result = graph.invoke(initial_state)
        final_state = get_state(result)
        
        # Should terminate
        assert final_state.decision.control == ControlDecision.TERMINATE
    
    def test_graph_terminates_with_repeated_high_severity_anomalies(self):
        """Test that graph terminates with 3+ HIGH severity anomalies."""
        graph = create_reasoning_graph()
        initial_state = create_state_with_high_severity_anomalies()
        
        result = graph.invoke(initial_state)
        final_state = get_state(result)
        
        # Should terminate due to repeated high severity
        assert final_state.decision.control == ControlDecision.TERMINATE
    
    def test_graph_never_invents_actions(self):
        """CRITICAL: Test that graph never invents actions."""
        graph = create_reasoning_graph()
        initial_state = create_basic_state()
        available = initial_state.ui_state.available_actions
        
        result = graph.invoke(initial_state)
        final_state = get_state(result)
        
        # If action selected, it MUST be from available_actions
        if final_state.decision.next_action:
            assert final_state.decision.next_action.action_id in available
