# Agentic Reasoning Layer

**LangGraph-based control plane for DAD Agent autonomous integration testing**

## Overview

The Agentic Reasoning Layer is the decision-making core of the DAD Agent system. It operates purely on structured state observations and makes decisions about what to test next, when to investigate anomalies deeper, and when to terminate testing.

### Core Philosophy

> **We test COHERENCE, not CORRECTNESS.**

This module validates that the system behaves consistently and predictably. It does NOT:
- ❌ Read raw DOM
- ❌ Parse Playwright logs
- ❌ Invent actions
- ❌ Assume business logic success/failure

It DOES:
- ✅ Reason over structured `AgentState` JSON
- ✅ Choose actions from available options only
- ✅ Detect anomalies via invariants
- ✅ Learn from runtime behavior
- ✅ Make safe branching decisions

## Architecture

```
┌──────────────┐
│   Interpret  │ ← Entry point - Extract signals from state
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Detect Anomaly│ ← Run invariants & baseline checks
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Router    │ ◄─── Safety checkpoint - Decide before planning
└──────┬───────┘
       │
  ┌────┴────┬──────────┐
  │         │          │
CONTINUE  DEEP_TEST  TERMINATE
  │         │          │
  └────┬────┘          ▼
       │             [END]
       ▼
┌──────────────┐
│ Plan Action  │ ← Select from available_actions ONLY
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Learn     │ ← Update baselines & risk scores
└──────┬───────┘
       │
       └─────────► [Loop back to Interpret]
```

## Directory Structure

```
agentic_reasoning/
├── __init__.py           # Package exports
├── graph.py              # LangGraph workflow definition
├── nodes/                # LangGraph node implementations
│   ├── state_interpreter.py
│   ├── anomaly_detector.py
│   ├── action_planner.py
│   ├── learner.py
│   └── router.py
├── invariants/           # Coherence checks
│   ├── core_invariants.py
│   └── baseline_checks.py
├── schemas/              # Type definitions
│   ├── agent_state.py
│   ├── action_contract.py
│   └── anomaly_report.py
├── policies/             # Decision strategies
│   ├── exploration.py
│   └── risk.py
└── README.md            # This file
```

## Key Components

### 1. Schemas (`schemas/`)

**AgentState**: Complete system state with strict read/write permissions
- **READ-ONLY**: `ui_state`, `execution_context`
- **WRITABLE**: `decision`, `anomalies`, `knowledge.baselines`, `knowledge.risk_scores`

**ActionContract**: Defines actions the reasoning layer can select
- Must exist in `ui_state.available_actions`
- No selectors or DOM references allowed

**AnomalyReport**: Structured anomaly detection output
- Severity: LOW | MEDIUM | HIGH
- Category: INVARIANT_VIOLATION | REGRESSION | INSTABILITY

### 2. Invariants (`invariants/`)

Five core invariants validate system coherence:

1. **Cause-Effect**: Actions cause observable changes
2. **API-UI Consistency**: Successful API calls reflect in UI
3. **Entity Continuity**: IDs persist across steps
4. **Forward Progress**: No silent stalls
5. **Stability**: Behavior matches learned baselines

### 3. LangGraph Nodes (`nodes/`)

**State Interpreter** (`state_interpreter.py`)
- Extracts meaningful signals from state
- Computes state deltas
- READ-ONLY - no state mutation

**Anomaly Detector** (`anomaly_detector.py`)
- Runs all invariant checks
- Compares against baselines
- Writes to `state.anomalies`

**Router** (`router.py`)
- **CRITICAL**: Runs AFTER anomaly detection, BEFORE planning
- Decides: CONTINUE | DEEP_TEST | TERMINATE
- Enables early termination without wasted planning

**Action Planner** (`action_planner.py`)
- Selects next action using coverage + risk
- **NEVER invents actions** - only chooses from `available_actions`
- Writes to `state.decision.next_action`

**Learner** (`learner.py`)
- Updates baseline statistics
- Learns "normal" behavior patterns
- Writes to `state.knowledge.baselines`

### 4. Policies (`policies/`)

**Exploration** (`exploration.py`)
- Coverage-guided action selection
- Prioritizes unexplored actions
- Tracks execution history

**Risk** (`risk.py`)
- Dynamic risk scoring for actions
- Learns from anomaly patterns
- Increases risk for actions that trigger anomalies

## Usage

### Basic Usage

```python
from agentic_reasoning import create_reasoning_graph, AgentState
from agentic_reasoning.schemas.agent_state import UIState, ExecutionContext

# Create reasoning graph
graph = create_reasoning_graph()

# Create initial state
initial_state = AgentState(
    ui_state=UIState(
        available_actions=["click_login", "fill_username", "fill_password"],
        observation={"form_visible": True},
        page_url="https://example.com/login"
    ),
    execution_context=ExecutionContext(
        step_count=0,
        max_steps=50
    )
)

# Run reasoning cycle
final_state = graph.invoke(initial_state)

# Check results
print(f"Control Decision: {final_state.decision.control}")
print(f"Next Action: {final_state.decision.next_action}")
print(f"Anomalies Detected: {len(final_state.anomalies)}")
```

### Iterative Execution

```python
# For multi-step execution, loop with state updates
state = initial_state

while state.decision.control != "TERMINATE":
    # Run one reasoning cycle
    state = graph.invoke(state)
    
    # Execute the chosen action (external to this module)
    if state.decision.next_action:
        # External module executes action
        # Updates ui_state with new observation
        pass
    
    # Increment step count
    state.execution_context.step_count += 1
```

## Invariant Definitions

### 1. Cause-Effect Invariant

**Rule**: If an action executes successfully, observable state should change.

**Violation**: Action reported success but `ui_state.observation` is identical.

**Example**:
```python
# Before action
observation_before = {"button_enabled": True}

# Action: click_submit
# After action
observation_after = {"button_enabled": True}

# ❌ VIOLATION: No change detected
```

### 2. API-UI Consistency

**Rule**: If API call succeeds, UI should reflect the change.

**Violation**: API returns success but expected UI fields are missing.

**Example**:
```python
# API response
api_response = {"success": True, "user_id": "123"}

# UI observation
ui_observation = {"error": "User not found"}

# ❌ VIOLATION: API succeeded but UI shows error
```

### 3. Entity Continuity

**Rule**: Entity IDs should persist unless explicitly deleted.

**Violation**: Previously existing entity disappeared after non-delete action.

**Example**:
```python
# Before
entities_before = {"user_123": {...}, "post_456": {...}}

# Action: create_comment (not delete)
# After
entities_after = {"user_123": {...}}

# ❌ VIOLATION: post_456 disappeared
```

### 4. Forward Progress

**Rule**: System should make forward progress (no silent stalls).

**Violation**: Same observation repeated 3+ times despite different actions.

**Example**:
```python
# Step 1: action=fill_username, observation={"form_empty": True}
# Step 2: action=fill_password, observation={"form_empty": True}
# Step 3: action=click_submit, observation={"form_empty": True}

# ❌ VIOLATION: Stalled - no progress
```

### 5. Stability (Baseline)

**Rule**: Metrics should stay within statistical bounds (±2σ).

**Violation**: Metric deviates beyond threshold from learned baseline.

**Example**:
```python
# Baseline for response_time_ms
baseline = {"mean": 200, "std_dev": 50}

# Current observation
current_value = 500  # z-score = 6σ

# ❌ VIOLATION: Exceeds 2σ threshold
```

## Control Flow Decisions

### CONTINUE
- No anomalies detected
- Actions available
- Under step limit
- Normal operation

### DEEP_TEST
- Medium severity anomaly detected
- Baseline deviation (regression)
- High risk action executed
- Investigate further

### TERMINATE
- No available actions
- Max steps reached
- 3+ consecutive HIGH severity anomalies
- Critical invariant violations
- Excessive anomaly rate (>50% high severity)

## Write Permissions

The reasoning layer has **strict** write permissions:

| State Field | Permission |
|------------|-----------|
| `ui_state` | ❌ READ-ONLY |
| `execution_context` | ❌ READ-ONLY |
| `decision` | ✅ WRITABLE |
| `anomalies` | ✅ APPEND-ONLY |
| `knowledge.baselines` | ✅ WRITABLE |
| `knowledge.risk_scores` | ✅ WRITABLE |

Any violation of these permissions breaks the contract.

## Dependencies

```bash
pip install langgraph pydantic typing-extensions
```

**Optional** (for enhanced baseline calculations):
```bash
pip install numpy
```

## Testing

```bash
# Run all tests
pytest tests/

# Test specific components
pytest tests/test_schemas.py -v
pytest tests/test_invariants.py -v
pytest tests/test_nodes.py -v
pytest tests/test_graph_e2e.py -v
```

## Integration Points

The reasoning layer integrates with external modules:

**Input** (from external modules):
- `ui_state.available_actions` - List of executable actions
- `ui_state.observation` - Structured UI state (no raw DOM)
- `execution_context` - Execution metadata

**Output** (to external modules):
- `decision.next_action` - ActionContract to execute
- `decision.control` - Control flow decision
- `anomalies` - Detected issues

**External modules** are responsible for:
- Extracting structured state from DOM (Playwright module)
- Executing chosen actions (Execution module)
- Updating `ui_state` after actions
- Respecting TERMINATE decisions

## Design Rationale

### Why Router Before Planner?

**Safety First**: Termination conditions are checked BEFORE action planning.

❌ **Bad** (old flow):
```
anomaly → plan → learn → route → (terminate)
```
- Wastes CPU planning actions when should terminate
- Planning might fail if no actions available

✅ **Good** (current flow):
```
anomaly → route → (terminate OR plan → learn)
```
- Early exit on termination
- No wasted planning cycles
- Safer termination guarantees

### Why No DOM Access?

**Separation of Concerns**: 
- DOM parsing is brittle and module-specific
- Reasoning should work with ANY structured state
- Enables testing of non-browser systems
- Prevents coupling to Playwright implementation

### Why Never Invent Actions?

**Runtime is Oracle**:
- Only the execution environment knows valid actions
- Inventing actions violates the contract
- Leads to runtime errors in executors
- Reasoning layer must respect environment constraints

## License

Part of the DAD Agent project. See project root for license.

## Contributing

When contributing to this module, remember:

1. **Never read raw DOM** - work with structured observations only
2. **Never invent actions** - choose from `available_actions` only
3. **Respect write permissions** - only modify allowed fields
4. **Add tests** - every new invariant needs tests
5. **Update this README** - document your changes

---

**One-Line Philosophy**: *We test coherence, not correctness.*
