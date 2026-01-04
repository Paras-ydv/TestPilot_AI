"""
Action Contract Schema

Defines the contract for actions that the reasoning layer can choose.
Actions must exist in ui_state.available_actions - the reasoning layer
NEVER invents actions.

CONSTRAINTS:
- action_id must be a string
- action_id must exist in available_actions
- parameters must be a dict
- No selectors allowed
- No DOM references allowed
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator


class ActionContract(BaseModel):
    """
    Contract for an action to be executed.
    
    The reasoning layer outputs this schema when it decides to continue.
    The action_id MUST exist in ui_state.available_actions.
    """
    
    action_id: str = Field(
        ...,
        description="ID of the action to execute. Must exist in available_actions.",
        min_length=1
    )
    
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Parameters for the action. No selectors or DOM references allowed."
    )
    
    @field_validator('action_id')
    @classmethod
    def validate_action_id(cls, v: str) -> str:
        """Ensure action_id is a non-empty string."""
        if not v or not v.strip():
            raise ValueError("action_id cannot be empty")
        return v.strip()
    
    @field_validator('parameters')
    @classmethod
    def validate_parameters(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure no forbidden keys in parameters."""
        forbidden_keys = {'selector', 'css_selector', 'xpath', 'dom'}
        
        for key in v.keys():
            if key.lower() in forbidden_keys:
                raise ValueError(
                    f"Forbidden parameter '{key}'. "
                    "Action parameters cannot contain selectors or DOM references."
                )
        
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "action_id": "click_submit_button",
                "parameters": {
                    "wait_for_response": True,
                    "timeout_ms": 5000
                }
            }
        }
