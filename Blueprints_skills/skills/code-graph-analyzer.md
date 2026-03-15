# Code Graph Analyzer Skill

Maps every file, function, endpoint, and dependency in a codebase into a structured relationship graph. Provides AI with full blast-radius awareness before any code modification, auto-updates on file changes, and self-heals when drift is detected.

## Usage

Say: "Map my codebase", "Generate code graph", "Show me how [file] connects to everything", or "What will break if I change [component]?"

## What This Skill Does

### 1. Codebase Relationship Mapping

Scans your entire project and builds a directed graph of every code relationship:

```
NODE TYPES DETECTED:
├── endpoint      → API routes (GET /users, POST /auth/login)
├── collection    → Database tables/collections
├── file          → Source code files (.js, .ts, .jsx, .tsx, .py, etc.)
├── router        → Route definitions and middleware chains
├── script        → Build/deploy/utility scripts
├── task          → Scheduled jobs, cron tasks, background workers
├── cache_key     → Redis/memcache keys
├── service       → External service integrations
├── utility       → Shared helper functions/modules
├── webhook       → Incoming/outgoing webhook handlers
├── event         → Event emitters/listeners (pub/sub)
├── external_api  → Third-party API integrations
├── component     → UI components (React, Vue, Svelte, etc.)
├── store         → State management (Redux, Zustand, Pinia, etc.)
├── middleware     → Express/Fastify/Next.js middleware
├── migration     → Database migration files
├── test          → Test files and test suites
└── config        → Configuration files
```

### 2. Edge (Relationship) Detection

Tracks how nodes connect to each other:

```
EDGE TYPES:
├── db_read          → Reads from database (SELECT, find, get)
├── db_write         → Writes to database (INSERT, UPDATE, DELETE)
├── endpoint_handler → Route → Handler function mapping
├── api_call         → Internal service-to-service calls
├── cache_read       → Cache lookups (GET from Redis/Memcache)
├── cache_write      → Cache writes (SET to Redis/Memcache)
├── webhook_receive  → Incoming webhook processing
├── webhook_send     → Outgoing webhook dispatching
├── event_publish    → Event emission
├── event_subscribe  → Event listening
├── imports          → File import/require relationships
├── renders          → Component render tree relationships
├── state_read       → Reads from store/context
├── state_write      → Writes to store/context
├── middleware_chain  → Middleware execution order
└── test_covers      → Test → Source coverage mapping
```

### 3. Blast Radius Analysis

Before any code change, identifies everything that could break:

```markdown
## Blast Radius: src/services/userService.js

DIRECT DEPENDENCIES (will definitely break):
├── src/routes/auth.js          → calls userService.createUser()
├── src/routes/users.js         → calls userService.getUser(), updateUser()
├── src/middleware/auth.js      → calls userService.validateToken()
└── src/jobs/cleanup.js         → calls userService.deactivateStale()

INDIRECT DEPENDENCIES (may be affected):
├── src/routes/orders.js        → uses auth middleware → userService
├── src/routes/dashboard.js     → fetches user data via /api/users
└── src/components/Profile.jsx  → renders user data from /api/users

DATABASE IMPACT:
├── users (collection)          → READ + WRITE
├── sessions (collection)       → WRITE (via createUser hook)
└── audit_log (collection)      → WRITE (via middleware)

CACHE IMPACT:
├── user:{id}                   → Will serve stale data if not invalidated
└── user:list                   → Needs cache bust on write changes

WEBHOOK IMPACT:
└── POST https://crm.example.com/sync → Triggered on user update

ESTIMATED RISK: 🟡 MEDIUM (7 direct + 3 indirect dependents)
```

### 4. Auto-Update on File Changes

The graph stays current automatically:

```
FILE WATCHER ACTIVE:
├── New file detected    → Scans, classifies, adds to graph
├── File modified        → Re-scans relationships, updates edges
├── File deleted         → Removes node, cleans orphan edges
├── File renamed/moved   → Updates node path, preserves edges
└── Dependency changed   → Re-evaluates import tree
```

### 5. Self-Healing & Drift Detection

Periodically validates the graph against the actual codebase:

```
SELF-HEALING CHECK:
├── ✅ Node count matches file count
├── ⚠️  DRIFT: src/utils/newHelper.js exists but not in graph → ADDING
├── ⚠️  DRIFT: src/old/deprecated.js in graph but deleted → REMOVING
├── ✅ Edge validation: all import paths resolve
├── ⚠️  DRIFT: src/routes/api.js has new endpoint not mapped → UPDATING
└── ✅ Heal complete: 2 nodes added, 1 removed, 1 updated
```

## How the AI Uses This

### Pre-Modification Protocol

Before ANY code change, the AI must:

1. **Load the graph**: Read `code_graph.json` from the project root
2. **Identify the target**: Find the node(s) being modified
3. **Trace dependencies**: Walk all edges FROM and TO the target
4. **Assess blast radius**: Count direct + indirect dependents
5. **Plan the change**: Include updates to all affected files
6. **Execute with awareness**: Make changes knowing full impact
7. **Update the graph**: After changes, trigger graph refresh

### Consultation Query Examples

```
Q: "What uses the userService?"
A: Graph lookup → 4 routes, 1 middleware, 1 background job, 2 components

Q: "Can I rename the 'users' collection?"
A: Blast radius → 12 endpoints, 3 services, 2 migration files, 5 test files

Q: "What happens if the Redis cache goes down?"
A: Cache dependency scan → 8 endpoints degrade, 3 become unavailable

Q: "Show me the authentication flow"
A: Path trace → login endpoint → auth middleware → userService →
   session store → token cache → protected routes
```

## Graph Schema (code_graph.json)

```json
{
  "metadata": {
    "project": "my-project",
    "generated": "2026-02-08T12:00:00Z",
    "version": "1.0.0",
    "node_count": 847,
    "edge_count": 1643,
    "health": "✅ SYNCED"
  },
  "nodes": [
    {
      "id": "src/services/userService.js",
      "type": "service",
      "label": "userService",
      "exports": ["createUser", "getUser", "updateUser", "deleteUser"],
      "loc": 245,
      "complexity": "medium",
      "last_modified": "2026-02-07T15:30:00Z"
    }
  ],
  "edges": [
    {
      "source": "src/routes/users.js",
      "target": "src/services/userService.js",
      "type": "imports",
      "functions": ["getUser", "updateUser"],
      "weight": 2
    }
  ]
}
```

## Tools Included

### 1. Code Graph Generator (`tools/code-graph-generator.py`)
Scans any codebase and generates `code_graph.json`:
```bash
python tools/code-graph-generator.py --path /your/project --output code_graph.json
```

### 2. Interactive Visualizer (`tools/code-graph-viewer.html`)
Open in browser to explore the graph visually:
- Force-directed animated layout
- Filter by node type, edge type
- Search nodes by name
- Click to see connections
- Zoom, pan, drag nodes
- Blast radius highlighting on hover

### 3. File Watcher (`tools/code-graph-watcher.py`)
Runs in background, keeps graph updated:
```bash
python tools/code-graph-watcher.py --path /your/project --graph code_graph.json
```

## Files Created

1. **tools/code-graph-generator.py** — Codebase scanner and graph builder
2. **tools/code-graph-viewer.html** — Interactive D3.js visualization
3. **tools/code-graph-watcher.py** — File watcher with self-healing
4. **code_graph.json** — Generated graph data (per-project)

## Expected Results

```
BEFORE: AI modifies files in isolation, breaks unknown dependencies
AFTER:  AI consults graph, knows every connection, zero surprise breakage

BEFORE: Stale documentation, manual dependency tracking
AFTER:  Auto-updating graph, always accurate, self-healing

BEFORE: "What does this file connect to?" → manual grep
AFTER:  Instant visual + queryable relationship map
```
