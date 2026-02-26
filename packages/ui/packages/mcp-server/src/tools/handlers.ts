import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { StreamingXMLParser } from '../parser/xml-parser.js';
import { planStore, multiProjectPlanStore } from '../store/plan-store.js';
import { wsManager } from '../websocket/ws-server.js';
import { Plan, PlanNode, PlanEdge, NodeStatus, McpServer, ProjectContext, ResumePlanInfo } from '../types.js';

// Track parsers per project
const currentParsers: Map<string, StreamingXMLParser> = new Map();

// Track current project context for legacy single-project calls
let currentProjectId: string = 'default';

/**
 * Generate a project ID from workspace path
 */
function generateProjectId(workspacePath: string): string {
  return createHash('sha256').update(workspacePath).digest('hex').substring(0, 12);
}

/**
 * Information about the next node to execute, including user inputs
 */
export interface NextNodeInfo {
  id: string;
  title: string;
  type: string;
  description: string;
  fieldValues: Record<string, string>;
  attachments: { path: string; name: string; type: string }[];
  metaInstructions?: string;
  mcpServers?: (McpServer & { formattedInstructions?: string })[];
}

/**
 * Get provider-specific MCP configuration instructions
 */
function getProviderMcpSetupInstructions(provider: string, serverName: string): string {
  const normalizedProvider = provider.toLowerCase();

  // Server name for config (use GitHub path or simple name)
  const configServerName = serverName.includes('/')
    ? serverName
    : serverName.toLowerCase().replace(/\s+/g, '-');

  switch (normalizedProvider) {
    case 'cline':
      return `
### Cline MCP Setup Instructions

**Configuration File Locations:**
- macOS: ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
- Windows: %APPDATA%\\Code\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json
- Linux: ~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json

**Steps:**
1. Open the MCP settings file at the location above
2. Add the server configuration to the "mcpServers" object
3. Save the file

**Example Configuration:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "command": "uvx",
      "args": ["mcp-server-name"],
      "disabled": false
    }
  }
}
\`\`\`

**Important:** Read the existing file first - DO NOT overwrite other servers!
`;

    case 'sixth':
    case 'sixth-ai':
      return `
### Sixth AI MCP Setup Instructions

**Configuration File Locations:**
- macOS: ~/Library/Application Support/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json
- Windows: %APPDATA%\\Code\\User\\globalStorage\\sixth.sixth-ai\\settings\\sixth-mcp-settings.json
- Linux: ~/.config/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json

**Steps:**
1. Open the MCP settings file at the location above
2. Add the server configuration to the "mcpServers" object
3. Save the file

**Example Configuration:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "command": "uvx",
      "args": ["mcp-server-name"],
      "disabled": false
    }
  }
}
\`\`\`

**Important:** Read the existing file first - DO NOT overwrite other servers!
`;

    case 'cursor':
      return `
### Cursor MCP Setup Instructions

**Configuration File Locations:**
- Project-level: .cursor/mcp.json (in project root)
- Global: ~/.cursor/mcp.json (user home directory)

**Steps:**
1. Create or open the mcp.json file at one of the locations above
2. Add the server configuration
3. Save the file
4. Restart Cursor or reload the window

**Example Configuration:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "command": "uvx",
      "args": ["mcp-server-name"]
    }
  }
}
\`\`\`

**Tip:** Use project-level config for project-specific tools, global for tools you want everywhere.
`;

    case 'claude-code':
    case 'claude':
      return `
### Claude Code MCP Setup Instructions

**Option 1: Using CLI (Recommended)**
\`\`\`bash
claude mcp add ${configServerName} --scope user
\`\`\`

**Option 2: Direct Configuration**
- User scope: ~/.claude.json
- Project scope: .mcp.json (in project root)

**Steps for manual setup:**
1. Open ~/.claude.json (create if it doesn't exist)
2. Add the server configuration
3. Save the file

**Example Configuration:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "type": "stdio",
      "command": "uvx",
      "args": ["mcp-server-name"]
    }
  }
}
\`\`\`

**Verify Installation:**
\`\`\`bash
claude mcp list
claude mcp get ${configServerName}
\`\`\`
`;

    case 'gh_copilot':
    case 'gh-copilot':
    case 'github-copilot':
    case 'copilot':
      return `
### GitHub Copilot MCP Setup Instructions

**Workspace-level Configuration (Recommended)**

Create or edit \`.vscode/mcp.json\` in your project root:

\`\`\`json
{
  "servers": {
    "${configServerName}": {
      "command": "npx",
      "args": ["mcp-server-name"]
    }
  }
}
\`\`\`

**User-level Configuration**

Add to your VS Code \`settings.json\`:

\`\`\`json
{
  "github.copilot.chat.mcpServers": {
    "${configServerName}": {
      "command": "npx",
      "args": ["mcp-server-name"]
    }
  }
}
\`\`\`

**Steps:**
1. Create/edit the config file at one of the locations above
2. Add the server configuration
3. Save the file
4. Reload VS Code window (Cmd/Ctrl + Shift + P → "Developer: Reload Window")

**Important:** Read the existing file first - DO NOT overwrite other servers!
`;

    default:
      return `
### MCP Setup Instructions

Please configure the MCP server according to your AI assistant's documentation.
The server name to use: ${configServerName}

**Common Configuration Format:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "command": "uvx",
      "args": ["mcp-server-name"]
    }
  }
}
\`\`\`
`;
  }
}

/**
 * Format a single MCP server info with mandatory usage instructions
 */
function formatSingleMcpServer(mcpServer: McpServer, provider: string): McpServer & { formattedInstructions: string } {
  const usageDesc = (mcpServer as McpServer & { usageDescription?: string }).usageDescription || '';
  const providerSetupInstructions = getProviderMcpSetupInstructions(provider, mcpServer.mcpId || mcpServer.name);

  const formattedInstructions = `
=== MCP SERVER INTEGRATION ===
Server: ${mcpServer.name} by ${mcpServer.author}
Description: ${mcpServer.description}
GitHub: ${mcpServer.githubUrl}

${usageDesc ? `=== USER'S INTENDED USAGE ===\n${usageDesc}\n` : ''}
=== CRITICAL INSTRUCTIONS ===
**YOU MUST** use this MCP server exactly as described by the user above.
${usageDesc ? `The user has specified their intent - follow it precisely.` : ''}

**IF THE MCP SERVER IS NOT AVAILABLE OR NOT CONFIGURED:**
You **MUST** install and configure it NOW. DO NOT skip to the next node.
DO NOT proceed with the task until the MCP server is working.

${providerSetupInstructions}

${mcpServer.requiresApiKey ? `**NOTE:** This MCP server requires an API key. Ensure the API key is configured before use.\n` : ''}
=== README / Installation Guide ===
${mcpServer.readmeContent ? mcpServer.readmeContent.substring(0, 3000) : 'Refer to the GitHub repository for setup instructions: ' + mcpServer.githubUrl}
${'='.repeat(50)}
`.trim();

  return {
    ...mcpServer,
    formattedInstructions,
  };
}

/**
 * Format MCP servers array with mandatory usage instructions
 */
function formatMcpServersWithInstructions(mcpServers: McpServer[] | undefined, provider?: string): (McpServer & { formattedInstructions?: string })[] | undefined {
  if (!mcpServers || mcpServers.length === 0) return undefined;

  const agentProvider = provider || 'unknown';
  return mcpServers.map(mcpServer => formatSingleMcpServer(mcpServer, agentProvider));
}

/**
 * Handle streaming plan chunks from the AI agent
 */
export function handleStreamPlanChunk(
  xmlChunk: string,
  workspacePath?: string,
  agentType?: string
): { success: boolean; message: string; projectId?: string; expected_project_id?: string } {
  // Determine project context
  const effectivePath = workspacePath || process.cwd();
  const projectId = workspacePath ? generateProjectId(effectivePath) : currentProjectId;
  currentProjectId = projectId;

  // Initialize parser if needed
  if (!currentParsers.has(projectId)) {
    const parser = new StreamingXMLParser((event) => {
      switch (event.type) {
        case 'plan':
          const plan: Plan = {
            id: event.plan.id || `plan_${Date.now()}`,
            title: event.plan.title || 'Untitled Plan',
            agent: event.plan.agent || agentType || 'unknown',
            createdAt: new Date().toISOString(),
            status: 'streaming',
          };

          // Initialize project and start plan
          multiProjectPlanStore.initializeProject({
            projectId,
            workspacePath: effectivePath,
            projectName: path.basename(effectivePath),
            agentType: plan.agent
          });
          multiProjectPlanStore.startPlan(projectId, plan);
          wsManager.broadcastToProject(projectId, { type: 'plan_started', plan, projectId });
          break;

        case 'node':
          multiProjectPlanStore.addNode(projectId, event.node);
          wsManager.broadcastToProject(projectId, { type: 'node_added', node: event.node, projectId });
          break;

        case 'edge':
          multiProjectPlanStore.addEdge(projectId, event.edge);
          wsManager.broadcastToProject(projectId, { type: 'edge_added', edge: event.edge, projectId });
          break;

        case 'complete':
          multiProjectPlanStore.updatePlanStatus(projectId, 'ready');
          wsManager.broadcastToProject(projectId, { type: 'plan_ready', projectId });
          currentParsers.delete(projectId);
          break;

        case 'error':
          console.error('[Overture] XML parse error:', event.error);
          wsManager.broadcastToProject(projectId, { type: 'error', message: event.error.message });
          break;
      }
    });
    currentParsers.set(projectId, parser);
  }

  try {
    const parser = currentParsers.get(projectId)!;
    parser.write(xmlChunk);
    return {
      success: true,
      message: 'Chunk processed',
      projectId,
      expected_project_id: projectId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message, projectId };
  }
}

/**
 * Submit a complete plan XML at once
 */
export function handleSubmitPlan(
  planXml: string,
  workspacePath?: string,
  agentType?: string
): { success: boolean; message: string; projectId?: string; expected_project_id?: string } {
  // Determine project context
  const effectivePath = workspacePath || process.cwd();
  const projectId = workspacePath ? generateProjectId(effectivePath) : 'default';
  currentProjectId = projectId;

  // Clear any existing parser for this project
  currentParsers.delete(projectId);

  console.error('[Overture] submit_plan called, XML length:', planXml.length);
  console.error('[Overture] Project:', projectId, 'Path:', effectivePath);
  console.error('[Overture] Connected clients:', wsManager.getClientCount());

  const parser = new StreamingXMLParser((event) => {
    switch (event.type) {
      case 'plan':
        const plan: Plan = {
          id: event.plan.id || `plan_${Date.now()}`,
          title: event.plan.title || 'Untitled Plan',
          agent: event.plan.agent || agentType || 'unknown',
          createdAt: new Date().toISOString(),
          status: 'streaming',
        };

        // Initialize project and start plan
        const projectContext: ProjectContext = {
          projectId,
          workspacePath: effectivePath,
          projectName: path.basename(effectivePath),
          agentType: plan.agent
        };
        multiProjectPlanStore.initializeProject(projectContext);
        multiProjectPlanStore.startPlan(projectId, plan);

        console.error('[Overture] Broadcasting plan_started:', plan.title, 'to project:', projectId);
        wsManager.broadcastToProject(projectId, { type: 'plan_started', plan, projectId });

        // Also broadcast project registration for UI tab
        wsManager.broadcastAll({
          type: 'project_registered',
          projectId,
          projectName: projectContext.projectName,
          workspacePath: projectContext.workspacePath
        });
        break;

      case 'node':
        console.error('[Overture] Broadcasting node_added:', event.node.id);
        multiProjectPlanStore.addNode(projectId, event.node);
        wsManager.broadcastToProject(projectId, { type: 'node_added', node: event.node, projectId });
        break;

      case 'edge':
        console.error('[Overture] Broadcasting edge_added:', event.edge.id);
        multiProjectPlanStore.addEdge(projectId, event.edge);
        wsManager.broadcastToProject(projectId, { type: 'edge_added', edge: event.edge, projectId });
        break;

      case 'complete':
        console.error('[Overture] Broadcasting plan_ready');
        multiProjectPlanStore.updatePlanStatus(projectId, 'ready');
        wsManager.broadcastToProject(projectId, { type: 'plan_ready', projectId });
        break;

      case 'error':
        console.error('[Overture] XML parse error:', event.error);
        wsManager.broadcastToProject(projectId, { type: 'error', message: event.error.message });
        break;
    }
  });

  try {
    parser.write(planXml);
    parser.close();
    const nodes = multiProjectPlanStore.getNodes(projectId);
    const edges = multiProjectPlanStore.getEdges(projectId);
    console.error('[Overture] Plan parsing complete. Nodes:', nodes.length, 'Edges:', edges.length);
    console.error('[Overture] Project stored with ID:', projectId);
    console.error('[Overture] All projects after submit:', Array.from(multiProjectPlanStore.getAllProjects().map(p => p.projectId)));
    return {
      success: true,
      message: `Plan submitted successfully. IMPORTANT: Use project_id "${projectId}" in ALL subsequent calls (get_approval, update_node_status, etc.)`,
      projectId,
      // Explicit field to make it clear what ID to use
      expected_project_id: projectId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Overture] Plan parsing failed:', message);
    return { success: false, message, projectId };
  }
}

/**
 * Wait for user approval of the plan
 * Returns status: 'approved', 'cancelled', or 'pending'
 * If 'pending', the agent should call this again to continue waiting
 * When approved, includes the first node's information to start execution
 * Each subsequent node's info is returned by update_node_status when the previous node completes
 */
export async function handleGetApproval(projectId?: string): Promise<{
  status: 'approved' | 'cancelled' | 'pending';
  firstNode?: NextNodeInfo;
  message: string;
  projectId?: string;
}> {
  const effectiveProjectId = projectId || currentProjectId;

  console.error(`[Overture] get_approval called for project: ${effectiveProjectId}`);
  console.error(`[Overture] Provided projectId: ${projectId}, currentProjectId: ${currentProjectId}`);
  console.error(`[Overture] All projects in store:`, multiProjectPlanStore.getAllProjects().map(p => p.projectId));
  console.error(`[Overture] Current plan status:`, multiProjectPlanStore.getPlan(effectiveProjectId)?.status);

  // Wait up to 60 seconds before returning 'pending'
  const result = await multiProjectPlanStore.waitForApproval(effectiveProjectId, 60000);

  console.error(`[Overture] waitForApproval returned: ${result}`);

  if (result === 'approved') {
    multiProjectPlanStore.updatePlanStatus(effectiveProjectId, 'executing');

    // Find the first node (node with no incoming edges)
    const plan = multiProjectPlanStore.getPlan(effectiveProjectId);
    const provider = plan?.agent || 'unknown';
    const nodes = multiProjectPlanStore.getNodes(effectiveProjectId);
    const edges = multiProjectPlanStore.getEdges(effectiveProjectId);
    const nodeConfigs = multiProjectPlanStore.getNodeConfigs(effectiveProjectId);

    const nodesWithIncomingEdges = new Set(edges.map(e => e.to));
    const firstNode = nodes.find(n => !nodesWithIncomingEdges.has(n.id));

    let firstNodeInfo: NextNodeInfo | undefined;
    if (firstNode) {
      const config = nodeConfigs[firstNode.id] || { fieldValues: {}, attachments: [] };
      firstNodeInfo = {
        id: firstNode.id,
        title: firstNode.title,
        type: firstNode.type,
        description: firstNode.description,
        fieldValues: config.fieldValues || {},
        attachments: config.attachments || [],
        metaInstructions: config.metaInstructions,
        mcpServers: formatMcpServersWithInstructions(config.mcpServers, provider),
      };
    }

    return {
      status: 'approved',
      firstNode: firstNodeInfo,
      message: 'Plan approved by user. Execute firstNode, then call update_node_status to get the next node.',
      projectId: effectiveProjectId,
    };
  }

  if (result === 'cancelled') {
    return {
      status: 'cancelled',
      message: 'Plan cancelled by user',
      projectId: effectiveProjectId,
    };
  }

  // Pending - user hasn't approved yet, agent should call again
  return {
    status: 'pending',
    message: 'Waiting for user approval. Call get_approval again to continue waiting.',
    projectId: effectiveProjectId,
  };
}

/**
 * Check if execution is paused, and optionally wait for resume
 */
export async function handleCheckPause(
  wait: boolean = false,
  projectId?: string
): Promise<{
  isPaused: boolean;
  wasResumed: boolean;
  message: string;
  projectId?: string;
}> {
  const effectiveProjectId = projectId || currentProjectId;
  const isPaused = multiProjectPlanStore.getIsPaused(effectiveProjectId);

  if (!isPaused) {
    return {
      isPaused: false,
      wasResumed: false,
      message: 'Execution is not paused',
      projectId: effectiveProjectId,
    };
  }

  if (!wait) {
    return {
      isPaused: true,
      wasResumed: false,
      message: 'Execution is paused. Call with wait=true to block until resumed.',
      projectId: effectiveProjectId,
    };
  }

  // Wait for resume
  await multiProjectPlanStore.waitIfPaused(effectiveProjectId);

  return {
    isPaused: false,
    wasResumed: true,
    message: 'Execution was paused and has now been resumed',
    projectId: effectiveProjectId,
  };
}

/**
 * Update the status of a node during execution
 * When status is 'active', returns full node details including user inputs
 * When status is 'completed', returns the next node's information including user inputs
 * Also returns isPaused if the user has paused execution
 */
export function handleUpdateNodeStatus(
  nodeId: string,
  status: NodeStatus,
  output?: string,
  projectId?: string
): {
  success: boolean;
  message: string;
  currentNode?: NextNodeInfo;
  nextNode?: NextNodeInfo;
  isLastNode?: boolean;
  isPaused?: boolean;
  projectId?: string;
} {
  const effectiveProjectId = projectId || currentProjectId;
  const plan = multiProjectPlanStore.getPlan(effectiveProjectId);
  const provider = plan?.agent || 'unknown';
  const nodes = multiProjectPlanStore.getNodes(effectiveProjectId);
  const edges = multiProjectPlanStore.getEdges(effectiveProjectId);
  const nodeConfigs = multiProjectPlanStore.getNodeConfigs(effectiveProjectId);
  const node = nodes.find((n) => n.id === nodeId);

  if (!node) {
    return { success: false, message: `Node ${nodeId} not found`, projectId: effectiveProjectId };
  }

  multiProjectPlanStore.updateNodeStatus(effectiveProjectId, nodeId, status, output);
  wsManager.broadcastToProject(effectiveProjectId, { type: 'node_status_updated', nodeId, status, output, projectId: effectiveProjectId });

  // Check if execution is paused
  const isPaused = multiProjectPlanStore.getIsPaused(effectiveProjectId);

  // If status is 'active', return full details about the current node
  if (status === 'active') {
    const config = nodeConfigs[nodeId] || { fieldValues: {}, attachments: [] };
    const currentNodeInfo: NextNodeInfo = {
      id: node.id,
      title: node.title,
      type: node.type,
      description: node.description,
      fieldValues: config.fieldValues || {},
      attachments: config.attachments || [],
      metaInstructions: config.metaInstructions,
      mcpServers: formatMcpServersWithInstructions(config.mcpServers, provider),
    };

    return {
      success: true,
      message: `Node ${nodeId} status updated to ${status}. Execute this node now.`,
      currentNode: currentNodeInfo,
      isPaused,
      projectId: effectiveProjectId,
    };
  }

  // If status is 'completed', find and return the next node's info
  if (status === 'completed') {
    const nextNodeInfo = findNextNode(effectiveProjectId, nodeId, nodes, edges, provider);

    if (nextNodeInfo) {
      return {
        success: true,
        message: `Node ${nodeId} status updated to ${status}`,
        nextNode: nextNodeInfo,
        isPaused,
        projectId: effectiveProjectId,
      };
    } else {
      // No next node - this was the last one
      return {
        success: true,
        message: `Node ${nodeId} status updated to ${status}. This was the last node.`,
        isLastNode: true,
        isPaused,
        projectId: effectiveProjectId,
      };
    }
  }

  return {
    success: true,
    message: `Node ${nodeId} status updated to ${status}`,
    isPaused,
    projectId: effectiveProjectId,
  };
}

/**
 * Find the next executable node based on edges and branch selections
 */
function findNextNode(
  projectId: string,
  currentNodeId: string,
  nodes: ReturnType<typeof multiProjectPlanStore.getNodes>,
  edges: ReturnType<typeof multiProjectPlanStore.getEdges>,
  provider: string
): NextNodeInfo | null {
  const selectedBranches = multiProjectPlanStore.getSelectedBranches(projectId);
  const nodeConfigs = multiProjectPlanStore.getNodeConfigs(projectId);

  // Find edges going out from the current node
  const outgoingEdges = edges.filter(e => e.from === currentNodeId);

  if (outgoingEdges.length === 0) {
    return null;
  }

  // Find the next valid node (considering branch selections)
  for (const edge of outgoingEdges) {
    const nextNode = nodes.find(n => n.id === edge.to);

    if (!nextNode) continue;

    // Check if this node belongs to a branch that wasn't selected
    if (nextNode.branchParent && nextNode.branchId) {
      const selectedBranch = selectedBranches[nextNode.branchParent];
      if (selectedBranch && selectedBranch !== nextNode.branchId) {
        // This node's branch wasn't selected, skip it
        continue;
      }
    }

    // Found a valid next node - get its config
    const config = nodeConfigs[nextNode.id] || { fieldValues: {}, attachments: [] };

    return {
      id: nextNode.id,
      title: nextNode.title,
      type: nextNode.type,
      description: nextNode.description,
      fieldValues: config.fieldValues || {},
      attachments: config.attachments || [],
      metaInstructions: config.metaInstructions,
      mcpServers: formatMcpServersWithInstructions(config.mcpServers, provider),
    };
  }

  // No valid next node found (all branches were skipped)
  // Try to find the next node after the skipped branches
  for (const edge of outgoingEdges) {
    const skippedNode = nodes.find(n => n.id === edge.to);
    if (skippedNode) {
      // Recursively find the next node after this skipped one
      const nextAfterSkipped = findNextNode(projectId, skippedNode.id, nodes, edges, provider);
      if (nextAfterSkipped) {
        return nextAfterSkipped;
      }
    }
  }

  return null;
}

/**
 * Mark the plan as completed
 */
export function handlePlanCompleted(projectId?: string): { success: boolean; message: string; projectId?: string } {
  const effectiveProjectId = projectId || currentProjectId;
  multiProjectPlanStore.updatePlanStatus(effectiveProjectId, 'completed');
  wsManager.broadcastToProject(effectiveProjectId, { type: 'plan_completed', projectId: effectiveProjectId });
  return { success: true, message: 'Plan completed', projectId: effectiveProjectId };
}

/**
 * Mark the plan as failed
 */
export function handlePlanFailed(error: string, projectId?: string): { success: boolean; message: string; projectId?: string } {
  const effectiveProjectId = projectId || currentProjectId;
  multiProjectPlanStore.updatePlanStatus(effectiveProjectId, 'failed');
  wsManager.broadcastToProject(effectiveProjectId, { type: 'plan_failed', error, projectId: effectiveProjectId });
  return { success: true, message: 'Plan failed', projectId: effectiveProjectId };
}

/**
 * Check for pending rerun requests from the user
 * Returns immediately if there's a pending request, otherwise waits up to timeout
 */
export async function handleCheckRerun(
  timeoutMs: number = 5000,
  projectId?: string
): Promise<{
  hasRerun: boolean;
  nodeId?: string;
  mode?: 'single' | 'to-bottom';
  nodeInfo?: NextNodeInfo;
  message: string;
  projectId?: string;
}> {
  const effectiveProjectId = projectId || currentProjectId;
  const rerunRequest = await multiProjectPlanStore.waitForRerun(effectiveProjectId, timeoutMs);

  if (!rerunRequest) {
    return {
      hasRerun: false,
      message: 'No rerun request pending',
      projectId: effectiveProjectId,
    };
  }

  // Reset the nodes that need to be rerun
  const resetNodeIds = multiProjectPlanStore.resetNodesForRerun(effectiveProjectId, rerunRequest.nodeId, rerunRequest.mode);

  // Broadcast node status updates
  for (const nodeId of resetNodeIds) {
    wsManager.broadcastToProject(effectiveProjectId, { type: 'node_status_updated', nodeId, status: 'pending', projectId: effectiveProjectId });
  }

  // Update plan status back to executing
  multiProjectPlanStore.updatePlanStatus(effectiveProjectId, 'executing');
  const plan = multiProjectPlanStore.getPlan(effectiveProjectId);
  const provider = plan?.agent || 'unknown';
  wsManager.broadcastToProject(effectiveProjectId, { type: 'plan_started', plan: plan!, projectId: effectiveProjectId });

  // Get the node info for the rerun start node
  const nodes = multiProjectPlanStore.getNodes(effectiveProjectId);
  const nodeConfigs = multiProjectPlanStore.getNodeConfigs(effectiveProjectId);
  const startNode = nodes.find(n => n.id === rerunRequest.nodeId);

  let nodeInfo: NextNodeInfo | undefined;
  if (startNode) {
    const config = nodeConfigs[startNode.id] || { fieldValues: {}, attachments: [] };
    nodeInfo = {
      id: startNode.id,
      title: startNode.title,
      type: startNode.type,
      description: startNode.description,
      fieldValues: config.fieldValues || {},
      attachments: config.attachments || [],
      metaInstructions: config.metaInstructions,
      mcpServers: formatMcpServersWithInstructions(config.mcpServers, provider),
    };
  }

  return {
    hasRerun: true,
    nodeId: rerunRequest.nodeId,
    mode: rerunRequest.mode,
    nodeInfo,
    message: `Rerun requested from node ${rerunRequest.nodeId} (${rerunRequest.mode})`,
    projectId: effectiveProjectId,
  };
}

/**
 * Get resume information for a paused or failed plan
 * Returns detailed state information to help the agent continue execution
 */
export function handleGetResumeInfo(projectId?: string): {
  success: boolean;
  resumeInfo?: ResumePlanInfo;
  message: string;
  projectId?: string;
} {
  const effectiveProjectId = projectId || currentProjectId;
  const resumeInfo = multiProjectPlanStore.getResumeInfo(effectiveProjectId);

  if (!resumeInfo) {
    return {
      success: false,
      message: `No active plan found for project: ${effectiveProjectId}`,
      projectId: effectiveProjectId,
    };
  }

  return {
    success: true,
    resumeInfo,
    message: `Resume info retrieved. Plan is at status '${resumeInfo.status}'. ${
      resumeInfo.currentNodeId
        ? `Current node: ${resumeInfo.currentNodeTitle} (${resumeInfo.currentNodeStatus})`
        : 'No current node.'
    } Completed: ${resumeInfo.completedNodes.length}, Pending: ${resumeInfo.pendingNodes.length}, Failed: ${resumeInfo.failedNodes.length}`,
    projectId: effectiveProjectId,
  };
}

// Types for plan update operations
export type PlanOperation =
  | { op: 'insert_after'; reference_node_id: string; node: NodeData }
  | { op: 'insert_before'; reference_node_id: string; node: NodeData }
  | { op: 'delete'; node_id: string }
  | { op: 'replace'; node_id: string; node: Partial<NodeData> & { title: string; description: string } };

export interface NodeData {
  id: string;
  type: 'task' | 'decision';
  title: string;
  description: string;
  complexity?: 'low' | 'medium' | 'high';
  expectedOutput?: string;
  risks?: string;
}

/**
 * Update an existing plan with incremental operations
 * Accepts an array of operations (insert_after, insert_before, delete, replace)
 * and applies them in order with smooth animations
 */
export function handleRequestPlanUpdate(
  operations: PlanOperation[],
  projectId?: string
): {
  success: boolean;
  message: string;
  results: Array<{ op: string; success: boolean; message: string }>;
  projectId?: string;
} {
  const effectiveProjectId = projectId || currentProjectId;

  const currentPlan = multiProjectPlanStore.getPlan(effectiveProjectId);
  if (!currentPlan) {
    return {
      success: false,
      message: `No active plan found for project: ${effectiveProjectId}. Submit a new plan instead.`,
      results: [],
      projectId: effectiveProjectId,
    };
  }

  // Store previous state for potential diff view
  multiProjectPlanStore.storePreviousPlanState(effectiveProjectId);

  console.error(`[Overture] Processing ${operations.length} plan update operations for project: ${effectiveProjectId}`);

  const results: Array<{ op: string; success: boolean; message: string }> = [];

  // Process each operation in order
  for (const operation of operations) {
    try {
      switch (operation.op) {
        case 'insert_after':
        case 'insert_before': {
          const position = operation.op === 'insert_after' ? 'after' : 'before';
          const result = applyInsertOperation(
            effectiveProjectId,
            operation.reference_node_id,
            position,
            operation.node
          );
          results.push({ op: operation.op, ...result });
          break;
        }
        case 'delete': {
          const result = applyDeleteOperation(effectiveProjectId, operation.node_id);
          results.push({ op: 'delete', ...result });
          break;
        }
        case 'replace': {
          const result = applyReplaceOperation(effectiveProjectId, operation.node_id, operation.node);
          results.push({ op: 'replace', ...result });
          break;
        }
        default:
          results.push({ op: 'unknown', success: false, message: 'Unknown operation type' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.push({ op: (operation as any).op || 'unknown', success: false, message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  // Broadcast that the plan was updated
  wsManager.broadcastToProject(effectiveProjectId, {
    type: 'plan_updated_incrementally',
    operationCount: operations.length,
    successCount,
    failCount,
    projectId: effectiveProjectId,
  });

  console.error(`[Overture] Plan update complete: ${successCount} succeeded, ${failCount} failed`);

  return {
    success: failCount === 0,
    message: `Applied ${successCount}/${operations.length} operations. ${failCount > 0 ? 'Some operations failed.' : 'All operations succeeded.'} Call get_approval to confirm changes with user.`,
    results,
    projectId: effectiveProjectId,
  };
}

/**
 * Apply an insert operation (insert_after or insert_before)
 */
function applyInsertOperation(
  projectId: string,
  referenceNodeId: string,
  position: 'after' | 'before',
  nodeData: NodeData
): { success: boolean; message: string } {
  const nodes = multiProjectPlanStore.getNodes(projectId);
  const edges = multiProjectPlanStore.getEdges(projectId);

  // Find the reference node
  const refNode = nodes.find(n => n.id === referenceNodeId);
  if (!refNode) {
    return { success: false, message: `Reference node ${referenceNodeId} not found` };
  }

  // Create the new node
  const newNode: PlanNode = {
    id: nodeData.id,
    type: nodeData.type,
    title: nodeData.title,
    description: nodeData.description,
    complexity: nodeData.complexity,
    expectedOutput: nodeData.expectedOutput,
    risks: nodeData.risks,
    status: 'pending',
    dynamicFields: [],
    attachments: [],
  };

  if (position === 'after') {
    // Insert node between reference and its targets
    const edgeToNewNode: PlanEdge = { id: `e_${referenceNodeId}_${nodeData.id}`, from: referenceNodeId, to: nodeData.id };
    const result = multiProjectPlanStore.insertNodes(
      projectId,
      referenceNodeId,
      [newNode],
      [edgeToNewNode]
    );

    // Broadcast the change - include BOTH the edge to the new node AND reconnection edges
    const allNewEdges = [edgeToNewNode, ...result.reconnectionEdges];
    wsManager.broadcastToProject(projectId, {
      type: 'nodes_inserted',
      nodes: [newNode],
      edges: allNewEdges,
      removedEdgeIds: result.removedEdgeIds,
      projectId,
    });
  } else {
    // Insert before: find edges coming into reference node
    const incomingEdges = edges.filter(e => e.to === referenceNodeId);

    if (incomingEdges.length === 0) {
      // Reference node is a root node - just add the new node before it
      multiProjectPlanStore.addNode(projectId, newNode);
      const newEdge: PlanEdge = { id: `e_${nodeData.id}_${referenceNodeId}`, from: nodeData.id, to: referenceNodeId };
      multiProjectPlanStore.addEdge(projectId, newEdge);

      wsManager.broadcastToProject(projectId, { type: 'node_added', node: newNode, projectId });
      wsManager.broadcastToProject(projectId, { type: 'edge_added', edge: newEdge, projectId });
    } else {
      // Insert between the incoming node(s) and reference node
      const firstIncoming = incomingEdges[0];

      // Add new node
      multiProjectPlanStore.addNode(projectId, newNode);
      wsManager.broadcastToProject(projectId, { type: 'node_added', node: newNode, projectId });

      // Rewire edges: incoming -> newNode -> reference
      for (const edge of incomingEdges) {
        const state = multiProjectPlanStore.getState(projectId);
        if (state) {
          const edgeIndex = state.edges.findIndex(e => e.id === edge.id);
          if (edgeIndex >= 0) {
            state.edges.splice(edgeIndex, 1);
          }
        }
      }

      // Add new edges
      const edgeToNew: PlanEdge = { id: `e_${firstIncoming.from}_${nodeData.id}`, from: firstIncoming.from, to: nodeData.id };
      const edgeToRef: PlanEdge = { id: `e_${nodeData.id}_${referenceNodeId}`, from: nodeData.id, to: referenceNodeId };
      multiProjectPlanStore.addEdge(projectId, edgeToNew);
      multiProjectPlanStore.addEdge(projectId, edgeToRef);

      wsManager.broadcastToProject(projectId, { type: 'edge_added', edge: edgeToNew, projectId });
      wsManager.broadcastToProject(projectId, { type: 'edge_added', edge: edgeToRef, projectId });
    }
  }

  console.error(`[Overture] Node ${nodeData.id} inserted ${position} ${referenceNodeId}`);
  return { success: true, message: `Node "${nodeData.title}" inserted ${position} node ${referenceNodeId}` };
}

/**
 * Apply a delete operation
 */
function applyDeleteOperation(
  projectId: string,
  nodeId: string
): { success: boolean; message: string } {
  const nodes = multiProjectPlanStore.getNodes(projectId);
  const node = nodes.find(n => n.id === nodeId);

  if (!node) {
    return { success: false, message: `Node ${nodeId} not found` };
  }

  // Remove the node (edges are automatically reconnected)
  const result = multiProjectPlanStore.removeNode(projectId, nodeId);

  // Broadcast the change
  wsManager.broadcastToProject(projectId, {
    type: 'node_removed',
    nodeId,
    newEdges: result.newEdges,
    removedEdgeIds: result.removedEdgeIds,
    projectId,
  });

  console.error(`[Overture] Node ${nodeId} deleted from plan`);
  return { success: true, message: `Node "${node.title}" deleted from plan` };
}

/**
 * Apply a replace operation
 */
function applyReplaceOperation(
  projectId: string,
  nodeId: string,
  newNodeData: Partial<NodeData> & { title: string; description: string }
): { success: boolean; message: string } {
  const state = multiProjectPlanStore.getState(projectId);

  if (!state) {
    return { success: false, message: `No plan found for project ${projectId}` };
  }

  const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
  if (nodeIndex < 0) {
    return { success: false, message: `Node ${nodeId} not found` };
  }

  const oldNode = state.nodes[nodeIndex];

  // Update the node in place
  const updatedNode: PlanNode = {
    ...oldNode,
    id: newNodeData.id || oldNode.id,
    type: newNodeData.type || oldNode.type,
    title: newNodeData.title,
    description: newNodeData.description,
    complexity: newNodeData.complexity || oldNode.complexity,
    expectedOutput: newNodeData.expectedOutput || oldNode.expectedOutput,
    risks: newNodeData.risks || oldNode.risks,
  };

  state.nodes[nodeIndex] = updatedNode;

  // If the ID changed, update all edges
  if (newNodeData.id && newNodeData.id !== oldNode.id) {
    for (const edge of state.edges) {
      if (edge.from === oldNode.id) {
        edge.from = newNodeData.id;
      }
      if (edge.to === oldNode.id) {
        edge.to = newNodeData.id;
      }
    }
  }

  // Broadcast the node replacement
  wsManager.broadcastToProject(projectId, {
    type: 'node_replaced',
    oldNodeId: nodeId,
    node: updatedNode,
    projectId,
  });

  console.error(`[Overture] Node ${nodeId} replaced with new content`);
  return { success: true, message: `Node "${oldNode.title}" replaced with "${updatedNode.title}"` };
}

/**
 * Signal that a new, unrelated plan is being created
 * Call this BEFORE submitting a new plan
 * NOTE: This does NOT clear existing plans - new plans are added alongside existing ones (Figma-style)
 */
export function handleCreateNewPlan(projectId?: string): {
  success: boolean;
  message: string;
  projectId?: string;
} {
  const effectiveProjectId = projectId || currentProjectId;

  // IMPORTANT: Do NOT clear existing plans!
  // New plans are added alongside existing ones (Figma-style artboards)
  // The frontend handles displaying multiple plans on the same canvas

  // Notify UI that a new plan is coming (but keep existing plans)
  wsManager.broadcastToProject(effectiveProjectId, {
    type: 'new_plan_created',
    planId: '',
    projectId: effectiveProjectId,
  });

  console.error(`[Overture] New plan requested for project: ${effectiveProjectId}`);
  console.error(`[Overture] Existing plans preserved. New plan will be added alongside them.`);

  return {
    success: true,
    message: `Ready to receive new plan. Submit the new plan using submit_plan or stream_plan_chunk, then call get_approval to wait for user approval. Note: Existing plans will be preserved on the canvas.`,
    projectId: effectiveProjectId,
  };
}

/**
 * Get usage instructions for a specific agent type.
 * Returns the appropriate documentation markdown for the agent.
 */
export async function handleGetUsageInstructions(agentType: string): Promise<{
  success: boolean;
  agentType: string;
  instructions?: string;
  message: string;
  availableAgents: string[];
}> {
  const availableAgents = ['claude-code', 'cline', 'cursor', 'sixth', 'gh_copilot'];

  // Normalize agent type
  const normalizedType = agentType.toLowerCase().trim();

  // Map common aliases
  const agentMap: Record<string, string> = {
    'claude-code': 'claude-code',
    'claude': 'claude-code',
    'claudecode': 'claude-code',
    'cline': 'cline',
    'cursor': 'cursor',
    'sixth': 'sixth',
    '6th': 'sixth',
    'gh_copilot': 'gh_copilot',
    'gh-copilot': 'gh_copilot',
    'github-copilot': 'gh_copilot',
    'github_copilot': 'gh_copilot',
    'copilot': 'gh_copilot',
    'ghcopilot': 'gh_copilot',
  };

  const mappedType = agentMap[normalizedType];

  if (!mappedType) {
    return {
      success: false,
      agentType: normalizedType,
      message: `Unknown agent type "${agentType}". Available agents: ${availableAgents.join(', ')}`,
      availableAgents,
    };
  }

  // Find the prompts directory
  // Try multiple possible locations since the package might be installed differently
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Possible prompt locations:
  // 1. npm installed: node_modules/overture-mcp/prompts (from dist/tools -> ../../prompts)
  // 2. Development: packages/mcp-server/dist/tools/ -> ../../../../prompts
  // 3. Development (src): packages/mcp-server/src/tools/ -> ../../../../prompts
  const possiblePaths = [
    path.resolve(__dirname, '../../prompts'),        // npm installed (dist/tools -> prompts)
    path.resolve(__dirname, '../prompts'),           // Alternative npm location
    path.resolve(__dirname, '../../../../prompts'),  // Development (monorepo root)
    path.resolve(__dirname, '../../../prompts'),     // Alternative dev location
    path.resolve(process.cwd(), 'prompts'),          // Relative to cwd
  ];

  let promptFile: string | null = null;
  let instructions: string | null = null;

  for (const promptsDir of possiblePaths) {
    const candidatePath = path.join(promptsDir, `${mappedType}.md`);
    try {
      instructions = await fs.readFile(candidatePath, 'utf-8');
      promptFile = candidatePath;
      console.error(`[Overture] Found instructions at: ${candidatePath}`);
      break;
    } catch {
      // Try next path
      continue;
    }
  }

  if (instructions && promptFile) {
    console.error(`[Overture] Loaded instructions for ${mappedType} (${instructions.length} chars)`);

    return {
      success: true,
      agentType: mappedType,
      instructions,
      message: `Instructions loaded for ${mappedType}. Follow these instructions to use Overture MCP effectively.`,
      availableAgents,
    };
  }

  // If we get here, couldn't find the file
  console.error(`[Overture] Failed to find instructions for ${mappedType}. Searched paths:`);
  possiblePaths.forEach(p => console.error(`  - ${path.join(p, `${mappedType}.md`)}`));

  return {
    success: false,
    agentType: mappedType,
    message: `Failed to load instructions for ${mappedType}. Instructions file not found.`,
    availableAgents,
  };
}

