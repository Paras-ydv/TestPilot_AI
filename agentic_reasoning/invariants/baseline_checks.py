"""
Baseline Checks

Implements stability checks by comparing current behavior against learned baselines.

Uses statistical methods to detect deviations from normal behavior patterns.
"""

from typing import Dict, Any, Optional, Tuple
from agentic_reasoning.schemas.anomaly_report import AnomalyEvidence
from agentic_reasoning.invariants.core_invariants import InvariantViolation


class BaselineMetrics:
    """Statistical metrics for a baseline."""
    
    def __init__(self, mean: float, std_dev: float, count: int = 0):
        self.mean = mean
        self.std_dev = std_dev
        self.count = count
    
    def update(self, new_value: float) -> 'BaselineMetrics':
        """
        Update baseline with new observation using incremental statistics.
        
        Uses Welford's online algorithm for numerical stability.
        """
        new_count = self.count + 1
        delta = new_value - self.mean
        new_mean = self.mean + delta / new_count
        delta2 = new_value - new_mean
        new_variance = ((self.count * (self.std_dev ** 2)) + delta * delta2) / new_count
        new_std_dev = new_variance ** 0.5
        
        return BaselineMetrics(mean=new_mean, std_dev=new_std_dev, count=new_count)
    
    def to_dict(self) -> Dict[str, float]:
        """Convert to dictionary for storage."""
        return {
            "mean": self.mean,
            "std_dev": self.std_dev,
            "count": self.count
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, float]) -> 'BaselineMetrics':
        """Create from dictionary."""
        return cls(
            mean=data.get("mean", 0.0),
            std_dev=data.get("std_dev", 0.0),
            count=data.get("count", 0)
        )


def check_stability_against_baseline(
    metric_name: str,
    current_value: float,
    baseline: Optional[Dict[str, Any]],
    sigma_threshold: float = 2.0
) -> Tuple[InvariantViolation, Optional[BaselineMetrics]]:
    """
    Check if current metric value is stable compared to baseline.
    
    Uses statistical threshold (default: ±2σ from mean).
    
    Args:
        metric_name: Name of the metric being checked
        current_value: Current observed value
        baseline: Baseline data (mean, std_dev, count) or None if first observation
        sigma_threshold: Number of standard deviations to trigger violation
    
    Returns:
        Tuple of (InvariantViolation, updated_baseline_metrics)
    """
    # If no baseline yet, initialize it
    if baseline is None:
        # First observation - no violation possible
        initial_baseline = BaselineMetrics(
            mean=current_value,
            std_dev=0.0,
            count=1
        )
        return (
            InvariantViolation(violated=False),
            initial_baseline
        )
    
    # Load baseline metrics
    baseline_metrics = BaselineMetrics.from_dict(baseline)
    
    # If we don't have enough data yet (< 3 observations), just update
    if baseline_metrics.count < 3:
        updated_baseline = baseline_metrics.update(current_value)
        return (
            InvariantViolation(violated=False),
            updated_baseline
        )
    
    # Check if current value deviates too much from baseline
    mean = baseline_metrics.mean
    std_dev = baseline_metrics.std_dev
    
    # Avoid division by zero
    if std_dev == 0:
        # Perfect stability so far - any deviation is notable
        if abs(current_value - mean) > 0.01 * abs(mean):  # 1% tolerance
            violation = InvariantViolation(
                violated=True,
                evidence=AnomalyEvidence(
                    expected=f"{metric_name} should remain stable at {mean:.2f} (σ=0)",
                    observed=f"{metric_name} = {current_value:.2f} (deviation detected)",
                    additional_context={
                        "baseline_mean": mean,
                        "current_value": current_value,
                        "deviation_percent": abs((current_value - mean) / mean * 100) if mean != 0 else 0
                    }
                ),
                description=f"Stability violation: {metric_name} deviated from perfect baseline"
            )
            updated_baseline = baseline_metrics.update(current_value)
            return (violation, updated_baseline)
    else:
        # Check if value is beyond threshold
        z_score = abs(current_value - mean) / std_dev
        
        if z_score > sigma_threshold:
            violation = InvariantViolation(
                violated=True,
                evidence=AnomalyEvidence(
                    expected=f"{metric_name} within {sigma_threshold}σ of baseline (μ={mean:.2f}, σ={std_dev:.2f})",
                    observed=f"{metric_name} = {current_value:.2f} (z={z_score:.2f}σ)",
                    additional_context={
                        "baseline_mean": mean,
                        "baseline_std_dev": std_dev,
                        "current_value": current_value,
                        "z_score": z_score,
                        "threshold": sigma_threshold
                    }
                ),
                description=f"Stability violation: {metric_name} exceeded {sigma_threshold}σ threshold"
            )
            updated_baseline = baseline_metrics.update(current_value)
            return (violation, updated_baseline)
    
    # No violation - update baseline
    updated_baseline = baseline_metrics.update(current_value)
    return (
        InvariantViolation(violated=False),
        updated_baseline
    )


def extract_metrics_from_observation(
    observation: Dict[str, Any],
    action_id: Optional[str] = None
) -> Dict[str, float]:
    """
    Extract measurable metrics from an observation for baseline comparison.
    
    Args:
        observation: UI state observation
        action_id: Action that led to this observation (optional)
    
    Returns:
        Dictionary of metric_name -> value
    """
    metrics = {}
    
    # Extract common metrics
    if 'response_time_ms' in observation:
        metrics['response_time_ms'] = float(observation['response_time_ms'])
    
    if 'element_count' in observation:
        metrics['element_count'] = float(observation['element_count'])
    
    if 'error_count' in observation:
        metrics['error_count'] = float(observation['error_count'])
    
    # Action-specific metrics
    if action_id and f'{action_id}_duration_ms' in observation:
        metrics[f'{action_id}_duration_ms'] = float(observation[f'{action_id}_duration_ms'])
    
    # Custom metric extraction based on observation structure
    for key, value in observation.items():
        if isinstance(value, (int, float)) and key.endswith('_count'):
            metrics[key] = float(value)
    
    return metrics
