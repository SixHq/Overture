import { WebSocketServer, WebSocket } from 'ws';
import { WSMessage, WSClientMessage, ProjectContext, HistoryEntry, PlanDiff } from '../types.js';
import { planStore, multiProjectPlanStore } from '../store/plan-store.js';
import { historyStorage } from '../storage/history-storage.js';
import { calculatePlanDiff } from '../utils/plan-diff.js';

/**
 * Tracks a connected client and their project subscription
 */
interface ProjectClient {
  ws: WebSocket;
  projectId: string | null;
  projectName: string | null;
  workspacePath: string | null;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ProjectClient> = new Map();
  private relayClient: WebSocket | null = null;
  private port: number = 3030;

  start(port: number): void {
    this.port = port;

    try {
      this.wss = new WebSocketServer({ port });
    } catch (err) {
      console.error(`[Overture] WebSocket server failed to start on port ${port}, will try relay mode`);
      this.connectAsRelay(port);
      return;
    }

    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Overture] WebSocket port ${port} already in use - connecting as relay client`);
        this.wss = null;
        this.connectAsRelay(port);
      } else {
        console.error(`[Overture] WebSocket server error:`, err);
      }
    });

    console.error(`[Overture] WebSocket server listening on ws://localhost:${port}`);

    this.wss.on('connection', (ws) => {
      console.error('[Overture] Client connected');

      // Initialize client with no project subscription
      this.clients.set(ws, {
        ws,
        projectId: null,
        projectName: null,
        workspacePath: null
      });

      // Send connection confirmation
      this.send(ws, { type: 'connected' });

      // Send list of active projects
      const projects = multiProjectPlanStore.getAllProjects();
      if (projects.length > 0) {
        this.send(ws, { type: 'projects_list', projects });
      }

      // Legacy: Send current state if plan exists (for backwards compatibility)
      const plan = planStore.getPlan();
      if (plan) {
        this.send(ws, { type: 'plan_started', plan });

        // Send all existing nodes
        for (const node of planStore.getNodes()) {
          this.send(ws, { type: 'node_added', node });
        }

        // Send all existing edges
        for (const edge of planStore.getEdges()) {
          this.send(ws, { type: 'edge_added', edge });
        }

        // Send ready status if applicable
        if (plan.status === 'ready') {
          this.send(ws, { type: 'plan_ready' });
        }
      }

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Handle relay messages from other MCP server instances
          if (message.type === 'relay' && message.payload) {
            const payload = message.payload;
            console.error('[Overture] Relaying message:', payload.type);

            // CRITICAL: Sync local state from relay messages
            // This ensures the main server can handle approve_plan from UI
            // Wrapped in try-catch to ensure broadcast always happens
            try {
              this.syncStateFromRelay(payload);
            } catch (err) {
              console.error('[Overture] Error syncing state from relay:', err);
            }

            // Broadcast the relayed message to all UI clients
            const relayData = JSON.stringify(payload);
            for (const [clientWs] of this.clients) {
              if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(relayData);
              }
            }
            return;
          }

          this.handleClientMessage(ws, message as WSClientMessage);
        } catch (error) {
          console.error('[Overture] Failed to parse client message:', error);
        }
      });

      ws.on('close', () => {
        console.error('[Overture] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[Overture] WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  private async handleClientMessage(ws: WebSocket, message: WSClientMessage): Promise<void> {
    // Extract projectId from message or use default
    const projectId = ('projectId' in message && message.projectId) ? message.projectId : 'default';

    switch (message.type) {
      case 'register_project': {
        const { projectContext } = message;
        console.error(`[Overture] Project registered: ${projectContext.projectName} (${projectContext.projectId})`);

        // Initialize project in store
        multiProjectPlanStore.initializeProject(projectContext);

        // Update client subscription
        const client = this.clients.get(ws);
        if (client) {
          client.projectId = projectContext.projectId;
          client.projectName = projectContext.projectName;
          client.workspacePath = projectContext.workspacePath;
        }

        // Notify all clients about new project
        this.broadcastAll({
          type: 'project_registered',
          projectId: projectContext.projectId,
          projectName: projectContext.projectName,
          workspacePath: projectContext.workspacePath
        });

        // Send updated projects list to all clients
        const projects = multiProjectPlanStore.getAllProjects();
        this.broadcastAll({ type: 'projects_list', projects });
        break;
      }

      case 'subscribe_project': {
        console.error(`[Overture] Client subscribed to project: ${message.projectId}`);
        const client = this.clients.get(ws);
        if (client) {
          client.projectId = message.projectId;

          // Send current project state
          const state = multiProjectPlanStore.getState(message.projectId);
          if (state?.plan) {
            this.send(ws, { type: 'plan_started', plan: state.plan, projectId: message.projectId });

            for (const node of state.nodes) {
              this.send(ws, { type: 'node_added', node, projectId: message.projectId });
            }

            for (const edge of state.edges) {
              this.send(ws, { type: 'edge_added', edge, projectId: message.projectId });
            }

            if (state.plan.status === 'ready') {
              this.send(ws, { type: 'plan_ready', projectId: message.projectId });
            }
          }
        }
        break;
      }

      case 'unsubscribe_project': {
        console.error(`[Overture] Client unsubscribed from project: ${message.projectId}`);
        const client = this.clients.get(ws);
        if (client && client.projectId === message.projectId) {
          client.projectId = null;
        }
        break;
      }

      case 'get_history': {
        console.error('[Overture] History requested');
        let entries: HistoryEntry[];

        if (message.projectId) {
          entries = await historyStorage.getEntriesByProject(message.projectId);
        } else {
          entries = await historyStorage.getAllEntries();
        }

        this.send(ws, { type: 'history_entries', entries });
        break;
      }

      case 'load_plan': {
        console.error(`[Overture] Loading plan from history: ${message.planId}`);
        const state = await multiProjectPlanStore.loadFromHistory(message.planId);

        if (state?.plan) {
          // Subscribe client to this project
          const client = this.clients.get(ws);
          if (client) {
            client.projectId = state.projectId;
          }

          // Send loaded plan data
          this.send(ws, {
            type: 'plan_loaded',
            plan: {
              plan: {
                ...state.plan,
                projectId: state.projectId,
                workspacePath: state.workspacePath || ''
              },
              nodes: state.nodes,
              edges: state.edges,
              fieldValues: state.fieldValues,
              selectedBranches: state.selectedBranches,
              nodeConfigs: state.nodeConfigs
            },
            projectId: state.projectId
          });
        } else {
          this.send(ws, { type: 'error', message: `Plan not found: ${message.planId}` });
        }
        break;
      }

      case 'get_resume_info': {
        console.error(`[Overture] Resume info requested for project: ${message.projectId || projectId}`);
        const effectiveProjectId = message.projectId || projectId;

        // If planId is provided, load from history first
        if (message.planId) {
          const state = await multiProjectPlanStore.loadFromHistory(message.planId);
          if (state) {
            const resumeInfo = multiProjectPlanStore.getResumeInfo(state.projectId);
            if (resumeInfo) {
              this.send(ws, { type: 'resume_plan_info', resumeInfo });
            } else {
              this.send(ws, { type: 'error', message: `No resume info available for plan: ${message.planId}` });
            }
          } else {
            this.send(ws, { type: 'error', message: `Plan not found: ${message.planId}` });
          }
        } else {
          // Get resume info for active project
          const resumeInfo = multiProjectPlanStore.getResumeInfo(effectiveProjectId);
          if (resumeInfo) {
            this.send(ws, { type: 'resume_plan_info', resumeInfo });
          } else {
            this.send(ws, { type: 'error', message: `No active plan for project: ${effectiveProjectId}` });
          }
        }
        break;
      }

      case 'save_plan': {
        const effectiveProjectId = message.projectId || projectId;
        console.error(`[Overture] Save plan requested for project: ${effectiveProjectId}`);
        console.error(`[Overture] Message projectId: ${message.projectId}, Default projectId: ${projectId}`);

        const result = await multiProjectPlanStore.forcePersist(effectiveProjectId);
        if (result.success && result.planId) {
          this.send(ws, { type: 'plan_saved', projectId: effectiveProjectId, planId: result.planId });
        } else {
          this.send(ws, { type: 'error', message: `No active plan to save for project: ${effectiveProjectId}` });
        }
        break;
      }

      case 'approve_plan': {
        // Use projectId from message - frontend sends activeTabId which is the correct projectId
        const effectiveProjectId = message.projectId || projectId;

        console.error(`[Overture] Plan approved by user (project: ${effectiveProjectId})`);
        console.error(`[Overture] Message projectId: ${message.projectId}, Default projectId: ${projectId}`);
        console.error(`[Overture] Field values:`, Object.keys(message.fieldValues || {}).length);
        console.error(`[Overture] Node configs:`, Object.keys(message.nodeConfigs || {}).length);

        // Check if project exists
        const existingProject = multiProjectPlanStore.getProjectState(effectiveProjectId);
        console.error(`[Overture] Project exists in store: ${!!existingProject}`);
        if (existingProject) {
          console.error(`[Overture] Project plan status: ${existingProject.plan?.status}`);
          console.error(`[Overture] Project nodes: ${existingProject.nodes.length}`);
        }

        // Resolve local approval promise
        await multiProjectPlanStore.setApproval(
          effectiveProjectId,
          message.fieldValues,
          message.selectedBranches,
          message.nodeConfigs || {}
        );

        // CRITICAL: Broadcast to ALL clients (including relay clients)
        // so the MCP instance that submitted the plan can resolve its promise
        this.broadcastAll({
          type: 'approval_granted',
          projectId: effectiveProjectId,
          fieldValues: message.fieldValues,
          selectedBranches: message.selectedBranches,
          nodeConfigs: message.nodeConfigs || {}
        });
        break;
      }

      case 'cancel_plan':
        console.error(`[Overture] Plan cancelled by user (project: ${projectId})`);
        multiProjectPlanStore.cancelApproval(projectId);
        break;

      case 'rerun_request':
        console.error(`[Overture] Rerun requested: node=${message.nodeId}, mode=${message.mode} (project: ${projectId})`);
        multiProjectPlanStore.setRerunRequest(projectId, message.nodeId, message.mode);
        break;

      case 'pause_execution':
        console.error(`[Overture] Execution paused by user (project: ${projectId})`);
        multiProjectPlanStore.pause(projectId);
        this.broadcastToProject(projectId, { type: 'plan_paused', projectId });
        break;

      case 'resume_execution':
        console.error(`[Overture] Execution resumed by user (project: ${projectId})`);
        multiProjectPlanStore.resume(projectId);
        this.broadcastToProject(projectId, { type: 'plan_resumed', projectId });
        break;

      case 'insert_nodes': {
        console.error(`[Overture] Inserting ${message.nodes.length} node(s) after ${message.afterNodeId} (project: ${projectId})`);
        const insertResult = multiProjectPlanStore.insertNodes(projectId, message.afterNodeId, message.nodes, message.edges);
        // Include both the new edges AND the reconnection edges
        const allEdges = [...message.edges, ...insertResult.reconnectionEdges];
        this.broadcastToProject(projectId, {
          type: 'nodes_inserted',
          nodes: message.nodes,
          edges: allEdges,
          removedEdgeIds: insertResult.removedEdgeIds,
          projectId
        });
        break;
      }

      case 'remove_node': {
        console.error(`[Overture] Removing node ${message.nodeId} (project: ${projectId})`);
        const removeResult = multiProjectPlanStore.removeNode(projectId, message.nodeId);
        this.broadcastToProject(projectId, {
          type: 'node_removed',
          nodeId: message.nodeId,
          newEdges: removeResult.newEdges,
          removedEdgeIds: removeResult.removedEdgeIds,
          projectId
        });
        break;
      }

      case 'request_plan_update': {
        const effectiveProjectId = message.projectId || projectId;
        console.error(`[Overture] Plan update requested for project: ${effectiveProjectId}`);

        // Store the current plan state before the update arrives
        const currentState = multiProjectPlanStore.getState(effectiveProjectId);
        if (currentState?.plan) {
          // Save current state as "previous" for diff comparison
          multiProjectPlanStore.storePreviousPlanState(effectiveProjectId);

          // Reset the plan status to allow receiving a new plan
          // The agent should call submit_plan or stream_plan_chunk with updated XML
          // After the new plan is received, we'll calculate and broadcast the diff
          console.error(`[Overture] Stored previous plan state, waiting for updated plan`);
        } else {
          this.send(ws, { type: 'error', message: `No active plan for project: ${effectiveProjectId}` });
        }
        break;
      }

      case 'create_new_plan': {
        const effectiveProjectId = message.projectId || projectId;
        console.error(`[Overture] New plan requested for project: ${effectiveProjectId}`);

        // IMPORTANT: Do NOT clear existing plans!
        // New plans are added alongside existing ones (Figma-style artboards)
        // The frontend handles displaying multiple plans on the same canvas

        // Notify clients that a new plan will be created
        this.broadcastToProject(effectiveProjectId, {
          type: 'new_plan_created',
          planId: '', // Will be set when the new plan arrives
          projectId: effectiveProjectId
        });
        break;
      }
    }
  }

  /**
   * Sync local state when receiving relay messages from another MCP instance.
   * This ensures the main server has the project state needed to handle approve_plan.
   */
  private syncStateFromRelay(payload: WSMessage): void {
    const projectId = ('projectId' in payload && payload.projectId) ? payload.projectId as string : 'default';

    switch (payload.type) {
      case 'project_registered': {
        const msg = payload as { type: 'project_registered'; projectId: string; projectName: string; workspacePath: string };
        console.error(`[Overture] Syncing project_registered: ${msg.projectId}`);
        multiProjectPlanStore.initializeProject({
          projectId: msg.projectId,
          projectName: msg.projectName,
          workspacePath: msg.workspacePath,
          agentType: 'unknown'
        });
        break;
      }

      case 'plan_started': {
        const msg = payload as { type: 'plan_started'; plan: any; projectId?: string };
        console.error(`[Overture] Syncing plan_started: ${msg.plan?.id} for project ${projectId}`);
        if (msg.plan) {
          multiProjectPlanStore.startPlan(projectId, msg.plan);
        }
        break;
      }

      case 'node_added': {
        const msg = payload as { type: 'node_added'; node: any; projectId?: string };
        console.error(`[Overture] Syncing node_added: ${msg.node?.id} for project ${projectId}`);
        if (msg.node) {
          multiProjectPlanStore.addNode(projectId, msg.node);
        }
        break;
      }

      case 'edge_added': {
        const msg = payload as { type: 'edge_added'; edge: any; projectId?: string };
        if (msg.edge) {
          multiProjectPlanStore.addEdge(projectId, msg.edge);
        }
        break;
      }

      case 'plan_ready': {
        console.error(`[Overture] Syncing plan_ready for project ${projectId}`);
        multiProjectPlanStore.updatePlanStatus(projectId, 'ready');
        break;
      }

      case 'node_status_updated': {
        const msg = payload as { type: 'node_status_updated'; nodeId: string; status: any; output?: string; projectId?: string };
        multiProjectPlanStore.updateNodeStatus(projectId, msg.nodeId, msg.status, msg.output);
        break;
      }

      // Other message types don't need state sync
      default:
        break;
    }
  }

  private connectAsRelay(port: number): void {
    try {
      this.relayClient = new WebSocket(`ws://localhost:${port}`);

      this.relayClient.on('open', () => {
        console.error('[Overture] Connected as relay client to existing server');
      });

      // Handle messages from main server (including approval_granted)
      this.relayClient.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.error('[Overture] Relay client received:', message.type);

          // Handle approval_granted - resolve local approval promise
          if (message.type === 'approval_granted') {
            console.error('[Overture] Relay client: Resolving approval for project:', message.projectId);
            multiProjectPlanStore.setApproval(
              message.projectId,
              message.fieldValues || {},
              message.selectedBranches || {},
              message.nodeConfigs || {}
            );
          }
        } catch (err) {
          console.error('[Overture] Relay client: Failed to parse message:', err);
        }
      });

      this.relayClient.on('error', (err) => {
        console.error('[Overture] Relay client error:', err.message);
        this.relayClient = null;
      });

      this.relayClient.on('close', () => {
        console.error('[Overture] Relay client disconnected');
        this.relayClient = null;
      });
    } catch (err) {
      console.error('[Overture] Failed to connect as relay:', err);
    }
  }

  /**
   * Broadcast message to all clients subscribed to a specific project
   */
  broadcastToProject(projectId: string, message: WSMessage): void {
    const data = JSON.stringify(message);

    // If we're in relay mode, send to the main server
    if (this.relayClient && this.relayClient.readyState === WebSocket.OPEN) {
      this.relayClient.send(JSON.stringify({ type: 'relay', payload: message }));
      return;
    }

    // Broadcast to clients subscribed to this project
    for (const [clientWs, client] of this.clients) {
      if (clientWs.readyState === WebSocket.OPEN) {
        // Send to clients subscribed to this project OR clients with no subscription (legacy)
        if (client.projectId === projectId || client.projectId === null) {
          clientWs.send(data);
        }
      }
    }
  }

  /**
   * Broadcast message to ALL connected clients (for global events)
   */
  broadcastAll(message: WSMessage): void {
    const data = JSON.stringify(message);

    // If we're in relay mode, send to the main server
    if (this.relayClient && this.relayClient.readyState === WebSocket.OPEN) {
      this.relayClient.send(JSON.stringify({ type: 'relay', payload: message }));
      return;
    }

    // Broadcast to all clients
    for (const [clientWs] of this.clients) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    }
  }

  /**
   * Legacy broadcast - broadcasts to all clients (backwards compatibility)
   */
  broadcast(message: WSMessage): void {
    // Extract projectId from message if present
    const projectId = ('projectId' in message && message.projectId)
      ? (message.projectId as string)
      : null;

    if (projectId) {
      this.broadcastToProject(projectId, message);
    } else {
      this.broadcastAll(message);
    }
  }

  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get all active projects from connected clients
   */
  getActiveProjects(): ProjectContext[] {
    return multiProjectPlanStore.getAllProjects();
  }

  /**
   * Get clients subscribed to a specific project
   */
  getProjectClients(projectId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.projectId === projectId) {
        count++;
      }
    }
    return count;
  }

  stop(): void {
    if (this.wss) {
      for (const [clientWs] of this.clients) {
        clientWs.close();
      }
      this.wss.close();
      this.wss = null;
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
