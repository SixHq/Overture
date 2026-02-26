# Overture Integration for Claude Code

You have access to **Overture**, an MCP server that visualizes your execution plans as interactive flowcharts before you write any code.

## Why Overture Exists

Every AI coding agent shares the same fundamental problem: the developer types a prompt, you start working, and they have **no visibility** into what you're planning. By the time they realize you went in the wrong direction, you've already written 200+ lines of code that needs to be discarded.

**Overture solves this by making your plan visible, editable, and approvable before execution begins.**

---

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

### The Golden Rule: ONE COMPONENT = ONE NODE

**NEVER combine multiple components or features into a single node.** Each UI component, each API endpoint, each configuration step gets its own dedicated node.

### Planning Requirements

For every task you receive, your plan must include:

1. **Atomic Decomposition**: Break every task into its smallest executable steps
2. **Rich Node Details**: Every node needs title, description, complexity, expected output, and risks
3. **Decision Points**: Use `decision` nodes whenever multiple valid approaches exist
4. **Dynamic Fields**: Declare any inputs needed from the user (API keys, config, preferences)
5. **Logical Dependencies**: Edges should reflect true execution order

### Example: Good vs. Bad Planning

**BAD PLAN (lazy, combined steps - DO NOT DO THIS):**
```
1. Set up project
2. Build the frontend
3. Add backend API
4. Deploy
```

**GOOD PLAN (atomic decomposition - THIS IS WHAT WE WANT):**
```
1. Initialize Next.js project with TypeScript
2. Configure Tailwind CSS with custom theme colors
3. Create Header component
   - Logo placement and styling
   - Navigation menu items
   - Mobile hamburger menu
   - Dark mode toggle button
4. Create Hero section
   - Main headline with gradient text
   - Subheadline copy
   - Primary CTA button with hover states
   - Background image/pattern
5. Create Features section
   - Section heading
   - 3-column grid layout
   - Individual FeatureCard component
   - Icons for each feature
6. Create Testimonials section
   - Testimonial card component
   - Avatar, name, role, quote
   - Carousel/grid layout
7. Create Pricing section
   - Monthly/Annual toggle
   - PricingCard component for each tier
   - Feature comparison list
8. Create Footer component
   - Logo and tagline
   - Link columns (Product, Company, Resources)
   - Newsletter signup form
   - Social media icons
9. Create Contact form
   - Form fields (name, email, message)
   - Validation logic
   - Submit handler
10. Add SEO meta tags and Open Graph
11. Configure Vercel deployment
```

**Notice:** Each component (Header, Hero, Features, Footer, etc.) is its **own separate node**. Do NOT combine "Header, Hero, and Footer" into one "Build UI components" node.

### Example: Full-Stack App Decomposition

If a user asks for "a full-stack e-commerce app with Stripe integration," your plan should include nodes like:

**Project Setup Phase:**
- Initialize Next.js project with TypeScript and App Router
- Configure Tailwind CSS and component library
- Set up ESLint and Prettier configuration
- Initialize Git repository with .gitignore

**Database Phase:**
- Decision node: Choose database (PostgreSQL vs Planetscale vs Supabase)
- Configure Prisma ORM with selected database
- Create database schema (products, users, orders, cart)
- Set up database migrations

**Authentication Phase:**
- Decision node: Choose auth approach (NextAuth vs Clerk vs custom)
- Implement sign up flow with email verification
- Implement login flow with session management
- Add password reset functionality

**Product Catalog:**
- Create Product model and API routes
- Build product listing page with filters
- Build product detail page
- Implement search functionality

**Shopping Cart:**
- Create Cart context/store
- Build cart drawer/page component
- Implement add/remove/update quantity
- Add cart persistence (localStorage + database sync)

**Stripe Integration:**
- Configure Stripe API keys
- Create checkout session endpoint
- Build checkout page with Stripe Elements
- Implement webhook handler for payment events
- Handle success/failure states

**Order Management:**
- Create Order model and API routes
- Build order confirmation page
- Implement order history page
- Add email notifications

**Deployment:**
- Decision node: Choose platform (Vercel vs Railway vs custom)
- Configure environment variables
- Set up CI/CD pipeline
- Configure production database

Each of these becomes a node on the visual canvas with full details, risks, and expected outputs.

---

## MCP Tools

| Tool | Input | Purpose |
|------|-------|---------|
| `submit_plan` | `{ plan_xml, workspace_path?, agent_type? }` | Submit complete XML plan |
| `stream_plan_chunk` | `{ xml_chunk, workspace_path?, agent_type? }` | Stream XML incrementally for real-time display |
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
- **`agent_type`**: Identify yourself (e.g., "claude-code") so the UI shows the correct agent name.
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

When the user requests changes to an existing plan, use `request_plan_update` with an array of operations. This applies incremental updates with smooth animations instead of regenerating the entire plan.

**Supported operations:**
- `insert_after` - Insert a node after a reference node
- `insert_before` - Insert a node before a reference node
- `delete` - Delete a node (edges auto-reconnect)
- `replace` - Replace a node's content in-place

**Example - Adding a testing step:**
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
        "description": "Execute test suite and verify all tests pass"
      }
    }
  ]
})
```

**Example - Multiple operations at once:**
```json
request_plan_update({
  "operations": [
    { "op": "delete", "node_id": "node_deploy" },
    {
      "op": "replace",
      "node_id": "node_5",
      "node": {
        "title": "Updated title",
        "description": "Updated description with more detail"
      }
    },
    {
      "op": "insert_before",
      "reference_node_id": "node_final",
      "node": {
        "id": "node_review",
        "type": "task",
        "title": "Code review",
        "description": "Review all changes before finalizing"
      }
    }
  ]
})
```

After calling `request_plan_update`, call `get_approval()` to confirm changes with the user.

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
<plan id="plan_001" title="Comprehensive Plan Title" agent="claude-code">
  <nodes>
    <!-- Task node with full details -->
    <node id="n1" type="task" status="pending">
      <title>Clear, specific step title</title>
      <description>
        Detailed explanation of what this step accomplishes.
        Include context about why this step is necessary.
        Explain the technical approach you'll take.
      </description>
      <complexity>low|medium|high</complexity>
      <expected_output>
        Specific deliverables:
        - Files created: src/components/Button.tsx
        - APIs integrated: Stripe checkout session
        - Database changes: New User table
      </expected_output>
      <risks>
        What could go wrong? Edge cases to handle?
        - Risk: API rate limiting
        - Mitigation: Implement exponential backoff
      </risks>

      <!-- Dynamic fields for user input -->
      <dynamic_field
        id="f1"
        name="stripe_secret_key"
        type="secret"
        required="true"
        title="Stripe Secret Key"
        description="Your Stripe secret API key for payment processing"
        setup_instructions="Get from dashboard.stripe.com/apikeys. Use test key (sk_test_...) for development."
      />

      <dynamic_field
        id="f2"
        name="enable_typescript"
        type="boolean"
        required="false"
        title="Enable TypeScript"
        description="Use TypeScript for type safety"
        value="true"
      />

      <dynamic_field
        id="f3"
        name="css_framework"
        type="select"
        required="true"
        title="CSS Framework"
        description="Choose your styling approach"
        options="Tailwind CSS,CSS Modules,Styled Components,Plain CSS"
        value="Tailwind CSS"
      />
    </node>

    <!-- Decision node when multiple approaches are valid -->
    <node id="n2" type="decision" status="pending">
      <title>Select Authentication Strategy</title>
      <description>
        Choose how users will authenticate with your application.
        This affects security model, user experience, and maintenance burden.
      </description>

      <branch id="b1" label="NextAuth.js">
        <description>Full-featured auth library with provider support</description>
        <pros>Many OAuth providers, session management, database adapters</pros>
        <cons>Can be complex to customize, learning curve</cons>
      </branch>

      <branch id="b2" label="Clerk">
        <description>Managed authentication service</description>
        <pros>Beautiful UI components, easy setup, handles edge cases</pros>
        <cons>Third-party dependency, potential vendor lock-in, costs at scale</cons>
      </branch>

      <branch id="b3" label="Custom JWT">
        <description>Build authentication from scratch</description>
        <pros>Full control, no dependencies, deep understanding</pros>
        <cons>Security risks if done wrong, more code to maintain</cons>
      </branch>
    </node>

    <!-- Task linked to a specific branch -->
    <node id="n3" type="task" status="pending" branch_parent="n2" branch_id="b1">
      <title>Configure NextAuth.js</title>
      <description>
        Set up NextAuth.js with email/password and OAuth providers.
        Configure session strategy and database adapter.
      </description>
      <complexity>medium</complexity>
      <expected_output>
        - /app/api/auth/[...nextauth]/route.ts configured
        - Prisma adapter connected
        - Google OAuth provider enabled
        - Session callback customized
      </expected_output>
      <risks>
        - OAuth redirect URLs must match exactly
        - Database session table must exist
      </risks>

      <dynamic_field
        id="f4"
        name="google_client_id"
        type="string"
        required="true"
        title="Google OAuth Client ID"
        setup_instructions="Create at console.cloud.google.com/apis/credentials"
      />

      <dynamic_field
        id="f5"
        name="google_client_secret"
        type="secret"
        required="true"
        title="Google OAuth Client Secret"
        setup_instructions="From the same OAuth 2.0 Client ID"
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

| Type | Use Case | Required Attributes |
|------|----------|---------------------|
| `string` | Text input | `name`, `title` |
| `secret` | Masked input for sensitive data | `name`, `title`, `setup_instructions` |
| `select` | Dropdown options | `name`, `title`, `options` (comma-separated) |
| `boolean` | Toggle switch | `name`, `title` |
| `number` | Numeric input | `name`, `title` |

**Always include `setup_instructions`** when the user needs to obtain a value from an external service.

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
2. Analyze task complexity
   - If simple (single file, obvious fix): execute directly without Overture
   - If complex (multiple files, decisions, config needed): use Overture
3. Generate comprehensive XML plan
4. Call submit_plan (or stream_plan_chunk for incremental display)
5. Call get_approval and handle response:
   - status: "pending" → call get_approval again (user is still reviewing)
   - status: "approved" → you receive firstNode with all its config
   - status: "cancelled" → stop and inform user
6. FOR EACH NODE (starting with firstNode), execute in this EXACT order:
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
   g. If error: update_node_status(node_id, "failed", error) and plan_failed(error)

7. Repeat step 6 for each nextNode until isLastNode is true
8. Call plan_completed when all nodes succeed
```

### ⚠️ MCP SERVER CHECK IS STEP 6b - DO NOT SKIP

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

### check_pause Response (after waiting)
```json
{
  "isPaused": false,
  "wasResumed": true,
  "message": "Execution was paused and has now been resumed"
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
    "agent": "claude-code",
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

After `plan_completed`, users can click re-run buttons on any node:
- **Play icon**: Re-run just that single node
- **Play + down arrow**: Re-run from that node to the end of the plan

This allows users to:
1. Fix a failed node and re-run it
2. Try an alternative branch after completing the initial branch
3. Re-execute part of the plan with different inputs

```
1. Call plan_completed when done
2. Loop: call check_rerun (with short timeout)
   - If hasRerun is false, continue checking or exit
   - If hasRerun is true:
     a. Execute nodeInfo (same as normal node execution)
     b. If mode is "to-bottom", continue to subsequent nodes
     c. Call plan_completed again
     d. Return to step 2
```

---

## Handling User Additions

Each node you receive (via `firstNode` or `nextNode`) includes all user customizations directly:

```json
{
  "id": "n1",
  "title": "Initialize Project",
  "fieldValues": { "api_key": "sk_test_..." },
  "attachments": [
    { "path": "/Users/dev/project/design.figma", "name": "design.figma", "type": "other" },
    { "path": "/Users/dev/project/api-spec.yaml", "name": "api-spec.yaml", "type": "code" }
  ],
  "metaInstructions": "Use the exact colors from the Figma file. Follow the API spec strictly.",
  "mcpServers": { ... }
}
```

**Attachments**: Read these files and incorporate their content into your work for that node.

**Meta Instructions**: These are specific directives from the user for how to execute this node. Follow them precisely.

**MCP Server**: If present, use the MCP server as specified in `formattedInstructions`. See the MCP Server Integration section below.

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

The `mcpServers.formattedInstructions` field now includes **provider-specific setup instructions** tailored for Claude Code. Follow them exactly.

**Claude Code MCP Configuration:**

**Option 1: Using CLI (Recommended)**
```bash
claude mcp add server-name --scope user
```

**Option 2: Direct Configuration**
- **User scope:** `~/.claude.json`
- **Project scope:** `.mcp.json` (in project root)

**Setup Steps:** 
1. **Use CLI** or open the config file
2. **Read existing config** if it exists — DO NOT overwrite other servers
3. **Add the new server** configuration
4. **Save the file**
5. **Verify** using `claude mcp list` or by calling one of the MCP server's tools

**Example Configuration:**
```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "uvx",
      "args": ["mcp-server-name"]
    }
  }
}
```

**Verification Commands:**
```bash
claude mcp list
claude mcp get server-name
```

### Setup Workflow

```
1. Try to use the MCP server
2. If you get "No connection found" error:
   a. Read mcpServers.formattedInstructions for provider-specific setup
   b. Read mcpServers.readmeContent for installation commands
   c. Use `claude mcp add` or edit config file directly
   d. Read existing config (DO NOT OVERWRITE existing servers)
   e. Add the new server configuration
   f. Install dependencies (uvx, pip, etc.)
   g. Verify with `claude mcp list`
   h. Retry the MCP tool call to verify installation
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

1. **Decompose thoroughly**: One action per node. "Set up project" is too vague; "Initialize Vite with React and TypeScript" is specific.

2. **Use decision nodes liberally**: Whenever you'd normally make an assumption about approach, create a decision node instead.

3. **Declare all inputs upfront**: Every API key, credential, or config value needed at runtime should be a dynamic field.

4. **Be specific in descriptions**: Users should understand exactly what will happen without ambiguity.

5. **Document expected outputs**: List specific files, functions, or changes that will result from each node.

6. **Include risks and mitigations**: Show you've thought about what could go wrong.

7. **Update status in real-time**: Call `update_node_status("active")` before starting and `update_node_status("completed", output)` when done.

8. **Honor user additions**: Always check for and follow `metaInstructions`. Always read and use `attachments`.

9. **Stream for long plans**: Use `stream_plan_chunk` for plans with many nodes so users see progress immediately.

10. **Honor MCP servers**: When a node has `mcpServers`, follow its `formattedInstructions` precisely — this is the user's explicit request for extended capabilities.

---

## The Value Proposition

**Without Overture:**
- User: "Build me an e-commerce site"
- You: Start coding immediately
- 20 minutes later: User realizes you used MongoDB when they wanted PostgreSQL
- Result: Wasted tokens, wasted time, frustrated user

**With Overture:**
- User: "Build me an e-commerce site"
- You: Generate detailed plan with database decision node
- User: Reviews plan, selects PostgreSQL, adds Stripe API key, attaches design file
- You: Execute exactly what they approved with their exact inputs
- Result: Perfect alignment, happy user

---

> "The best time to shape the plan is before the first line of code is written." — Overture by Sixth
