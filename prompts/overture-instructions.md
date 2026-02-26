# Overture - Agent Plan Visualizer

You have access to Overture, a visual plan execution tool that displays your execution plan as an interactive flowchart. Before writing any code, you should generate a detailed plan and submit it to Overture for user review and approval.

## How Overture Works

1. **Generate Plan**: When given a task, create a comprehensive XML plan following the schema below
2. **Submit to Overture**: Use the `submit_plan` or `stream_plan_chunk` MCP tool to send the plan
3. **Wait for Approval**: Use the `get_approval` tool - this blocks until the user approves the plan in the visual UI
4. **Execute with Updates**: As you execute each step, use `update_node_status` to update the visual progress
5. **Complete**: When done, call `plan_completed` or `plan_failed`

## XML Plan Schema

```xml
<plan id="unique_id" title="Plan Title" agent="your-agent-name">
  <nodes>
    <!-- Task Node: A step to execute -->
    <node id="n1" type="task" status="pending">
      <title>Short task title</title>
      <description>Detailed description of what this step does</description>
      <complexity>low|medium|high</complexity>
      <expected_output>What files/results this step produces</expected_output>
      <risks>Potential issues or edge cases</risks>

      <!-- Dynamic fields for user input -->
      <dynamic_field
        id="f1"
        name="field_name"
        type="string|secret|select|boolean|number"
        required="true|false"
        title="Human-readable label"
        description="Help text for the field"
        value="default value"
        options="option1,option2,option3"
        setup_instructions="How to get this value"
      />
    </node>
  </nodes>

  <edges>
    <edge id="e1" from="n1" to="n2" />
  </edges>
</plan>
```

## Creating Branches (Simplified Approach)

Branches are automatically detected from the graph structure. **You don't need explicit decision nodes.**

When a node has **multiple outgoing edges**, it becomes a branch point, and the UI will:
1. Render the branching options visually
2. Let the user select which branch to follow
3. Only execute the selected branch path

### Branch Example

```xml
<plan id="plan_styling" title="Set up project styling" agent="claude-code">
  <nodes>
    <!-- This node becomes a branch point because it has multiple outgoing edges -->
    <node id="setup" type="task" status="pending">
      <title>Initialize project</title>
      <description>Create the base project structure</description>
    </node>

    <!-- Option A: Tailwind CSS path -->
    <node id="tailwind" type="task" status="pending">
      <title>Set up Tailwind CSS</title>
      <description>Install and configure Tailwind CSS for utility-first styling</description>
    </node>

    <!-- Option B: CSS Modules path -->
    <node id="css-modules" type="task" status="pending">
      <title>Set up CSS Modules</title>
      <description>Configure CSS Modules for scoped styling</description>
    </node>

    <!-- Convergence point: both branches lead here -->
    <node id="components" type="task" status="pending">
      <title>Build components</title>
      <description>Create the UI components using the chosen styling approach</description>
    </node>
  </nodes>

  <edges>
    <!-- These two edges from 'setup' make it a branch point -->
    <edge id="e1" from="setup" to="tailwind" />
    <edge id="e2" from="setup" to="css-modules" />

    <!-- Both branches converge to 'components' -->
    <edge id="e3" from="tailwind" to="components" />
    <edge id="e4" from="css-modules" to="components" />
  </edges>
</plan>
```

In this example:
- `setup` automatically becomes a branch point (detected from having 2 outgoing edges)
- The user selects either `tailwind` or `css-modules` in the UI
- Only the selected path executes, then continues to `components`

## Available MCP Tools

### `submit_plan`
Submit a complete plan XML at once.
```json
{ "plan_xml": "<plan>...</plan>" }
```

### `stream_plan_chunk`
Stream plan XML incrementally (for real-time node appearance).
```json
{ "xml_chunk": "<node id=\"n1\">..." }
```

### `get_approval`
Wait for user approval. Returns field values and selected branches.
```json
{}
```
Returns:
```json
{
  "approved": true,
  "fieldValues": { "n1.api_key": "sk-xxx" },
  "selectedBranches": { "n2": "b1" }
}
```

### `update_node_status`
Update a node's execution status.
```json
{
  "node_id": "n1",
  "status": "active|completed|failed|skipped",
  "output": "Optional execution output"
}
```

### `plan_completed`
Mark the entire plan as complete.
```json
{}
```

### `plan_failed`
Mark the plan as failed with an error.
```json
{ "error": "Error description" }
```

## Planning Guidelines

1. **Be Exhaustive**: Break down tasks to atomic steps. Don't say "build landing page" - list every component, every section.

2. **Create Branches with Edges**: When there are alternative approaches, create multiple nodes and use edges to create a branch point. The node with multiple outgoing edges becomes the branch point.

3. **Add Dynamic Fields**: For any configuration, API keys, or choices needed during execution, add dynamic fields so the user can provide them before approving.

4. **Estimate Complexity**: Mark each node as low/medium/high complexity to set expectations.

5. **Document Risks**: Note potential issues so the user knows what to watch for.

6. **Order Matters**: Structure edges so dependencies are clear. Parallel tasks should not have edges between them.

## Example: Simple Web App

```xml
<plan id="plan_webapp" title="Create React Todo App" agent="claude-code">
  <nodes>
    <node id="n1" type="task" status="pending">
      <title>Initialize Vite + React project</title>
      <description>Create a new Vite project with React and TypeScript template</description>
      <complexity>low</complexity>
      <expected_output>New project in ./todo-app directory</expected_output>
      <dynamic_field id="f1" name="project_name" type="string" required="true"
        title="Project Name" description="Name for the project directory" value="todo-app"/>
    </node>

    <node id="n2" type="task" status="pending">
      <title>Install dependencies</title>
      <description>Install required npm packages: zustand for state, lucide for icons</description>
      <complexity>low</complexity>
    </node>

    <!-- Styling options: n2 branches to both tailwind and css-modules -->
    <node id="tailwind" type="task" status="pending">
      <title>Set up Tailwind CSS</title>
      <description>Install and configure Tailwind CSS with Vite. Utility-first CSS framework - fast development, consistent design, small bundle.</description>
      <complexity>low</complexity>
    </node>

    <node id="css-modules" type="task" status="pending">
      <title>Set up CSS Modules</title>
      <description>Configure CSS Modules for scoped styling. Clean HTML, full CSS control.</description>
      <complexity>low</complexity>
    </node>

    <node id="n5" type="task" status="pending">
      <title>Create TodoItem component</title>
      <description>Build the individual todo item component with checkbox and delete button</description>
      <complexity>medium</complexity>
    </node>

    <node id="n6" type="task" status="pending">
      <title>Create TodoList component</title>
      <description>Build the list container that renders all todos</description>
      <complexity>low</complexity>
    </node>

    <node id="n7" type="task" status="pending">
      <title>Create AddTodo component</title>
      <description>Build the input form for adding new todos</description>
      <complexity>low</complexity>
    </node>

    <node id="n8" type="task" status="pending">
      <title>Implement Zustand store</title>
      <description>Create the state management store for todos with add, toggle, delete actions</description>
      <complexity>medium</complexity>
    </node>

    <node id="n9" type="task" status="pending">
      <title>Wire up components</title>
      <description>Connect all components to the store and assemble in App.tsx</description>
      <complexity>low</complexity>
    </node>

    <node id="n10" type="task" status="pending">
      <title>Add local storage persistence</title>
      <description>Persist todos to localStorage so they survive page refresh</description>
      <complexity>low</complexity>
    </node>
  </nodes>

  <edges>
    <edge id="e1" from="n1" to="n2" />
    <!-- n2 becomes a branch point with two outgoing edges -->
    <edge id="e2a" from="n2" to="tailwind" />
    <edge id="e2b" from="n2" to="css-modules" />
    <!-- Both branches converge at n5 -->
    <edge id="e3a" from="tailwind" to="n5" />
    <edge id="e3b" from="css-modules" to="n5" />
    <edge id="e4" from="n5" to="n6" />
    <edge id="e5" from="n6" to="n7" />
    <edge id="e6" from="n7" to="n8" />
    <edge id="e7" from="n8" to="n9" />
    <edge id="e8" from="n9" to="n10" />
  </edges>
</plan>
```

## Execution Flow

After approval, execute like this:

```
1. update_node_status(n1, "active")
2. [Do the work for n1]
3. update_node_status(n1, "completed", "Created project in ./todo-app")
4. update_node_status(n2, "active")
5. [Do the work for n2]
6. update_node_status(n2, "completed")
... continue for each node ...
N. plan_completed()
```

If a node fails:
```
update_node_status(n5, "failed", "Error: could not install dependencies")
plan_failed("Installation failed due to network error")
```

---

## CRITICAL: Node-by-Node Execution (DO NOT OVER-IMPLEMENT)

⚠️ **MANDATORY EXECUTION RULES** ⚠️

When executing an Overture plan, you MUST follow these rules EXACTLY:

### Rule 1: ONE NODE AT A TIME
- Execute ONLY the current node returned by `get_approval` or `update_node_status`
- Do NOT look ahead to future nodes
- Do NOT implement multiple nodes at once
- Do NOT "optimize" by combining nodes

### Rule 2: COMPLETE NODE CONSUMPTION
For each node, you MUST implement/consume ALL of the following:
- ✅ `title` - The task title
- ✅ `description` - Full task description
- ✅ `instructions` - Detailed implementation instructions
- ✅ `fieldValues` - All dynamic field values provided by user
- ✅ `mcpServers` - **CRITICAL**: If present, MUST be installed and used
- ✅ `attachments` - All attached files/resources
- ✅ `expected_output` - What the node should produce
- ✅ `metadata` - Any additional metadata

### Rule 3: MCP Server Integration
If a node has an `mcpServers` attached:
1. **CHECK** if the MCP server is already installed
2. **INSTALL** the MCP server if not available (see setup instructions below)
3. **USE** the MCP server tools as specified in the node
4. **DO NOT** skip the node or proceed without the MCP server

### Rule 4: No Over-Implementation
❌ **NEVER DO THESE:**
- Skip to future nodes
- Implement features not in the current node
- "Anticipate" what future nodes might need
- Add "improvements" beyond the node scope
- Ignore MCP server requirements

✅ **ALWAYS DO THESE:**
- Focus only on current node content
- Implement exactly what the node specifies
- Use all provided field values
- Install and use required MCP servers
- Update node status after completion

---

## MCP Server Setup Instructions (Sixth AI)

When a node requires an MCP server that is not installed, follow these steps:

### Configuration File Location
**Sixth AI uses this MCP configuration file:**
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json`
- **Windows**: `%APPDATA%\Code\User\globalStorage\sixth.sixth-ai\settings\sixth-mcp-settings.json`
- **Linux**: `~/.config/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json`

### Setup Steps

1. **Read the current MCP settings file** (create if it doesn't exist)
2. **Add the new server configuration** to the `mcpServers` object
3. **Save the file**
4. **Restart or refresh** the MCP connection

### Configuration Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@package/mcp-server"],
      "env": {
        "API_KEY": "your-api-key"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Example: Adding a New MCP Server

If the node specifies an MCP server like:
```json
{
  "name": "github",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

Add it to the configuration file:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Handling "No connection found" Error

⚠️ **IMPORTANT**: If you receive a "No connection found for MCP server" error:

1. **DO NOT** skip the node
2. **DO NOT** proceed without the MCP server
3. **DO** follow the setup instructions above
4. **DO** install the MCP server
5. **DO** retry the connection after installation
6. **DO** complete the node requirements using the MCP tools

---

**Remember**: The visual plan is the user's way of understanding and controlling your work. Make it comprehensive, clear, and easy to follow. The more detail you provide upfront, the more confidence the user has in approving the plan.
