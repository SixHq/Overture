# Overture Integration for Cursor

You have access to **Overture**, an MCP server that visualizes your execution plans as interactive flowcharts before you write any code.

## Why Overture Exists

Every AI coding agent shares the same fundamental problem: the developer types a prompt, you start working, and they have **no visibility** into what you're planning. By the time they realize you went in the wrong direction, you've already written 200+ lines of code that needs to be discarded.

**Overture solves this by making your plan visible, editable, and approvable before execution begins.**

## When to Use Overture

**USE** Overture for any task involving:
- Multiple steps or files to create/modify
- Architectural decisions the user should weigh in on
- User configuration (API keys, preferences, settings)
- Complex implementations with multiple valid approaches
- Tasks where getting alignment upfront saves significant rework

**DO NOT USE (Except if the user explicitity asks you to)** Overture for:
- Simple questions or explanations
- Single-file, small edits
- Quick bug fixes with obvious solutions
- Research or exploration tasks


---

## Critical: Extended Planning Mode

**Your plans must be comprehensive, deeply detailed, and broken down to the atomic level.**

Unlike simple 5-10 step outlines, Overture expects you to generate **fully decomposed plans** where every task is broken into its smallest meaningful units. This is not optional — thorough planning prevents wasted tokens, wasted time, and developer frustration.

### Planning Requirements

For every task you receive, your plan must include:

1. **Atomic Decomposition**: Break every task into its smallest executable steps
2. **Rich Node Details**: Every node needs title, description, complexity, expected output, and risks
3. **Decision Points**: Use `decision` nodes whenever multiple valid approaches exist
4. **Dynamic Fields**: Declare any inputs needed from the user (API keys, config, preferences)
5. **Logical Dependencies**: Edges should reflect true execution order

### The Golden Rule: ONE COMPONENT = ONE NODE

**NEVER combine multiple components or features into a single node.** Each UI component, each API endpoint, each configuration step gets its own dedicated node.

### Example: Good vs. Bad Planning

**BAD PLAN (lazy, combined steps - DO NOT DO THIS):**
```
1. Set up project
2. Build the frontend
3. Add backend API
4. Deploy
```

**GOOD PLAN (atomic decomposition - THIS IS WHAT WE WANT):**

If a user asks for "a landing page," your plan should NOT just say "build a landing page." It should include:

```
1. Initialize Next.js project with TypeScript
2. Configure Tailwind CSS with custom theme
3. Create Header component
   - Logo placement and sizing
   - Navigation items with responsive menu
   - Dark mode toggle
4. Create Hero section
   - Headline and subheadline copy
   - CTA button with hover states
   - Background gradient/image
   - Entrance animations
5. Create Features section
   - Grid layout (3 columns on desktop, 1 on mobile)
   - Feature card component
   - Icon selection for each feature
6. Create Testimonials section
   - Testimonial card component
   - Avatar, name, role, quote
7. Create Pricing section
   - Monthly/Annual toggle
   - PricingCard component
   - Feature comparison list
8. Create Footer component
   - Link groups
   - Newsletter signup form
   - Social media icons
9. Create Contact form
   - Form fields (name, email, message)
   - Validation logic
   - Submit handler
10. Add SEO meta tags and Open Graph
11. Configure deployment (Vercel/Netlify)
    - Environment variables
    - Build configuration
```

**Notice:** Each component (Header, Hero, Features, Footer, etc.) is its **own separate node**. Do NOT combine "Header, Hero, and Footer" into one "Build UI components" node.

Each of these becomes a node on the visual canvas with full details.

---

## MCP Tools

| Tool | Input | Purpose |
|------|-------|---------|
| `submit_plan` | `{ plan_xml, workspace_path?, agent_type? }` | Submit complete XML plan |
| `stream_plan_chunk` | `{ xml_chunk, workspace_path?, agent_type? }` | Stream XML incrementally |
| `get_approval` | `{ project_id? }` | Wait for user approval (may return "pending" — call again) |
| `update_node_status` | `{ node_id, status, output?, project_id? }` | Update execution progress |
| `plan_completed` | `{ project_id? }` | Mark plan done |
| `plan_failed` | `{ error, project_id? }` | Mark plan failed |
| `check_rerun` | `{ timeout_ms?, project_id? }` | Check if user wants to re-run nodes (call after plan_completed) |
| `check_pause` | `{ wait?, project_id? }` | Check if user paused execution (call before each node) |
| `get_resume_info` | `{ project_id? }` | Get state info for resuming a paused/failed plan |
| `request_plan_update` | `{ operations, project_id? }` | Apply incremental updates to the plan (insert, delete, replace) |
| `create_new_plan` | `{ project_id? }` | Signal you're creating a new unrelated plan (adds alongside existing) |

### Multi-Project Support

Overture supports multiple projects running simultaneously. Each project gets its own tab in the UI.

- **`workspace_path`**: Pass the absolute path to your project directory when calling `submit_plan` or `stream_plan_chunk`. This enables project isolation and history tracking.
- **`agent_type`**: Identify yourself (e.g., "cursor") so the UI shows the correct agent name.
- **`project_id`** / **`expected_project_id`**: **CRITICAL** - These are returned in the response from `submit_plan` and `stream_plan_chunk`. **YOU MUST use this exact value** in ALL subsequent calls (`get_approval`, `update_node_status`, `plan_completed`, etc.). The frontend uses this ID to match your approval request.

**Example workflow:**
```
1. Call submit_plan({ plan_xml, workspace_path: "/path/to/project" })
2. Response: { success: true, projectId: "84393059027d", expected_project_id: "84393059027d" }
3. Call get_approval({ project_id: "84393059027d" })  ← MUST match!
4. Call update_node_status({ node_id: "n1", status: "active", project_id: "84393059027d" })
```

If you don't pass `workspace_path`, Overture uses a default project which works fine for single-project scenarios.

### Updating an Existing Plan

When the user requests changes to an existing plan, use `request_plan_update` with an array of operations:

**Supported operations:**
- `insert_after` - Insert a node after a reference node
- `insert_before` - Insert a node before a reference node
- `delete` - Delete a node (edges auto-reconnect)
- `replace` - Replace a node's content in-place

**Example:**
```json
request_plan_update({
  "operations": [
    {
      "op": "insert_after",
      "reference_node_id": "node_api",
      "node": {
        "id": "node_test",
        "type": "task",
        "title": "Run unit tests",
        "description": "Execute test suite"
      }
    },
    { "op": "delete", "node_id": "node_deploy" },
    {
      "op": "replace",
      "node_id": "node_5",
      "node": { "title": "Updated title", "description": "Updated description" }
    }
  ]
})
```

After calling `request_plan_update`, call `get_approval()` to confirm changes.

### Creating a New Unrelated Plan

If the user asks for something completely unrelated to the current plan (e.g., "forget that, let's build X instead"):

1. **Call `create_new_plan`** — This clears the current plan state
2. **Call `submit_plan` or `stream_plan_chunk`** with the new plan XML
3. **Call `get_approval`** to wait for user approval
4. Proceed with execution once approved

**Example workflow:**
```
1. User: "Actually, let's work on the authentication system instead"
2. You call: create_new_plan({ project_id })
3. You call: submit_plan({ plan_xml: "<new auth system plan>" })
4. You call: get_approval({ project_id })
5. Execute nodes as normal
```

---

## XML Plan Schema

```xml
<plan id="plan_001" title="Comprehensive Plan Title" agent="cursor">
  <nodes>
    <!-- Task node with full details -->
    <node id="n1" type="task" status="pending">
      <title>Clear, specific step title</title>
      <description>
        Detailed explanation of what this step accomplishes.
        Include context about why this step is necessary.
        Explain the approach you'll take.
      </description>
      <complexity>low|medium|high</complexity>
      <expected_output>
        Specific deliverables: files created, functions implemented, APIs integrated, etc.
      </expected_output>
      <risks>
        What could go wrong? Edge cases? How will you handle them?
      </risks>

      <!-- Dynamic fields for user input -->
      <dynamic_field
        id="f1"
        name="project_name"
        type="string"
        required="true"
        title="Project Name"
        description="Name for the project directory"
        value="my-project"
      />

      <dynamic_field
        id="f2"
        name="api_key"
        type="secret"
        required="true"
        title="Stripe API Key"
        description="Your Stripe secret key for payment processing"
        setup_instructions="Get from dashboard.stripe.com/apikeys"
      />
    </node>

    <!-- Decision node when multiple approaches are valid -->
    <node id="n2" type="decision" status="pending">
      <title>Select Database</title>
      <description>Choose the database technology for this project</description>

      <branch id="b1" label="PostgreSQL">
        <description>Full-featured relational database</description>
        <pros>ACID compliance, complex queries, strong ecosystem</pros>
        <cons>Requires server setup, more complex scaling</cons>
      </branch>

      <branch id="b2" label="SQLite">
        <description>File-based embedded database</description>
        <pros>Zero setup, portable, fast for read-heavy workloads</pros>
        <cons>Not suitable for high concurrency or large datasets</cons>
      </branch>

      <branch id="b3" label="MongoDB">
        <description>Document-oriented NoSQL database</description>
        <pros>Flexible schema, horizontal scaling, JSON-native</pros>
        <cons>No ACID transactions across documents, eventual consistency</cons>
      </branch>
    </node>

    <!-- Task linked to a specific branch -->
    <node id="n3" type="task" status="pending" branch_parent="n2" branch_id="b1">
      <title>Configure PostgreSQL Connection</title>
      <description>Set up database connection with Prisma ORM</description>
      <complexity>medium</complexity>
      <expected_output>Prisma schema and database client configured</expected_output>

      <dynamic_field
        id="f3"
        name="database_url"
        type="secret"
        required="true"
        title="Database URL"
        description="PostgreSQL connection string"
        setup_instructions="Format: postgres://user:pass@host:5432/database"
      />
    </node>
  </nodes>

  <edges>
    <edge id="e1" from="n1" to="n2" />
    <edge id="e2" from="n2" to="n3" />
  </edges>
</plan>
```

---

## Branching Rules (CRITICAL FOR UI RENDERING)

When you create decision nodes with branches, you **MUST** follow these rules for the UI to render correctly:

### Rule 1: Every branch needs follow-up tasks
For EACH branch option in a decision node, create at least one task node that is linked to that specific branch.

### Rule 2: Use branch_parent and branch_id attributes
Tasks that belong to a specific branch MUST have both attributes:
```xml
<node id="n3" type="task" branch_parent="n2" branch_id="b1">
```
- `branch_parent`: The ID of the decision node (e.g., "n2")
- `branch_id`: The ID of the specific branch this task belongs to (e.g., "b1")

### Rule 3: Create parallel branch paths
If a decision has 3 branches (b1, b2, b3), you need tasks for each:
```xml
<!-- Decision node -->
<node id="n2" type="decision">
  <branch id="b1" label="Option A">...</branch>
  <branch id="b2" label="Option B">...</branch>
  <branch id="b3" label="Option C">...</branch>
</node>

<!-- Tasks for branch b1 (Option A) -->
<node id="n3" type="task" branch_parent="n2" branch_id="b1">
  <title>Implement Option A</title>
</node>

<!-- Tasks for branch b2 (Option B) -->
<node id="n4" type="task" branch_parent="n2" branch_id="b2">
  <title>Implement Option B</title>
</node>

<!-- Tasks for branch b3 (Option C) -->
<node id="n5" type="task" branch_parent="n2" branch_id="b3">
  <title>Implement Option C</title>
</node>

<!-- Edges connect decision to ALL branch tasks -->
<edge from="n2" to="n3" />
<edge from="n2" to="n4" />
<edge from="n2" to="n5" />
```

### Rule 4: Branches can converge
After branch-specific tasks, you can have a common task that all branches lead to:
```xml
<!-- Common task after all branches -->
<node id="n6" type="task">
  <title>Continue with shared step</title>
</node>

<edge from="n3" to="n6" />
<edge from="n4" to="n6" />
<edge from="n5" to="n6" />
```

---

## Dynamic Field Types

| Type | Use Case | Example |
|------|----------|---------|
| `string` | Text input | Project name, domain, usernames |
| `secret` | Sensitive data (masked input) | API keys, tokens, passwords |
| `select` | Choice from options (use `options="a,b,c"`) | Framework choice, environment |
| `boolean` | Yes/No toggle | Enable TypeScript? Use strict mode? |
| `number` | Numeric input | Port number, timeout value |

**Always include `setup_instructions`** for fields requiring external values (API keys, credentials).

---

## CRITICAL: Node-by-Node Execution (DO NOT OVER-IMPLEMENT)

**YOU MUST ONLY IMPLEMENT THE CURRENT NODE.** This is non-negotiable.

When you receive a node (via `firstNode` from `get_approval` or `nextNode` from `update_node_status`), you must:

### DO:
- **ONLY** implement what is described in that specific node's `title` and `description`
- **CONSUME ALL** fields in `fieldValues` — every single one must be used
- **READ AND USE ALL** files in `attachments` — do not ignore any attached file
- **FOLLOW EXACTLY** the `metaInstructions` if present — these are user directives
- **USE THE MCP SERVER** as specified in `mcpServers.formattedInstructions` if present
- **RESPECT** the node's `complexity`, `expectedOutput`, and `risks`

### DO NOT:
- Implement tasks from future nodes
- "Get ahead" by doing work not specified in the current node
- Skip any field, attachment, or instruction in the current node
- Assume what comes next — wait for the next node
- Add features or functionality not explicitly in the node description

### Why This Matters

Each node is a contract. The user approved a specific plan with specific nodes. If you over-implement:
- You break the visual progress tracking (nodes won't match actual work)
- You may contradict decisions the user will make in future nodes
- You waste tokens on work that might need to be redone
- You violate the user's trust in the plan they approved

### Checklist Before Completing a Node

Before calling `update_node_status(node_id, "completed", output)`, verify:
- [ ] **Did I check for `mcpServers` FIRST?** (If present, did I install it if needed?)
- [ ] **Did I USE the `mcpServers` tools** as specified in `formattedInstructions`? (if present)
- [ ] Did I implement ONLY what this node's description specified?
- [ ] Did I use EVERY value in `fieldValues`?
- [ ] Did I read and incorporate EVERY file in `attachments`?
- [ ] Did I follow the `metaInstructions` exactly?
- [ ] Did I NOT do any work belonging to other nodes?

---

## Execution Workflow

```
1. Receive task from user
2. Generate comprehensive XML plan (see planning requirements above)
3. Call submit_plan (or stream_plan_chunk for real-time streaming)
4. Call get_approval
   - If status is "pending", call get_approval again (user is still reviewing)
   - If status is "approved", you receive firstNode with all its config
   - If status is "cancelled", stop and inform user
5. FOR EACH NODE (starting with firstNode), execute in this EXACT order:
   a. Call update_node_status(node_id, "active")

   b. **FIRST: CHECK FOR MCP SERVER** ← THIS IS MANDATORY
      - If node.mcpServers exists:
        1. Check if MCP server is already installed/configured
        2. If NOT installed: STOP and install it following mcpServers.readmeContent
        3. Verify installation by calling one of the MCP server's tools
        4. Only then proceed to use it for the node's task

   c. Execute the node's task using:
      - node.fieldValues (use ALL of them)
      - node.attachments (read and use ALL files)
      - node.metaInstructions (follow EXACTLY)
      - node.mcpServers tools (if present, use as specified in formattedInstructions)

   d. Call update_node_status(node_id, "completed", output)
   e. Check response: if isPaused is true, call check_pause({ wait: true })
   f. Get nextNode from response, or isLastNode: true

6. Repeat step 5 for each nextNode until isLastNode is true
7. Call plan_completed
```

### ⚠️ MCP SERVER CHECK IS STEP 5b - DO NOT SKIP

When you receive ANY node (firstNode or nextNode), your **FIRST ACTION** after marking it active must be:

```
IF node.mcpServers EXISTS:
  → STOP everything else
  → Try to use one of the MCP server's tools to check if it's installed
  → If you get "No connection found" or similar error:
      ╔══════════════════════════════════════════════════════════════╗
      ║  DO NOT SKIP TO THE NEXT NODE                                ║
      ║  DO NOT IGNORE THIS ERROR                                    ║
      ║  YOU MUST INSTALL THE MCP SERVER NOW                         ║
      ╚══════════════════════════════════════════════════════════════╝
      1. Read mcpServers.readmeContent for installation instructions
      2. Install the MCP server (uvx, pip, docker, etc.)
      3. Configure it in the MCP settings file
      4. Retry the tool call to verify installation
  → Once working, use the MCP server for the node's task
```

### 🚨 CRITICAL: "No connection found" Error Handling

If you attempt to use an MCP tool and receive an error like:
```
Error executing MCP tool: No connection found for server: [server-name]
```

**THIS IS NOT A REASON TO SKIP THE NODE OR PROCEED WITHOUT THE MCP SERVER.**

You MUST:
1. **STOP** - Do not continue with the node's task
2. **INSTALL** - Follow the installation instructions in `mcpServers.readmeContent`
3. **CONFIGURE** - Add the server to the MCP settings file
4. **VERIFY** - Call the tool again to confirm it works
5. **THEN CONTINUE** - Only after successful verification, proceed with the node's task

**The user attached this MCP server because they NEED it for this node. Skipping it defeats the entire purpose.**

## Response Payloads

### get_approval (when approved)
```json
{
  "status": "approved",
  "firstNode": {
    "id": "n1",
    "title": "Initialize Project",
    "type": "task",
    "description": "Set up the project structure",
    "fieldValues": { "api_key": "sk-..." },
    "attachments": [{ "path": "/path/to/file", "name": "spec.md", "type": "document" }],
    "metaInstructions": "Use TypeScript strict mode",
    "mcpServers": { ... }
  },
  "message": "Plan approved by user. Execute firstNode, then call update_node_status to get the next node."
}
```

**Note:** Each node's configuration is included directly in the node object. You receive nodes one at a time — `firstNode` from `get_approval`, then `nextNode` from each `update_node_status` call.

### update_node_status (when completed)
```json
{
  "success": true,
  "message": "Node n1 status updated to completed",
  "nextNode": {
    "id": "n2",
    "title": "Configure Database",
    "type": "task",
    "description": "Set up database connection",
    "fieldValues": { "database_url": "postgres://..." },
    "attachments": [],
    "metaInstructions": "Use connection pooling"
  }
}
```

When it's the last node:
```json
{
  "success": true,
  "message": "Node n5 status updated to completed. This was the last node.",
  "isLastNode": true
}
```

### check_rerun (after plan_completed)
```json
{
  "hasRerun": true,
  "nodeId": "n3",
  "mode": "single",  // or "to-bottom"
  "nodeInfo": { ... },
  "message": "Rerun requested from node n3 (single)"
}
```

## Pause/Resume Workflow

Users can pause execution at any time by clicking the pause button or pressing Space. The `isPaused` flag is included in every `update_node_status` response, so you don't need to poll.

```
After completing a node:
1. Call update_node_status(node_id, "completed", output)
2. Check response.isPaused:
   - If false → proceed to nextNode
   - If true → call check_pause({ wait: true }) to block until resumed
3. Continue execution
```

### update_node_status Response (with pause)
```json
{
  "success": true,
  "message": "Node n1 status updated to completed",
  "nextNode": { ... },
  "isPaused": true
}
```

---

## Resume Plan Workflow

When a plan was paused, failed, or loaded from history, use `get_resume_info` to understand where execution stopped and continue from there.

### get_resume_info Response
```json
{
  "success": true,
  "resumeInfo": {
    "planId": "plan_123",
    "planTitle": "Build Authentication System",
    "agent": "cursor",
    "status": "paused",
    "projectId": "abc123",
    "workspacePath": "/Users/dev/my-project",

    "currentNodeId": "n3",
    "currentNodeTitle": "Configure Database",
    "currentNodeStatus": "active",

    "completedNodes": [
      { "id": "n1", "title": "Initialize Project", "output": "Created package.json..." },
      { "id": "n2", "title": "Install Dependencies", "output": "Installed 15 packages" }
    ],
    "pendingNodes": [
      { "id": "n4", "title": "Create User Model", "description": "Define user schema..." },
      { "id": "n5", "title": "Implement Auth Routes", "description": "Create login/signup..." }
    ],
    "failedNodes": [],

    "fieldValues": { "n3.database_url": "postgres://..." },
    "selectedBranches": { "n2": "branch_prisma" },
    "nodeConfigs": { ... },

    "createdAt": "2024-01-15T10:30:00Z",
    "pausedAt": "2024-01-15T11:45:00Z"
  },
  "message": "Resume info retrieved. Plan is at status 'paused'. Current node: Configure Database (active). Completed: 2, Pending: 2, Failed: 0"
}
```

### Resume Workflow

```
1. Call get_resume_info to understand the current state
2. Identify the current node (resumeInfo.currentNodeId)
3. If currentNodeStatus is "active" or "failed":
   - Resume execution from that node
   - Use the fieldValues, selectedBranches, and nodeConfigs
4. Call update_node_status to continue the normal execution flow
5. Proceed with subsequent nodes until isLastNode is true
6. Call plan_completed when done
```

### When to Use get_resume_info

- After a plan was **paused** by the user and you need to resume
- After a plan **failed** and you want to retry from the failed node
- When loading a plan from **history** to continue where it left off
- When you lose context and need to understand the current execution state

---

## Re-run Workflow

After `plan_completed`, users can click nodes to re-run them:
- **Single node** (play icon): Re-run just that node
- **To bottom** (play + arrow): Re-run from that node to the end

Loop on `check_rerun` after completion to handle user rerun requests.

---

## What Users Can Do in Overture

Before approving, users can:
- **Click nodes** to see full details (description, risks, expected output)
- **Fill dynamic fields** with their API keys, configuration values
- **Select branches** at decision nodes to choose their preferred approach
- **Attach files** to nodes — you'll receive the file paths to reference
- **Add meta instructions** — specific guidance for how to execute that node

All user modifications are returned to you when they approve.

---

## MCP Server Integration (CRITICAL)

Users can attach **MCP servers** to individual nodes to extend your capabilities. When a node has an MCP server attached, the `nextNode` response will include an `mcpServers` object with a `formattedInstructions` field.

### Example Response with MCP Server
```json
{
  "success": true,
  "nextNode": {
    "id": "n5",
    "title": "Generate product images",
    "fieldValues": { ... },
    "attachments": [],
    "mcpServers": {
      "name": "replicate-mcp",
      "author": "replicate",
      "description": "Generate images using Replicate AI models",
      "githubUrl": "https://github.com/replicate/replicate-mcp",
      "requiresApiKey": true,
      "readmeContent": "# replicate-mcp\n\n## Installation\n...",
      "formattedInstructions": "=== MCP SERVER INTEGRATION ===\n..."
    }
  }
}
```

### MANDATORY Requirements

When `mcpServers` is present on a node:

1. **YOU MUST** use the MCP server exactly as described by the user in `formattedInstructions`
2. **YOU MUST** follow the user's intended usage precisely — they specified why they attached this MCP
3. **IF THE MCP SERVER IS NOT AVAILABLE OR NOT CONFIGURED**, follow the Setup Instructions below

### Setup Instructions (When MCP Server Not Available)

The `mcpServers.formattedInstructions` field now includes **provider-specific setup instructions** tailored for Cursor. Follow them exactly.

**Cursor MCP Configuration File Locations:**
- **Project-level:** `.cursor/mcp.json` (in project root)
- **Global:** `~/.cursor/mcp.json` (user home directory)

**Setup Steps:**
1. **Create or open** the `mcp.json` file at one of the locations above
2. **Read existing config** if it exists — DO NOT overwrite other servers
3. **Add the new server** to the `"mcpServers"` object
4. **Save the file**
5. **Restart Cursor** or reload the window
6. **Verify** by calling one of the MCP server's tools

**Example Configuration:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "uvx",
      "args": ["mcp-server-name"]
    }
  }
}
```

**Tip:** Use project-level config for project-specific tools, global for tools you want everywhere.

### Setup Workflow

```
1. Try to use the MCP server
2. If you get "No connection found" error:
   a. Read mcpServers.formattedInstructions for provider-specific setup
   b. Read mcpServers.readmeContent for installation commands
   c. Read existing MCP settings file (DO NOT OVERWRITE existing servers)
   d. Add the new server configuration
   e. Install dependencies (uvx, pip, etc.)
   f. Restart Cursor / reload window
   g. Retry the MCP tool call to verify installation
3. Once working, use the MCP server for the node's task
```

### Why This Matters

Users attach MCP servers because they want specific capabilities for specific nodes. Ignoring this is equivalent to ignoring their explicit instructions. The `mcpServers` object contains everything you need:
- `name`, `author`, `description` — Server identification
- `githubUrl` — Source repository for documentation
- `readmeContent` — Installation and usage instructions
- `requiresApiKey` — Whether API key configuration is needed
- `formattedInstructions` — User's intended usage and critical compliance instructions

**Always check for `mcpServers` on every node and honor its instructions.**

---

## Best Practices

1. **Decompose thoroughly**: Each action should be its own node
2. **Use decision nodes**: Don't assume the user's preference — let them choose
3. **Declare all inputs**: Any config needed at runtime should be a dynamic field
4. **Be specific**: Descriptions should leave no ambiguity about what the step does
5. **Document risks**: Show you've considered what could go wrong
6. **Update frequently**: Call `update_node_status` so users see real-time progress
7. **Honor meta instructions**: If a node has `metaInstructions`, follow them precisely
8. **Use attachments**: If a node has file attachments, read and incorporate those files
9. **Honor MCP servers**: When a node has `mcpServers`, follow its `formattedInstructions` precisely

---

## Why This Matters

Without Overture:
- User prompts you with a task
- You immediately start coding
- User realizes halfway through you misunderstood
- 200+ lines of code discarded
- Tokens wasted, time wasted, trust eroded

With Overture:
- User prompts you with a task
- You generate a detailed plan
- User reviews, adjusts, approves
- You execute exactly what they want
- Zero wasted effort

---

> "The best time to shape the plan is before the first line of code is written." — Overture by Sixth
