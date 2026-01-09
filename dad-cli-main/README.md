# DAD Agent

AI-powered autonomous testing agent that intelligently explores and tests web applications using LangGraph decision-making and browser automation.

## Prerequisites

- **Node.js >= 18**
- **Docker** (for Qdrant vector database)
- **VS Code** (optional, for extension)

## Setup

### 1. Install Dependencies
```bash
npm install
cd runtime-discovery && npm install
cd ../vscode-extension && npm install
```

### 2. Start Qdrant Vector Database

**Windows (PowerShell):**
```powershell
# Using Docker (recommended)
docker run -p 6333:6333 -v ${PWD}/qdrant_data:/qdrant/storage qdrant/qdrant

# Or download binary
Invoke-WebRequest -Uri "https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-pc-windows-msvc.zip" -OutFile "qdrant.zip"
Expand-Archive -Path "qdrant.zip" -DestinationPath "."
.\qdrant.exe
```

**Windows (CMD):**
```cmd
# Using Docker (recommended)
docker run -p 6333:6333 -v %cd%/qdrant_data:/qdrant/storage qdrant/qdrant

# Or download binary
curl -L https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-pc-windows-msvc.zip -o qdrant.zip
tar -xf qdrant.zip
qdrant.exe
```

**Linux/macOS:**
```bash
# Using Docker (recommended)
docker run -p 6333:6333 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant

# Or download binary
wget https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz
tar -xzf qdrant-x86_64-unknown-linux-gnu.tar.gz
./qdrant
```

**Initialize Collection:**

*PowerShell:*
```powershell
node createCollection.ts
```

*CMD:*
```cmd
node createCollection.ts
```

*Linux/macOS:*
```bash
node createCollection.ts
```

### 3. Configure Environment (Optional)
```bash
# Copy and edit .env for Azure/OpenAI embeddings
cp .env.example .env
# Edit OPENAI_API_KEY, AZURE_* settings
# Default uses local embeddings (@xenova/transformers)
```

### 4. Install Playwright Browsers
```bash
cd runtime-discovery
npx playwright install
```

## Usage

### Run Autonomous Testing
```bash
cd runtime-discovery
npm run start https://your-app-url.com
```

### Test Knowledge Base
```bash
node testKB.ts
```

### Analyze Results
```bash
node error-intelligence/pipeline.js runs/<run-id>.json reports/analysis.json
```

## Architecture

### 🧠 LangGraph Agent Pipeline
- **Anomaly Detection** - Identifies UI/network issues
- **Diagnosis** - Analyzes root causes  
- **Memory** - Maintains testing context
- **Decision Engine** - AI-powered action selection
- **Executor** - Safe action execution with confidence thresholds
- **Validator** - Result verification
- **Learner** - Knowledge accumulation

### 🔍 Runtime Discovery
- Dynamic UI action discovery (buttons, links, forms, inputs, selects)
- Network monitoring and console error tracking
- Screenshot capture with stability detection
- Playwright-based browser automation

### 📊 Error Intelligence
- Multi-stage analysis pipeline
- Azure Vision safety checks
- Performance monitoring
- Evidence correlation (screenshots + network traces)

### 🧮 Knowledge Management
- **Qdrant Vector Database** (port 6333)
- **Local Embeddings** (@xenova/transformers, 384-dim)
- **Azure Embeddings** (optional, 1536-dim)
- Semantic search for learned behaviors
- Success/failure pattern recognition
- Confidence scoring for solutions

## VS Code Integration

```bash
cd vscode-extension
npm run compile
# Press F5 to launch extension development host
```

## Output Structure

- **`runs/`** - Test execution traces (JSON)
- **`screenshots/`** - UI screenshots during testing
- **`reports/`** - Analysis reports
- **`qdrant_data/`** - Vector database storage
- **Knowledge Base** - Stored at `http://localhost:6333`

## Troubleshooting

**Qdrant Connection Issues:**
```bash
# Check if Qdrant is running
curl http://localhost:6333/collections

# Restart Qdrant
docker restart <qdrant-container-id>
```

**Missing Dependencies:**
```bash
# Install all dependencies
npm install
cd runtime-discovery && npm install
cd ../vscode-extension && npm install
```
