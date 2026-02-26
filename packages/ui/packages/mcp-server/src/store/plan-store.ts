import {
  Plan,
  PlanNode,
  PlanEdge,
  PlanState,
  NodeStatus,
  NodeConfig,
  ProjectContext,
  ProjectPlanState,
  PlanWithProject,
  PersistedPlan,
  ResumePlanInfo,
  PlanDiff
} from '../types.js';
import { historyStorage } from '../storage/history-storage.js';
import { calculatePlanDiff } from '../utils/plan-diff.js';
import path from 'path';

interface RerunRequest {
  nodeId: string;
  mode: 'single' | 'to-bottom';
  timestamp: number;
}

/**
 * Default project ID used for backwards compatibility
 */
const DEFAULT_PROJECT_ID = 'default';

/**
 * Multi-project plan store that manages plans for multiple projects simultaneously.
 * Each project can have multiple plans running.
 */
class MultiProjectPlanStore {
  private projects: Map<string, ProjectPlanState> = new Map();

  // Per-project control state
  private approvalResolvers: Map<string, (value: boolean) => void> = new Map();
  private approvalPromises: Map<string, Promise<boolean>> = new Map();
  private pendingRerunRequests: Map<string, RerunRequest> = new Map();
  private rerunResolvers: Map<string, (value: RerunRequest) => void> = new Map();
  private rerunPromises: Map<string, Promise<RerunRequest>> = new Map();
  private pauseStates: Map<string, boolean> = new Map();
  private pauseResolvers: Map<string, () => void> = new Map();
  private pausePromises: Map<string, Promise<void>> = new Map();

  // Store previous plan state for diff calculation
  private previousPlanStates: Map<string, { nodes: PlanNode[]; edges: PlanEdge[] }> = new Map();

  // Auto-save interval
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start auto-save every 3 seconds
    this.startAutoSave();
  }

  /**
   * Start auto-save interval to persist all active projects every 3 seconds
   */
  private startAutoSave(): void {
    console.error('[Overture] Starting auto-save interval (every 3 seconds)');
    this.autoSaveInterval = setInterval(async () => {
      const activeProjects = Array.from(this.projects.entries()).filter(([, state]) => state.plan);
      if (activeProjects.length > 0) {
        console.error(`[Overture] Auto-saving ${activeProjects.length} active project(s)...`);
        for (const [projectId, state] of activeProjects) {
          try {
            const persisted: PersistedPlan = {
              plan: state.plan as PlanWithProject,
              nodes: state.nodes,
              edges: state.edges,
              fieldValues: state.fieldValues,
              selectedBranches: state.selectedBranches,
              nodeConfigs: state.nodeConfigs
            };
            await historyStorage.savePlan(persisted);
            // Force immediate write to disk (bypass debounce)
            await historyStorage.saveNow();
            console.error(`[Overture] Auto-saved project ${projectId} (plan: ${state.plan!.id})`);
          } catch (error) {
            console.error(`[Overture] Auto-save failed for project ${projectId}:`, error);
          }
        }
      }
    }, 3000); // Every 3 seconds
  }

  /**
   * Get or initialize project state
   */
  getProjectState(projectId: string): ProjectPlanState | null {
    return this.projects.get(projectId) || null;
  }

  /**
   * Initialize a new project
   */
  initializeProject(context: ProjectContext): void {
    if (!this.projects.has(context.projectId)) {
      this.projects.set(context.projectId, {
        projectId: context.projectId,
        workspacePath: context.workspacePath,
        plan: null,
        nodes: [],
        edges: [],
        fieldValues: {},
        selectedBranches: {},
        nodeConfigs: {}
      });
      console.error(`[Overture] Initialized project: ${context.projectName} (${context.projectId})`);
    }
  }

  /**
   * Get all active projects
   */
  getAllProjects(): ProjectContext[] {
    const contexts: ProjectContext[] = [];
    for (const [projectId, state] of this.projects) {
      contexts.push({
        projectId,
        workspacePath: state.workspacePath,
        projectName: path.basename(state.workspacePath),
        agentType: state.plan?.agent || 'unknown'
      });
    }
    return contexts;
  }

  /**
   * Get all active plans across all projects
   */
  getAllActivePlans(): { projectId: string; plan: Plan; nodes: PlanNode[] }[] {
    const result: { projectId: string; plan: Plan; nodes: PlanNode[] }[] = [];
    for (const [projectId, state] of this.projects) {
      if (state.plan) {
        result.push({
          projectId,
          plan: state.plan,
          nodes: state.nodes
        });
      }
    }
    return result;
  }

  // === Plan Management ===

  /**
   * Start a new plan for a project
   */
  startPlan(projectId: string, plan: Plan): PlanWithProject {
    let state = this.projects.get(projectId);

    // Auto-initialize project if needed
    if (!state) {
      this.initializeProject({
        projectId,
        workspacePath: process.cwd(),
        projectName: 'default',
        agentType: plan.agent
      });
      state = this.projects.get(projectId)!;
    }

    const planWithProject: PlanWithProject = {
      ...plan,
      projectId,
      workspacePath: state.workspacePath
    };

    state.plan = planWithProject;
    state.nodes = [];
    state.edges = [];
    state.fieldValues = {};
    state.selectedBranches = {};
    state.nodeConfigs = {};

    console.error(`[Overture] Plan stored for project: ${projectId}, planId: ${planWithProject.id}`);
    console.error(`[Overture] All projects after startPlan:`, Array.from(this.projects.keys()));

    // Create approval promise for this project
    console.error(`[Overture] Creating approval promise for project: ${projectId}`);
    this.approvalPromises.set(projectId, new Promise((resolve) => {
      this.approvalResolvers.set(projectId, resolve);
    }));

    // Reset pause state
    this.pauseStates.set(projectId, false);

    console.error(`[Overture] Plan started. Projects with promises:`, Array.from(this.approvalPromises.keys()));

    // Persist to history immediately so plan is recoverable even if interrupted
    this.persistToHistory(projectId);

    return planWithProject;
  }

  getPlan(projectId: string): Plan | null {
    return this.projects.get(projectId)?.plan ?? null;
  }

  getNodes(projectId: string): PlanNode[] {
    return this.projects.get(projectId)?.nodes ?? [];
  }

  getEdges(projectId: string): PlanEdge[] {
    return this.projects.get(projectId)?.edges ?? [];
  }

  getState(projectId: string): PlanState | null {
    const state = this.projects.get(projectId);
    if (!state) return null;
    return {
      plan: state.plan,
      nodes: state.nodes,
      edges: state.edges,
      fieldValues: state.fieldValues,
      selectedBranches: state.selectedBranches,
      nodeConfigs: state.nodeConfigs
    };
  }

  getFieldValues(projectId: string): Record<string, string> {
    return this.projects.get(projectId)?.fieldValues ?? {};
  }

  getSelectedBranches(projectId: string): Record<string, string> {
    return this.projects.get(projectId)?.selectedBranches ?? {};
  }

  getNodeConfigs(projectId: string): Record<string, NodeConfig> {
    return this.projects.get(projectId)?.nodeConfigs ?? {};
  }

  addNode(projectId: string, node: PlanNode): void {
    const state = this.projects.get(projectId);
    if (state) {
      state.nodes.push(node);
      this.persistToHistory(projectId);
    }
  }

  addEdge(projectId: string, edge: PlanEdge): void {
    const state = this.projects.get(projectId);
    if (state) {
      state.edges.push(edge);
      this.persistToHistory(projectId);
    }
  }

  updatePlanStatus(projectId: string, status: Plan['status']): void {
    const state = this.projects.get(projectId);
    if (state?.plan) {
      state.plan.status = status;
      this.persistToHistory(projectId);
    }
  }

  updateNodeStatus(projectId: string, nodeId: string, status: NodeStatus, output?: string): void {
    const state = this.projects.get(projectId);
    if (!state) return;

    const node = state.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = status;
      if (output) {
        node.output = output;
      }
      this.persistToHistory(projectId);
    }
  }

  // === Approval ===

  async setApproval(
    projectId: string,
    fieldValues: Record<string, string>,
    selectedBranches: Record<string, string>,
    nodeConfigs: Record<string, NodeConfig> = {}
  ): Promise<void> {
    console.error(`[Overture] setApproval called for project: ${projectId}`);
    console.error(`[Overture] Available projects:`, Array.from(this.projects.keys()));
    console.error(`[Overture] Available resolvers:`, Array.from(this.approvalResolvers.keys()));

    let state = this.projects.get(projectId);

    // If no state found, try to restore from history
    if (!state) {
      console.error(`[Overture] No state found for project ${projectId}, attempting to restore from history...`);
      const restored = await this.restoreProjectFromHistory(projectId);
      if (restored) {
        state = this.projects.get(projectId);
        console.error(`[Overture] Successfully restored project from history`);
      }
    }

    if (!state) {
      console.error(`[Overture] ERROR: No state found for project ${projectId} and could not restore from history`);
      return;
    }

    state.fieldValues = fieldValues;
    state.selectedBranches = selectedBranches;
    state.nodeConfigs = nodeConfigs;

    if (state.plan) {
      state.plan.status = 'approved';
      console.error(`[Overture] Plan status set to 'approved'`);
    }

    // Resolve the approval promise
    const resolver = this.approvalResolvers.get(projectId);
    if (resolver) {
      console.error(`[Overture] Resolving approval promise for project: ${projectId}`);
      resolver(true);
      this.approvalResolvers.delete(projectId);
    } else {
      console.error(`[Overture] WARNING: No resolver found for project ${projectId}`);
    }

    this.persistToHistory(projectId);
  }

  cancelApproval(projectId: string): void {
    const resolver = this.approvalResolvers.get(projectId);
    if (resolver) {
      resolver(false);
      this.approvalResolvers.delete(projectId);
    }
  }

  async waitForApproval(projectId: string, timeoutMs: number = 60000): Promise<'approved' | 'cancelled' | 'pending'> {
    console.error(`[Overture] waitForApproval called for project: ${projectId}`);
    console.error(`[Overture] Available promises:`, Array.from(this.approvalPromises.keys()));

    let promise = this.approvalPromises.get(projectId);

    // If no promise exists, try to restore from history and create one
    if (!promise) {
      console.error(`[Overture] No approval promise found, attempting to restore project from history...`);
      const restored = await this.restoreProjectFromHistory(projectId);
      if (restored) {
        promise = this.approvalPromises.get(projectId);
        console.error(`[Overture] Project restored, approval promise created`);
      }
    }

    // If still no promise, check if project exists and create a promise
    if (!promise) {
      const state = this.projects.get(projectId);
      if (state?.plan) {
        console.error(`[Overture] Project exists but no promise, creating one...`);
        promise = new Promise((resolve) => {
          this.approvalResolvers.set(projectId, resolve);
        });
        this.approvalPromises.set(projectId, promise);
      } else {
        console.error(`[Overture] ERROR: No project found for ${projectId}, cannot create approval promise`);
        return 'cancelled';
      }
    }

    console.error(`[Overture] Waiting for approval (timeout: ${timeoutMs}ms)...`);

    const timeoutPromise = new Promise<'pending'>((resolve) => {
      setTimeout(() => resolve('pending'), timeoutMs);
    });

    const result = await Promise.race([
      promise.then((approved) => (approved ? 'approved' : 'cancelled')),
      timeoutPromise
    ]);

    console.error(`[Overture] waitForApproval result: ${result}`);
    return result;
  }

  // === Rerun ===

  setRerunRequest(projectId: string, nodeId: string, mode: 'single' | 'to-bottom'): void {
    const request: RerunRequest = { nodeId, mode, timestamp: Date.now() };
    this.pendingRerunRequests.set(projectId, request);

    const resolver = this.rerunResolvers.get(projectId);
    if (resolver) {
      resolver(request);
      this.rerunResolvers.delete(projectId);
      this.rerunPromises.delete(projectId);
    }
  }

  getPendingRerun(projectId: string): RerunRequest | null {
    return this.pendingRerunRequests.get(projectId) || null;
  }

  clearPendingRerun(projectId: string): void {
    this.pendingRerunRequests.delete(projectId);
  }

  async waitForRerun(projectId: string, timeoutMs: number = 60000): Promise<RerunRequest | null> {
    const pending = this.pendingRerunRequests.get(projectId);
    if (pending) {
      this.pendingRerunRequests.delete(projectId);
      return pending;
    }

    const promise = new Promise<RerunRequest>((resolve) => {
      this.rerunResolvers.set(projectId, resolve);
    });
    this.rerunPromises.set(projectId, promise);

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });

    const result = await Promise.race([promise, timeoutPromise]);

    if (result) {
      this.pendingRerunRequests.delete(projectId);
    }

    return result;
  }

  resetNodesForRerun(projectId: string, startNodeId: string, mode: 'single' | 'to-bottom'): string[] {
    const state = this.projects.get(projectId);
    if (!state) return [];

    const nodeIds: string[] = [];

    if (mode === 'single') {
      const node = state.nodes.find(n => n.id === startNodeId);
      if (node) {
        node.status = 'pending';
        node.output = undefined;
        nodeIds.push(node.id);
      }
    } else {
      const startIndex = state.nodes.findIndex(n => n.id === startNodeId);
      if (startIndex !== -1) {
        for (let i = startIndex; i < state.nodes.length; i++) {
          const node = state.nodes[i];
          node.status = 'pending';
          node.output = undefined;
          nodeIds.push(node.id);
        }
      }
    }

    return nodeIds;
  }

  // === Pause/Resume ===

  pause(projectId: string): void {
    this.pauseStates.set(projectId, true);
    const state = this.projects.get(projectId);
    if (state?.plan) {
      state.plan.status = 'paused';
    }
  }

  resume(projectId: string): void {
    this.pauseStates.set(projectId, false);
    const state = this.projects.get(projectId);
    if (state?.plan) {
      state.plan.status = 'executing';
    }

    const resolver = this.pauseResolvers.get(projectId);
    if (resolver) {
      resolver();
      this.pauseResolvers.delete(projectId);
      this.pausePromises.delete(projectId);
    }
  }

  getIsPaused(projectId: string): boolean {
    return this.pauseStates.get(projectId) || false;
  }

  async waitIfPaused(projectId: string): Promise<boolean> {
    if (!this.pauseStates.get(projectId)) {
      return false;
    }

    const promise = new Promise<void>((resolve) => {
      this.pauseResolvers.set(projectId, resolve);
    });
    this.pausePromises.set(projectId, promise);

    await promise;
    return true;
  }

  // === Node Operations ===

  insertNodes(
    projectId: string,
    afterNodeId: string,
    newNodes: PlanNode[],
    newEdges: PlanEdge[]
  ): { removedEdgeIds: string[]; reconnectionEdges: PlanEdge[] } {
    const state = this.projects.get(projectId);
    if (!state) return { removedEdgeIds: [], reconnectionEdges: [] };

    const edgesToRemove = state.edges.filter(e => e.from === afterNodeId);
    const removedEdgeIds = edgesToRemove.map(e => e.id);
    const targetNodeIds = edgesToRemove.map(e => e.to);

    state.edges = state.edges.filter(e => e.from !== afterNodeId);
    state.nodes.push(...newNodes);
    state.edges.push(...newEdges);

    const newNodeIds = new Set(newNodes.map(n => n.id));
    const exitNodeIds = newNodes
      .filter(n => !newEdges.some(e => e.from === n.id && newNodeIds.has(e.to)))
      .map(n => n.id);

    // Track reconnection edges so they can be broadcast to UI
    const reconnectionEdges: PlanEdge[] = [];
    let edgeCounter = Date.now();
    for (const exitNodeId of exitNodeIds) {
      for (const targetNodeId of targetNodeIds) {
        const reconnectEdge: PlanEdge = {
          id: `e_inserted_${edgeCounter++}`,
          from: exitNodeId,
          to: targetNodeId,
        };
        state.edges.push(reconnectEdge);
        reconnectionEdges.push(reconnectEdge);
      }
    }

    return { removedEdgeIds, reconnectionEdges };
  }

  removeNode(projectId: string, nodeId: string): { newEdges: PlanEdge[]; removedEdgeIds: string[] } {
    const state = this.projects.get(projectId);
    if (!state) return { newEdges: [], removedEdgeIds: [] };

    const incomingEdges = state.edges.filter(e => e.to === nodeId);
    const outgoingEdges = state.edges.filter(e => e.from === nodeId);

    const removedEdgeIds = [
      ...incomingEdges.map(e => e.id),
      ...outgoingEdges.map(e => e.id),
    ];

    const newEdges: PlanEdge[] = [];
    let edgeCounter = Date.now();
    for (const incoming of incomingEdges) {
      for (const outgoing of outgoingEdges) {
        newEdges.push({
          id: `e_bridge_${edgeCounter++}`,
          from: incoming.from,
          to: outgoing.to,
        });
      }
    }

    state.nodes = state.nodes.filter(n => n.id !== nodeId);
    state.edges = [
      ...state.edges.filter(e => e.to !== nodeId && e.from !== nodeId),
      ...newEdges,
    ];

    return { newEdges, removedEdgeIds };
  }

  // === Plan Update Support ===

  /**
   * Store the current plan state before an update for diff calculation
   */
  storePreviousPlanState(projectId: string): void {
    const state = this.projects.get(projectId);
    if (!state) return;

    // Deep copy the nodes and edges
    this.previousPlanStates.set(projectId, {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    });
    console.error(`[Overture] Stored previous plan state for project ${projectId} (${state.nodes.length} nodes, ${state.edges.length} edges)`);
  }

  /**
   * Get the previous plan state for diff calculation
   */
  getPreviousPlanState(projectId: string): { nodes: PlanNode[]; edges: PlanEdge[] } | null {
    return this.previousPlanStates.get(projectId) || null;
  }

  /**
   * Clear the previous plan state after diff has been calculated
   */
  clearPreviousPlanState(projectId: string): void {
    this.previousPlanStates.delete(projectId);
  }

  /**
   * Calculate diff between previous and current plan states
   */
  calculateDiff(projectId: string): PlanDiff | null {
    const previousState = this.previousPlanStates.get(projectId);
    const currentState = this.projects.get(projectId);

    if (!previousState || !currentState) {
      return null;
    }

    return calculatePlanDiff(previousState, {
      nodes: currentState.nodes,
      edges: currentState.edges,
    });
  }

  /**
   * Clear the current plan for a project to prepare for a new unrelated plan
   */
  clearProjectPlan(projectId: string): void {
    const state = this.projects.get(projectId);
    if (!state) return;

    // Clear the plan but keep project context
    state.plan = null;
    state.nodes = [];
    state.edges = [];
    state.fieldValues = {};
    state.selectedBranches = {};
    state.nodeConfigs = {};

    // Also clear any pending approval/rerun/pause state
    this.approvalResolvers.delete(projectId);
    this.approvalPromises.delete(projectId);
    this.pendingRerunRequests.delete(projectId);
    this.pauseStates.delete(projectId);

    // Clear previous plan state as well
    this.previousPlanStates.delete(projectId);

    console.error(`[Overture] Cleared plan for project ${projectId}`);
  }

  // === History/Persistence ===

  /**
   * Persist current project state to history
   * Uses immediate write to ensure data is not lost
   */
  private async persistToHistory(projectId: string): Promise<void> {
    const state = this.projects.get(projectId);
    if (!state?.plan) return;

    try {
      const persisted: PersistedPlan = {
        plan: state.plan as PlanWithProject,
        nodes: state.nodes,
        edges: state.edges,
        fieldValues: state.fieldValues,
        selectedBranches: state.selectedBranches,
        nodeConfigs: state.nodeConfigs
      };
      await historyStorage.savePlan(persisted);
      // Force immediate write to ensure data is persisted
      await historyStorage.saveNow();
      console.error(`[Overture] Persisted to history: ${state.plan.id} (${state.nodes.length} nodes)`);
    } catch (error) {
      console.error('[Overture] Failed to persist plan to history:', error);
    }
  }

  /**
   * Force immediate persist to history (for UI-triggered saves)
   */
  async forcePersist(projectId: string): Promise<{ success: boolean; planId?: string }> {
    console.error(`[Overture] forcePersist called for project: ${projectId}`);
    console.error(`[Overture] Available projects:`, Array.from(this.projects.keys()));

    const state = this.projects.get(projectId);
    if (!state?.plan) {
      console.error(`[Overture] No plan found for project ${projectId}. State exists: ${!!state}, Plan exists: ${!!state?.plan}`);
      return { success: false };
    }

    try {
      const persisted: PersistedPlan = {
        plan: state.plan as PlanWithProject,
        nodes: state.nodes,
        edges: state.edges,
        fieldValues: state.fieldValues,
        selectedBranches: state.selectedBranches,
        nodeConfigs: state.nodeConfigs
      };
      await historyStorage.savePlan(persisted);
      // Force immediate write (bypass debounce)
      await historyStorage.saveNow();
      console.error(`[Overture] Plan ${state.plan.id} force-persisted to history`);
      return { success: true, planId: state.plan.id };
    } catch (error) {
      console.error('[Overture] Failed to force persist plan:', error);
      return { success: false };
    }
  }

  /**
   * Load a plan from history into a project
   */
  async loadFromHistory(planId: string): Promise<ProjectPlanState | null> {
    const persisted = await historyStorage.getPlan(planId);
    if (!persisted) return null;

    const state: ProjectPlanState = {
      projectId: persisted.plan.projectId,
      workspacePath: persisted.plan.workspacePath,
      plan: persisted.plan,
      nodes: persisted.nodes,
      edges: persisted.edges,
      fieldValues: persisted.fieldValues,
      selectedBranches: persisted.selectedBranches,
      nodeConfigs: persisted.nodeConfigs
    };

    this.projects.set(state.projectId, state);
    return state;
  }

  /**
   * Restore a project from history by projectId
   * Finds the most recent plan for this project and loads it
   */
  async restoreProjectFromHistory(projectId: string): Promise<boolean> {
    try {
      const entries = await historyStorage.getEntriesByProject(projectId);
      if (entries.length === 0) {
        console.error(`[Overture] No history entries found for project ${projectId}`);
        return false;
      }

      // Get the most recent entry (entries are sorted by updatedAt desc)
      const mostRecent = entries[0];
      console.error(`[Overture] Found history entry: ${mostRecent.title} (${mostRecent.id})`);

      const persisted = await historyStorage.getPlan(mostRecent.id);
      if (!persisted) {
        console.error(`[Overture] Could not load plan data for ${mostRecent.id}`);
        return false;
      }

      // Restore the state
      const state: ProjectPlanState = {
        projectId: persisted.plan.projectId,
        workspacePath: persisted.plan.workspacePath,
        plan: persisted.plan,
        nodes: persisted.nodes,
        edges: persisted.edges,
        fieldValues: persisted.fieldValues,
        selectedBranches: persisted.selectedBranches,
        nodeConfigs: persisted.nodeConfigs
      };

      this.projects.set(state.projectId, state);

      // Create approval promise so get_approval can work
      console.error(`[Overture] Creating approval promise for restored project: ${projectId}`);
      this.approvalPromises.set(projectId, new Promise((resolve) => {
        this.approvalResolvers.set(projectId, resolve);
      }));

      // Reset pause state
      this.pauseStates.set(projectId, false);

      console.error(`[Overture] Project ${projectId} restored from history with ${state.nodes.length} nodes`);
      return true;
    } catch (error) {
      console.error(`[Overture] Failed to restore project from history:`, error);
      return false;
    }
  }

  // === Resume Info ===

  /**
   * Generate resume info for a paused/failed plan
   */
  getResumeInfo(projectId: string): ResumePlanInfo | null {
    const state = this.projects.get(projectId);
    if (!state?.plan) return null;

    const plan = state.plan as PlanWithProject;

    // Find the current node (last active or failed node)
    let currentNode: PlanNode | null = null;
    for (const node of state.nodes) {
      if (node.status === 'active' || node.status === 'failed') {
        currentNode = node;
        break;
      }
    }

    // If no active/failed node, find the last completed node
    if (!currentNode) {
      const completedNodes = state.nodes.filter(n => n.status === 'completed');
      if (completedNodes.length > 0) {
        currentNode = completedNodes[completedNodes.length - 1];
      }
    }

    // Categorize nodes
    const completedNodes = state.nodes
      .filter(n => n.status === 'completed')
      .map(n => ({
        id: n.id,
        title: n.title,
        output: n.output,
      }));

    const pendingNodes = state.nodes
      .filter(n => n.status === 'pending')
      .map(n => ({
        id: n.id,
        title: n.title,
        description: n.description,
      }));

    const failedNodes = state.nodes
      .filter(n => n.status === 'failed')
      .map(n => ({
        id: n.id,
        title: n.title,
        output: n.output,
      }));

    const resumeInfo: ResumePlanInfo = {
      planId: plan.id,
      planTitle: plan.title,
      agent: plan.agent,
      status: plan.status,
      projectId: state.projectId,
      workspacePath: state.workspacePath,

      currentNodeId: currentNode?.id || null,
      currentNodeTitle: currentNode?.title || null,
      currentNodeStatus: currentNode?.status || null,

      completedNodes,
      pendingNodes,
      failedNodes,

      fieldValues: state.fieldValues,
      selectedBranches: state.selectedBranches,
      nodeConfigs: state.nodeConfigs,

      createdAt: plan.createdAt,
      pausedAt: plan.status === 'paused' ? new Date().toISOString() : undefined,
    };

    return resumeInfo;
  }

  // === Cleanup ===

  clear(projectId: string): void {
    this.projects.delete(projectId);
    this.approvalResolvers.delete(projectId);
    this.approvalPromises.delete(projectId);
    this.pendingRerunRequests.delete(projectId);
    this.rerunResolvers.delete(projectId);
    this.rerunPromises.delete(projectId);
    this.pauseStates.delete(projectId);
    this.pauseResolvers.delete(projectId);
    this.pausePromises.delete(projectId);
    this.previousPlanStates.delete(projectId);
  }

  clearAll(): void {
    this.projects.clear();
    this.approvalResolvers.clear();
    this.approvalPromises.clear();
    this.pendingRerunRequests.clear();
    this.rerunResolvers.clear();
    this.rerunPromises.clear();
    this.pauseStates.clear();
    this.pauseResolvers.clear();
    this.pausePromises.clear();
    this.previousPlanStates.clear();
  }
}

// Singleton multi-project store
export const multiProjectPlanStore = new MultiProjectPlanStore();

/**
 * Backwards-compatible singleton wrapper.
 * Delegates all operations to multiProjectPlanStore using DEFAULT_PROJECT_ID.
 */
class LegacyPlanStore {
  private get projectId(): string {
    return DEFAULT_PROJECT_ID;
  }

  getPlan(): Plan | null {
    return multiProjectPlanStore.getPlan(this.projectId);
  }

  getNodes(): PlanNode[] {
    return multiProjectPlanStore.getNodes(this.projectId);
  }

  getEdges(): PlanEdge[] {
    return multiProjectPlanStore.getEdges(this.projectId);
  }

  getState(): PlanState {
    return multiProjectPlanStore.getState(this.projectId) || {
      plan: null,
      nodes: [],
      edges: [],
      fieldValues: {},
      selectedBranches: {},
      nodeConfigs: {}
    };
  }

  getFieldValues(): Record<string, string> {
    return multiProjectPlanStore.getFieldValues(this.projectId);
  }

  getSelectedBranches(): Record<string, string> {
    return multiProjectPlanStore.getSelectedBranches(this.projectId);
  }

  getNodeConfigs(): Record<string, NodeConfig> {
    return multiProjectPlanStore.getNodeConfigs(this.projectId);
  }

  startPlan(plan: Plan): void {
    multiProjectPlanStore.initializeProject({
      projectId: this.projectId,
      workspacePath: process.cwd(),
      projectName: 'default',
      agentType: plan.agent
    });
    multiProjectPlanStore.startPlan(this.projectId, plan);
  }

  addNode(node: PlanNode): void {
    multiProjectPlanStore.addNode(this.projectId, node);
  }

  addEdge(edge: PlanEdge): void {
    multiProjectPlanStore.addEdge(this.projectId, edge);
  }

  updatePlanStatus(status: Plan['status']): void {
    multiProjectPlanStore.updatePlanStatus(this.projectId, status);
  }

  updateNodeStatus(nodeId: string, status: NodeStatus, output?: string): void {
    multiProjectPlanStore.updateNodeStatus(this.projectId, nodeId, status, output);
  }

  setApproval(
    fieldValues: Record<string, string>,
    selectedBranches: Record<string, string>,
    nodeConfigs: Record<string, NodeConfig> = {}
  ): void {
    multiProjectPlanStore.setApproval(this.projectId, fieldValues, selectedBranches, nodeConfigs);
  }

  cancelApproval(): void {
    multiProjectPlanStore.cancelApproval(this.projectId);
  }

  async waitForApproval(timeoutMs: number = 60000): Promise<'approved' | 'cancelled' | 'pending'> {
    return multiProjectPlanStore.waitForApproval(this.projectId, timeoutMs);
  }

  setRerunRequest(nodeId: string, mode: 'single' | 'to-bottom'): void {
    multiProjectPlanStore.setRerunRequest(this.projectId, nodeId, mode);
  }

  getPendingRerun(): { nodeId: string; mode: 'single' | 'to-bottom'; timestamp: number } | null {
    return multiProjectPlanStore.getPendingRerun(this.projectId);
  }

  clearPendingRerun(): void {
    multiProjectPlanStore.clearPendingRerun(this.projectId);
  }

  async waitForRerun(timeoutMs: number = 60000): Promise<{ nodeId: string; mode: 'single' | 'to-bottom'; timestamp: number } | null> {
    return multiProjectPlanStore.waitForRerun(this.projectId, timeoutMs);
  }

  resetNodesForRerun(startNodeId: string, mode: 'single' | 'to-bottom'): string[] {
    return multiProjectPlanStore.resetNodesForRerun(this.projectId, startNodeId, mode);
  }

  pause(): void {
    multiProjectPlanStore.pause(this.projectId);
  }

  resume(): void {
    multiProjectPlanStore.resume(this.projectId);
  }

  getIsPaused(): boolean {
    return multiProjectPlanStore.getIsPaused(this.projectId);
  }

  async waitIfPaused(): Promise<boolean> {
    return multiProjectPlanStore.waitIfPaused(this.projectId);
  }

  insertNodes(
    afterNodeId: string,
    newNodes: PlanNode[],
    newEdges: PlanEdge[]
  ): { removedEdgeIds: string[]; reconnectionEdges: PlanEdge[] } {
    return multiProjectPlanStore.insertNodes(this.projectId, afterNodeId, newNodes, newEdges);
  }

  removeNode(nodeId: string): { newEdges: PlanEdge[]; removedEdgeIds: string[] } {
    return multiProjectPlanStore.removeNode(this.projectId, nodeId);
  }

  clear(): void {
    multiProjectPlanStore.clear(this.projectId);
  }
}

// Backwards-compatible export
export const planStore = new LegacyPlanStore();
