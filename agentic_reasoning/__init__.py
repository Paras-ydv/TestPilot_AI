"""
Agentic Reasoning Layer for DAD Agent

A LangGraph-based control plane that interprets system state, plans actions,
detects anomalies via invariants & baselines, learns from observations,
and branches safely (explore / deep test / terminate).

HARD CONSTRAINTS:
- Never read raw DOM
- Never read Playwright logs directly
- Never invent actions (only choose from ui_state.available_actions)
- Never assume business success/failure
- Runtime behavior is the only oracle

This module validates COHERENCE, not CORRECTNESS.
"""

from agentic_reasoning.graph import create_reasoning_graph
from agentic_reasoning.schemas.agent_state import AgentState
from agentic_reasoning.schemas.action_contract import ActionContract
from agentic_reasoning.schemas.anomaly_report import AnomalyReport, AnomalySeverity, AnomalyCategory

__all__ = [
    "create_reasoning_graph",
    "AgentState",
    "ActionContract",
    "AnomalyReport",
    "AnomalySeverity",
    "AnomalyCategory",
]

__version__ = "0.1.0"
