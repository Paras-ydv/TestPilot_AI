"""
Risk Policy

Implements risk scoring and management for actions.

GOAL: Track which actions are unstable or trigger anomalies,
and adjust exploration to avoid high-risk actions when prudent.
"""

from typing import Dict, List
from agentic_reasoning.schemas.anomaly_report import AnomalyReport, AnomalySeverity


def initialize_risk_scores(available_actions: List[str]) -> Dict[str, float]:
    """
    Initialize risk scores for actions.
    
    All actions start with neutral risk (0.5).
    
    Args:
        available_actions: List of action IDs
    
    Returns:
        Dictionary mapping action_id -> initial risk score
    """
    return {action_id: 0.5 for action_id in available_actions}


def update_risk_score(
    action_id: str,
    current_risk: float,
    triggered_anomaly: bool,
    anomaly_severity: str = "MEDIUM",
    learning_rate: float = 0.2
) -> float:
    """
    Update risk score for an action based on outcome.
    
    Args:
        action_id: Action being updated
        current_risk: Current risk score
        triggered_anomaly: Whether action triggered an anomaly
        anomaly_severity: Severity if anomaly occurred (LOW/MEDIUM/HIGH)
        learning_rate: How quickly to update (0.0-1.0)
    
    Returns:
        Updated risk score
    """
    if not triggered_anomaly:
        # Action succeeded without anomaly - decrease risk slightly
        new_risk = current_risk * (1 - learning_rate * 0.5)
    else:
        # Action triggered anomaly - increase risk based on severity
        severity_weights = {
            "LOW": 0.2,
            "MEDIUM": 0.5,
            "HIGH": 0.9
        }
        severity_impact = severity_weights.get(anomaly_severity, 0.5)
        
        # Increase risk, weighted by severity
        new_risk = current_risk + (1.0 - current_risk) * learning_rate * severity_impact
    
    # Clamp to [0, 1]
    return max(0.0, min(1.0, new_risk))


def update_risks_from_anomalies(
    current_risks: Dict[str, float],
    anomalies: List[AnomalyReport],
    recent_anomalies_only: int = 5
) -> Dict[str, float]:
    """
    Update risk scores based on detected anomalies.
    
    Args:
        current_risks: Current risk scores
        anomalies: List of all anomalies detected
        recent_anomalies_only: Only consider last N anomalies
    
    Returns:
        Updated risk scores
    """
    updated_risks = current_risks.copy()
    
    # Only process recent anomalies
    recent_anomalies = anomalies[-recent_anomalies_only:] if len(anomalies) > recent_anomalies_only else anomalies
    
    for anomaly in recent_anomalies:
        if anomaly.action_id:
            current_risk = updated_risks.get(anomaly.action_id, 0.5)
            
            new_risk = update_risk_score(
                action_id=anomaly.action_id,
                current_risk=current_risk,
                triggered_anomaly=True,
                anomaly_severity=anomaly.severity.value
            )
            
            updated_risks[anomaly.action_id] = new_risk
    
    return updated_risks


def get_risk_category(risk_score: float) -> str:
    """
    Categorize risk score into human-readable categories.
    
    Args:
        risk_score: Risk score (0.0-1.0)
    
    Returns:
        Category string: "SAFE", "LOW_RISK", "MEDIUM_RISK", "HIGH_RISK"
    """
    if risk_score < 0.2:
        return "SAFE"
    elif risk_score < 0.5:
        return "LOW_RISK"
    elif risk_score < 0.8:
        return "MEDIUM_RISK"
    else:
        return "HIGH_RISK"


def should_avoid_action(
    action_id: str,
    risk_scores: Dict[str, float],
    risk_threshold: float = 0.8,
    anomaly_history: List[AnomalyReport] = None
) -> bool:
    """
    Determine if an action should be avoided due to high risk.
    
    Args:
        action_id: Action being evaluated
        risk_scores: Current risk scores
        risk_threshold: Threshold above which to avoid
        anomaly_history: Recent anomaly history
    
    Returns:
        True if action should be avoided
    """
    risk = risk_scores.get(action_id, 0.5)
    
    if risk >= risk_threshold:
        return True
    
    # Also check if this action caused multiple recent HIGH severity anomalies
    if anomaly_history:
        recent_high_severity = [
            a for a in anomaly_history[-10:]
            if a.action_id == action_id and a.severity == AnomalySeverity.HIGH
        ]
        
        if len(recent_high_severity) >= 2:
            return True
    
    return False


def get_safest_actions(
    available_actions: List[str],
    risk_scores: Dict[str, float],
    top_n: int = 3
) -> List[str]:
    """
    Get the N safest available actions.
    
    Args:
        available_actions: Currently available actions
        risk_scores: Risk scores for actions
        top_n: Number of actions to return
    
    Returns:
        List of safest action IDs
    """
    # Score available actions by risk (lower is better)
    action_risk_pairs = [
        (action_id, risk_scores.get(action_id, 0.5))
        for action_id in available_actions
    ]
    
    # Sort by risk (ascending)
    sorted_actions = sorted(action_risk_pairs, key=lambda x: x[1])
    
    # Return top N
    return [action_id for action_id, _ in sorted_actions[:top_n]]
