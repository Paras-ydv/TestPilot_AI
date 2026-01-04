"""
Agent State Schema

Defines the complete state structure for the DAD Agent reasoning layer.

CRITICAL RULES:
- The reasoning layer may READ all fields
- The reasoning layer may WRITE ONLY to:
  - decision
  - anomalies
  - knowledge.baselines
  - knowledge.risk_scores

All other fields are READ-ONLY.
"""

from typing import Dict, Any, List, Optional
from enum import Enum
from pydantic import BaseModel, Field
from agentic_reasoning.schemas.action_contract import ActionContract
from agentic_reasoning.schemas.anomaly_report import AnomalyReport


class ControlDecision(str, Enum):
    """Control flow decisions."""
    CONTINUE = "CONTINUE"
    DEEP_TEST = "DEEP_TEST"
    TERMINATE = "TERMINATE"


class UIState(BaseModel):
    """
    State of the UI as observed by external modules.
    
    READ-ONLY for reasoning layer.
    Populated by browser/DOM modules.
    """
    
    available_actions: List[str] = Field(
        default_factory=list,
        description="List of action IDs that can currently be executed"
    )
    
    observation: Dict[str, Any] = Field(
        default_factory=dict,
        description="Current UI state observations (no raw DOM, structured data only)"
    )
    
    page_url: Optional[str] = Field(
        default=None,
        description="Current page URL"
    )
    
    page_title: Optional[str] = Field(
        default=None,
        description="Current page title"
    )


class Knowledge(BaseModel):
    """
    Learned knowledge and baselines.
    
    baselines and risk_scores are WRITABLE by reasoning layer.
    """
    
    baselines: Dict[str, Any] = Field(
        default_factory=dict,
        description="Learned baseline behaviors (mean, std dev, etc.)"
    )
    
    risk_scores: Dict[str, float] = Field(
        default_factory=dict,
        description="Risk scores for each action (0.0 = safe, 1.0 = high risk)"
    )


class Decision(BaseModel):
    """
    Decision output from the reasoning layer.
    
    WRITABLE by reasoning layer.
    """
    
    next_action: Optional[ActionContract] = Field(
        default=None,
        description="Next action to execute, or None if terminating"
    )
    
    control: ControlDecision = Field(
        default=ControlDecision.CONTINUE,
        description="Control flow decision"
    )
    
    reasoning: Optional[str] = Field(
        default=None,
        description="Human-readable explanation of the decision"
    )


class ExecutionContext(BaseModel):
    """
    Execution context and history.
    
    READ-ONLY for reasoning layer.
    """
    
    step_count: int = Field(
        default=0,
        description="Number of steps executed so far"
    )
    
    max_steps: int = Field(
        default=100,
        description="Maximum number of steps before forced termination"
    )
    
    action_history: List[str] = Field(
        default_factory=list,
        description="History of action IDs executed"
    )
    
    previous_state: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Previous UI state for delta comparison"
    )


class AgentState(BaseModel):
    """
    Complete state for the DAD Agent reasoning layer.
    
    WRITE PERMISSIONS:
    - decision (full)
    - anomalies (append only)
    - knowledge.baselines (update)
    - knowledge.risk_scores (update)
    
    READ-ONLY:
    - ui_state
    - execution_context
    """
    
    ui_state: UIState = Field(
        default_factory=UIState,
        description="Current UI state (READ-ONLY)"
    )
    
    execution_context: ExecutionContext = Field(
        default_factory=ExecutionContext,
        description="Execution context and history (READ-ONLY)"
    )
    
    knowledge: Knowledge = Field(
        default_factory=Knowledge,
        description="Learned baselines and risk scores (baselines and risk_scores WRITABLE)"
    )
    
    decision: Decision = Field(
        default_factory=Decision,
        description="Decision output (WRITABLE)"
    )
    
    anomalies: List[AnomalyReport] = Field(
        default_factory=list,
        description="Detected anomalies (APPEND-ONLY)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "ui_state": {
                    "available_actions": ["click_login", "fill_username", "fill_password"],
                    "observation": {
                        "form_visible": True,
                        "error_message": None
                    },
                    "page_url": "https://example.com/login",
                    "page_title": "Login Page"
                },
                "execution_context": {
                    "step_count": 5,
                    "max_steps": 100,
                    "action_history": ["navigate_to_login", "fill_username"]
                },
                "knowledge": {
                    "baselines": {
                        "login_flow_duration_ms": {"mean": 2500, "std": 300}
                    },
                    "risk_scores": {
                        "click_login": 0.1,
                        "fill_username": 0.05
                    }
                },
                "decision": {
                    "next_action": {
                        "action_id": "fill_password",
                        "parameters": {}
                    },
                    "control": "CONTINUE"
                },
                "anomalies": []
            }
        }
