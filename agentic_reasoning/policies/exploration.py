"""
Exploration Policy

Implements coverage-guided exploration strategy for action selection.

GOAL: Maximize coverage of available actions while avoiding redundant executions.
"""

from typing import List, Dict, Any, Optional


def calculate_action_coverage_score(
    action_id: str,
    action_history: List[str],
    epsilon: float = 0.1
) -> float:
    """
    Calculate coverage score for an action.
    
    Higher score = higher priority for exploration.
    
    Args:
        action_id: Action being considered
        action_history: List of previously executed actions
        epsilon: Epsilon for epsilon-greedy exploration (0.1 = 10% random)
    
    Returns:
        Score in range [0, 1], where 1 = highest priority
    """
    # Count how many times this action has been executed
    execution_count = action_history.count(action_id)
    
    # Unexplored actions get highest score
    if execution_count == 0:
        return 1.0
    
    # Actions executed once get medium score
    if execution_count == 1:
        return 0.5
    
    # Actions executed multiple times get low score
    # Use inverse frequency
    return 1.0 / (execution_count + 1)


def select_action_by_coverage(
    available_actions: List[str],
    action_history: List[str],
    risk_scores: Dict[str, float],
    max_risk_threshold: float = 0.8
) -> Optional[str]:
    """
    Select action based on coverage strategy.
    
    Prioritizes:
    1. Unexplored actions (never executed)
    2. Low-risk actions
    3. Rarely executed actions
    
    Args:
        available_actions: List of action IDs currently available
        action_history: History of executed actions
        risk_scores: Risk score for each action (0.0 = safe, 1.0 = risky)
        max_risk_threshold: Maximum acceptable risk score
    
    Returns:
        Selected action_id or None if no valid actions
    """
    if not available_actions:
        return None
    
    # Score each action
    action_scores = {}
    
    for action_id in available_actions:
        # Get coverage score
        coverage_score = calculate_action_coverage_score(action_id, action_history)
        
        # Get risk score (default to 0.5 if unknown)
        risk_score = risk_scores.get(action_id, 0.5)
        
        # Filter out too-risky actions
        if risk_score > max_risk_threshold:
            continue
        
        # Combined score: coverage is primary, risk is secondary
        # High coverage + low risk = high score
        combined_score = coverage_score * 0.7 + (1.0 - risk_score) * 0.3
        
        action_scores[action_id] = combined_score
    
    # If all actions filtered out by risk, relax threshold and try again
    if not action_scores:
        return select_action_by_coverage(
            available_actions=available_actions,
            action_history=action_history,
            risk_scores=risk_scores,
            max_risk_threshold=1.0  # Accept any risk if no other choice
        )
    
    # Select action with highest score
    best_action = max(action_scores.items(), key=lambda x: x[1])[0]
    
    return best_action


def group_actions_by_category(
    available_actions: List[str]
) -> Dict[str, List[str]]:
    """
    Group actions by category based on naming patterns.
    
    Useful for ensuring diverse exploration across different action types.
    
    Args:
        available_actions: List of action IDs
    
    Returns:
        Dictionary mapping category -> list of actions
    """
    categories = {
        'navigation': [],
        'form': [],
        'click': [],
        'assertion': [],
        'wait': [],
        'other': []
    }
    
    for action_id in available_actions:
        action_lower = action_id.lower()
        
        if any(kw in action_lower for kw in ['navigate', 'goto', 'back', 'forward']):
            categories['navigation'].append(action_id)
        elif any(kw in action_lower for kw in ['fill', 'input', 'type', 'select']):
            categories['form'].append(action_id)
        elif any(kw in action_lower for kw in ['click', 'press', 'submit']):
            categories['click'].append(action_id)
        elif any(kw in action_lower for kw in ['assert', 'verify', 'check', 'expect']):
            categories['assertion'].append(action_id)
        elif any(kw in action_lower for kw in ['wait', 'sleep', 'pause']):
            categories['wait'].append(action_id)
        else:
            categories['other'].append(action_id)
    
    return categories


def get_unexplored_action_count(
    available_actions: List[str],
    action_history: List[str]
) -> int:
    """
    Count how many available actions have never been executed.
    
    Args:
        available_actions: Currently available actions
        action_history: Execution history
    
    Returns:
        Count of unexplored actions
    """
    executed_actions = set(action_history)
    available_set = set(available_actions)
    unexplored = available_set - executed_actions
    
    return len(unexplored)
