import { create } from 'zustand';

// Types for our plan data
export type NodeStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
export type NodeType = 'task' | 'decision';
export type FieldType = 'string' | 'secret' | 'select' | 'boolean' | 'number' | 'file' | 'question' | 'color';

export interface DynamicField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  title: string;
  description: string;
  value?: string;
  options?: string; // Comma-separated for select
  setupInstructions?: string;
}

export interface Branch {
  id: string;
  label: string;
  description: string;
  pros?: string;
  cons?: string;
}

export interface FileAttachment {
  id: string;
  path: string;
  name: string;
  type: 'image' | 'code' | 'document' | 'other';
  description: string;
}

export interface McpServer {
  mcpId: string;
  githubUrl: string;
  name: string;
  author: string;
  description: string;
  codiconIcon: string;
  logoUrl: string;
  category: string;
  tags: string[];
  requiresApiKey: boolean;
  readmeContent: string;
  isRecommended: boolean;
  githubStars: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

// Structured Output Types - for rich node execution output
export interface FileChange {
  path: string;
  linesAdded?: number;
  linesRemoved?: number;
  diff?: string;
}

export interface FileCreated {
  path: string;
  lines?: number;
  content?: string;  // File content for display in Monaco editor
}

export interface FileDeleted {
  path: string;
}

export interface PackageInstalled {
  name: string;
  version?: string;
  dev?: boolean;
}

export interface McpServerSetup {
  name: string;
  status: 'installed' | 'configured' | 'failed';
  config?: string;
}

export interface WebSearchPerformed {
  query: string;
  resultsUsed?: number;
}

export interface ToolCallSummary {
  name: string;
  count: number;
}

export interface PreviewUrl {
  type: string;
  url: string;
}

export interface OutputNote {
  type: 'info' | 'warning' | 'error';
  message: string;
}

export interface StructuredOutput {
  overview?: string;
  filesChanged?: FileChange[];
  filesCreated?: FileCreated[];
  filesDeleted?: FileDeleted[];
  packagesInstalled?: PackageInstalled[];
  mcpSetup?: McpServerSetup[];
  webSearches?: WebSearchPerformed[];
  toolCalls?: ToolCallSummary[];
  previewUrls?: PreviewUrl[];
  notes?: OutputNote[];
  raw?: string;
}

export interface PlanNode {
  id: string;
  type: NodeType;
  status: NodeStatus;
  title: string;
  description: string;
  complexity?: 'low' | 'medium' | 'high';
  expectedOutput?: string;
  risks?: string;
  dynamicFields: DynamicField[];
  branches?: Branch[];
  selectedBranchId?: string;
  branchParent?: string;
  branchId?: string;
  output?: string; // Execution output
  structuredOutput?: StructuredOutput; // Parsed structured output
  attachments: FileAttachment[]; // User-attached files
  metaInstructions?: string; // User instructions for the LLM
  mcpServers?: McpServer[]; // Attached MCP servers for this node
  // Branch point detection (computed from graph structure)
  isBranchPoint?: boolean;       // True if this node has multiple outgoing edges (fan-out)
  branchTargetIds?: string[];    // IDs of nodes this branches to (for branch points)
  branchSourceId?: string;       // ID of the branch point node this is a target of
}

export interface PlanEdge {
  id: string;
  from: string;
  to: string;
}

export interface Plan {
  id: string;
  title: string;
  agent: string;
  prompt?: string;
  createdAt: string;
  status: 'streaming' | 'ready' | 'approved' | 'executing' | 'paused' | 'completed' | 'failed';
  model?: string;      // e.g., 'claude-3-opus', 'gpt-4', 'claude-sonnet-4-20250514'
  provider?: string;   // e.g., 'anthropic', 'openai', 'google', 'minimax'
}

export interface NodeConfig {
  fieldValues: Record<string, string>;
  attachments: FileAttachment[];
  metaInstructions?: string;
  mcpServers?: McpServer[];
}

/**
 * Data for a single plan (Figma-style artboard)
 */
export interface PlanData {
  plan: Plan;
  nodes: PlanNode[];
  edges: PlanEdge[];
  completedCount: number;
  totalCount: number;
  currentNodeId: string | null;
}

interface PlanState {
  // Connection state
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // MULTI-PLAN: Array of plans (Figma-style artboards)
  plans: PlanData[];
  addPlan: (plan: Plan) => void;
  getPlanById: (planId: string) => PlanData | undefined;

  // Legacy single-plan getters (for backwards compatibility)
  plan: Plan | null;
  nodes: PlanNode[];
  edges: PlanEdge[];
  completedCount: number;
  totalCount: number;
  currentNodeId: string | null;

  // Plan operations
  setPlan: (plan: Plan) => void;
  updatePlanStatus: (status: Plan['status'], planId?: string) => void;
  updatePlanSettings: (planId: string, settings: { model?: string; provider?: string }) => void;

  // Node/Edge operations (with optional planId for multi-plan support)
  addNode: (node: PlanNode, planId?: string) => void;
  addEdge: (edge: PlanEdge, planId?: string) => void;
  updateNode: (id: string, updates: Partial<PlanNode>, planId?: string) => void;
  updateNodeStatus: (id: string, status: NodeStatus, output?: string, structuredOutput?: StructuredOutput, planId?: string) => void;
  setSelectedBranch: (nodeId: string, branchId: string, planId?: string) => void;
  updateFieldValue: (nodeId: string, fieldId: string, value: string, planId?: string) => void;
  addAttachment: (nodeId: string, attachment: FileAttachment, planId?: string) => void;
  removeAttachment: (nodeId: string, attachmentId: string, planId?: string) => void;
  updateMetaInstructions: (nodeId: string, instructions: string, planId?: string) => void;
  addNodeMcpServer: (nodeId: string, mcpServer: McpServer, planId?: string) => void;
  removeNodeMcpServer: (nodeId: string, mcpId: string, planId?: string) => void;
  addMcpServerToAllNodes: (mcpServer: McpServer, planId?: string) => void;
  clearNodeMcpServers: (nodeId: string, planId?: string) => void;

  // UI state
  selectedNodeId: string | null;
  selectedPlanId: string | null;
  setSelectedNodeId: (id: string | null, planId?: string | null) => void;

  // Actions
  clearPlan: (planId?: string) => void;
  clearAllPlans: () => void;
  approvePlan: (planId?: string) => void;
  canApprove: (planId?: string) => boolean;

  // Re-run actions
  requestRerun: (nodeId: string, mode: 'single' | 'to-bottom') => void;
  pendingRerun: { nodeId: string; mode: 'single' | 'to-bottom' } | null;
  clearPendingRerun: () => void;

  // Pause/Resume actions
  pauseExecution: (planId?: string) => void;
  resumeExecution: (planId?: string) => void;

  // Node insertion
  insertNodes: (nodes: PlanNode[], edges: PlanEdge[], removedEdgeIds: string[], planId?: string) => void;
  pendingInsert: { afterNodeId: string } | null;
  setPendingInsert: (afterNodeId: string | null) => void;

  // Node removal
  removeNode: (nodeId: string, planId?: string) => void;

  // Node reordering (swap adjacent nodes)
  swapNodes: (nodeId1: string, nodeId2: string, planId?: string) => void;
  getAdjacentNodeIds: (nodeId: string, planId?: string) => { prevNodeId: string | null; nextNodeId: string | null };

  // Insert before
  pendingInsertBefore: { beforeNodeId: string } | null;
  setPendingInsertBefore: (beforeNodeId: string | null) => void;
}

// Helper to find/update plan data
const findPlanIndex = (plans: PlanData[], planId?: string): number => {
  if (!planId) return plans.length - 1; // Default to last plan
  return plans.findIndex(p => p.plan.id === planId);
};

const updatePlanData = (
  plans: PlanData[],
  planId: string | undefined,
  updater: (data: PlanData) => PlanData
): PlanData[] => {
  const index = findPlanIndex(plans, planId);
  if (index < 0) return plans;
  const newPlans = [...plans];
  newPlans[index] = updater(newPlans[index]);
  return newPlans;
};

export const usePlanStore = create<PlanState>((set, get) => ({
  // Connection
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),

  // MULTI-PLAN: Array of plans
  plans: [],

  addPlan: (plan) =>
    set((state) => {
      // Check if plan already exists
      const existingIndex = state.plans.findIndex(p => p.plan.id === plan.id);
      if (existingIndex >= 0) {
        // Update existing plan
        const newPlans = [...state.plans];
        newPlans[existingIndex] = {
          ...newPlans[existingIndex],
          plan,
        };
        return { plans: newPlans };
      }
      // Add new plan
      return {
        plans: [...state.plans, {
          plan,
          nodes: [],
          edges: [],
          completedCount: 0,
          totalCount: 0,
          currentNodeId: null,
        }],
      };
    }),

  getPlanById: (planId) => get().plans.find(p => p.plan.id === planId),

  // Legacy single-plan getters (returns the most recent/active plan)
  get plan() {
    const state = get();
    const lastPlan = state.plans[state.plans.length - 1];
    return lastPlan?.plan || null;
  },
  get nodes() {
    const state = get();
    const lastPlan = state.plans[state.plans.length - 1];
    return lastPlan?.nodes || [];
  },
  get edges() {
    const state = get();
    const lastPlan = state.plans[state.plans.length - 1];
    return lastPlan?.edges || [];
  },
  get completedCount() {
    const state = get();
    const lastPlan = state.plans[state.plans.length - 1];
    return lastPlan?.completedCount || 0;
  },
  get totalCount() {
    const state = get();
    const lastPlan = state.plans[state.plans.length - 1];
    return lastPlan?.totalCount || 0;
  },
  get currentNodeId() {
    const state = get();
    const lastPlan = state.plans[state.plans.length - 1];
    return lastPlan?.currentNodeId || null;
  },

  // Plan operations
  setPlan: (plan) =>
    set((state) => {
      // Check if plan already exists
      const existingIndex = state.plans.findIndex(p => p.plan.id === plan.id);
      if (existingIndex >= 0) {
        // Update existing plan
        const newPlans = [...state.plans];
        newPlans[existingIndex] = {
          ...newPlans[existingIndex],
          plan,
        };
        return { plans: newPlans };
      }
      // Add new plan to the array (Figma-style - keep existing plans)
      return {
        plans: [...state.plans, {
          plan,
          nodes: [],
          edges: [],
          completedCount: 0,
          totalCount: 0,
          currentNodeId: null,
        }],
      };
    }),

  updatePlanStatus: (status, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        plan: { ...data.plan, status },
      })),
    })),

  updatePlanSettings: (planId, settings) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        plan: {
          ...data.plan,
          model: settings.model !== undefined ? settings.model : data.plan.model,
          provider: settings.provider !== undefined ? settings.provider : data.plan.provider,
        },
      })),
    })),

  // Node & Edge operations
  addNode: (node, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => {
        // Check for duplicate - don't add if node already exists
        const existingNode = data.nodes.find((n) => n.id === node.id);
        if (existingNode) {
          // Update existing node BUT PRESERVE user-entered field values
          return {
            ...data,
            nodes: data.nodes.map((n) => {
              if (n.id !== node.id) return n;
              // Merge dynamicFields - preserve existing values
              const mergedFields = node.dynamicFields.map((newField) => {
                const existingField = n.dynamicFields.find((f) => f.id === newField.id);
                // Keep existing value if it exists, otherwise use new field's value
                return existingField?.value
                  ? { ...newField, value: existingField.value }
                  : newField;
              });
              return {
                ...node,
                dynamicFields: mergedFields,
                attachments: n.attachments || node.attachments || [],
                metaInstructions: n.metaInstructions || node.metaInstructions,
                mcpServers: n.mcpServers || node.mcpServers,
              };
            }),
          };
        }
        return {
          ...data,
          nodes: [...data.nodes, { ...node, attachments: node.attachments || [] }],
          totalCount: data.totalCount + 1,
        };
      }),
    })),

  addEdge: (edge, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => {
        // Check for duplicate - don't add if edge already exists
        const edgeExists = data.edges.some((e) => e.id === edge.id);
        if (edgeExists) {
          return data; // No change
        }
        return {
          ...data,
          edges: [...data.edges, edge],
        };
      }),
    })),

  updateNode: (id, updates, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      })),
    })),

  updateNodeStatus: (id, status, output, structuredOutput, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => {
        const newNodes = data.nodes.map((n) =>
          n.id === id ? {
            ...n,
            status,
            output: output ?? n.output,
            structuredOutput: structuredOutput ?? n.structuredOutput
          } : n
        );
        return {
          ...data,
          nodes: newNodes,
          completedCount: newNodes.filter((n) => n.status === 'completed').length,
          currentNodeId: status === 'active' ? id : data.currentNodeId,
        };
      }),
    })),

  setSelectedBranch: (nodeId, branchId, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === nodeId ? { ...n, selectedBranchId: branchId } : n
        ),
      })),
    })),

  updateFieldValue: (nodeId, fieldId, value, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                dynamicFields: n.dynamicFields.map((f) =>
                  f.id === fieldId ? { ...f, value } : f
                ),
              }
            : n
        ),
      })),
    })),

  addAttachment: (nodeId, attachment, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, attachments: [...n.attachments, attachment] }
            : n
        ),
      })),
    })),

  removeAttachment: (nodeId, attachmentId, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, attachments: n.attachments.filter((a) => a.id !== attachmentId) }
            : n
        ),
      })),
    })),

  updateMetaInstructions: (nodeId, instructions, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === nodeId ? { ...n, metaInstructions: instructions } : n
        ),
      })),
    })),

  addNodeMcpServer: (nodeId, mcpServer, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                mcpServers: [...(n.mcpServers || []).filter(m => m.mcpId !== mcpServer.mcpId), mcpServer],
              }
            : n
        ),
      })),
    })),

  removeNodeMcpServer: (nodeId, mcpId, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, mcpServers: (n.mcpServers || []).filter(m => m.mcpId !== mcpId) }
            : n
        ),
      })),
    })),

  addMcpServerToAllNodes: (mcpServer, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) => ({
          ...n,
          mcpServers: [...(n.mcpServers || []).filter(m => m.mcpId !== mcpServer.mcpId), mcpServer],
        })),
      })),
    })),

  clearNodeMcpServers: (nodeId, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === nodeId ? { ...n, mcpServers: [] } : n
        ),
      })),
    })),

  // UI
  selectedNodeId: null,
  selectedPlanId: null,
  setSelectedNodeId: (id, planId) => set({ selectedNodeId: id, selectedPlanId: planId ?? null }),

  // Actions
  clearPlan: (planId) =>
    set((state) => {
      if (planId) {
        // Remove specific plan
        return { plans: state.plans.filter(p => p.plan.id !== planId) };
      }
      // Clear the last plan (legacy behavior)
      return { plans: state.plans.slice(0, -1) };
    }),

  clearAllPlans: () =>
    set({
      plans: [],
      selectedNodeId: null,
      selectedPlanId: null,
    }),

  approvePlan: (planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        plan: { ...data.plan, status: 'approved' },
      })),
    })),

  canApprove: (planId) => {
    const state = get();
    const index = findPlanIndex(state.plans, planId);
    if (index < 0) return false;

    const planData = state.plans[index];
    const { nodes, edges } = planData;

    // Only filter out explicit type="decision" nodes (legacy)
    const decisionNodeIds = new Set(nodes.filter(n => n.type === 'decision').map(n => n.id));
    const visibleNodes = nodes.filter(n => n.type !== 'decision');

    // Build outgoing edges map to detect branch points
    const outgoingEdgesMap: Record<string, string[]> = {};
    for (const edge of edges) {
      if (decisionNodeIds.has(edge.from) || decisionNodeIds.has(edge.to)) continue;
      if (!outgoingEdgesMap[edge.from]) {
        outgoingEdgesMap[edge.from] = [];
      }
      if (!outgoingEdgesMap[edge.from].includes(edge.to)) {
        outgoingEdgesMap[edge.from].push(edge.to);
      }
    }

    // Find disabled nodes (unselected branch siblings)
    const disabledNodeIds = new Set<string>();
    for (const [branchPointId, targets] of Object.entries(outgoingEdgesMap)) {
      if (targets.length > 1) {
        const branchNode = visibleNodes.find(n => n.id === branchPointId);
        const selectedTargetId = branchNode?.selectedBranchId;
        if (selectedTargetId) {
          // Disable all OTHER targets
          for (const targetId of targets) {
            if (targetId !== selectedTargetId) {
              disabledNodeIds.add(targetId);
            }
          }
        }
      }
    }

    // Check all required fields on enabled nodes only
    for (const node of visibleNodes) {
      // Skip disabled nodes (unselected branch paths)
      if (disabledNodeIds.has(node.id)) {
        continue;
      }

      // Check required dynamic fields (with null check)
      const dynamicFields = node.dynamicFields || [];
      for (const field of dynamicFields) {
        if (field.required && !field.value) {
          console.log(`[canApprove] Missing required field "${field.title}" on node "${node.title}"`);
          return false;
        }
      }

      // Check branch points have a selected branch
      const outgoingTargets = outgoingEdgesMap[node.id] || [];
      if (outgoingTargets.length > 1 && !node.selectedBranchId) {
        console.log(`[canApprove] Missing branch selection on node "${node.title}"`);
        return false;
      }
    }

    return planData.plan?.status === 'ready';
  },

  // Re-run actions
  pendingRerun: null,

  requestRerun: (nodeId, mode) =>
    set({ pendingRerun: { nodeId, mode } }),

  clearPendingRerun: () =>
    set({ pendingRerun: null }),

  // Pause/Resume actions
  pauseExecution: (planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        plan: { ...data.plan, status: 'paused' },
      })),
    })),

  resumeExecution: (planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        plan: { ...data.plan, status: 'executing' },
      })),
    })),

  // Node insertion
  insertNodes: (nodes, edges, removedEdgeIds, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => ({
        ...data,
        nodes: [...data.nodes, ...nodes],
        edges: [
          ...data.edges.filter(e => !removedEdgeIds.includes(e.id)),
          ...edges,
        ],
        totalCount: data.totalCount + nodes.length,
      })),
    })),

  pendingInsert: null,

  setPendingInsert: (afterNodeId) =>
    set({ pendingInsert: afterNodeId ? { afterNodeId } : null }),

  // Node removal - reconnects edges around the removed node
  removeNode: (nodeId, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => {
        // Find edges connected to this node
        const incomingEdges = data.edges.filter(e => e.to === nodeId);
        const outgoingEdges = data.edges.filter(e => e.from === nodeId);

        // Create new edges to bridge the gap
        const newEdges: PlanEdge[] = [];
        for (const incoming of incomingEdges) {
          for (const outgoing of outgoingEdges) {
            newEdges.push({
              id: `edge_${incoming.from}_${outgoing.to}`,
              from: incoming.from,
              to: outgoing.to,
            });
          }
        }

        // Remove the node and its connected edges, add new bridging edges
        const edgeIdsToRemove = new Set([
          ...incomingEdges.map(e => e.id),
          ...outgoingEdges.map(e => e.id),
        ]);

        return {
          ...data,
          nodes: data.nodes.filter(n => n.id !== nodeId),
          edges: [
            ...data.edges.filter(e => !edgeIdsToRemove.has(e.id)),
            ...newEdges,
          ],
          totalCount: Math.max(0, data.totalCount - 1),
        };
      }),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    })),

  // Node reordering - swap two adjacent nodes by updating their edges
  swapNodes: (nodeId1, nodeId2, planId) =>
    set((state) => ({
      plans: updatePlanData(state.plans, planId, (data) => {
        // Find all edges in the plan
        const edges = data.edges;

        // Find edges connecting node1 to node2 (they should be adjacent)
        const edgeBetween = edges.find(
          e => (e.from === nodeId1 && e.to === nodeId2) || (e.from === nodeId2 && e.to === nodeId1)
        );

        if (!edgeBetween) {
          // Nodes are not adjacent, cannot swap
          console.warn('[swapNodes] Nodes are not adjacent, cannot swap');
          return data;
        }

        // Determine which node comes first
        const firstNodeId = edgeBetween.from;
        const secondNodeId = edgeBetween.to;

        // Find edges pointing TO the first node (predecessors)
        const predecessorEdges = edges.filter(e => e.to === firstNodeId);
        // Find edges pointing FROM the second node (successors)
        const successorEdges = edges.filter(e => e.from === secondNodeId);

        // Build new edges:
        // 1. Predecessors now point to second node
        // 2. Second node points to first node
        // 3. First node points to successors

        const newEdges: PlanEdge[] = [];

        // Keep edges that don't involve these two nodes
        for (const e of edges) {
          const involvesFirst = e.from === firstNodeId || e.to === firstNodeId;
          const involvesSecond = e.from === secondNodeId || e.to === secondNodeId;
          if (!involvesFirst && !involvesSecond) {
            newEdges.push(e);
          }
        }

        // Predecessors -> second node
        for (const e of predecessorEdges) {
          newEdges.push({
            id: `edge_${e.from}_${secondNodeId}`,
            from: e.from,
            to: secondNodeId,
          });
        }

        // Second node -> first node (reversed direction)
        newEdges.push({
          id: `edge_${secondNodeId}_${firstNodeId}`,
          from: secondNodeId,
          to: firstNodeId,
        });

        // First node -> successors
        for (const e of successorEdges) {
          newEdges.push({
            id: `edge_${firstNodeId}_${e.to}`,
            from: firstNodeId,
            to: e.to,
          });
        }

        return {
          ...data,
          edges: newEdges,
        };
      }),
    })),

  // Get adjacent node IDs (for move up/down)
  getAdjacentNodeIds: (nodeId, planId) => {
    const state = get();
    const index = findPlanIndex(state.plans, planId);
    if (index < 0) return { prevNodeId: null, nextNodeId: null };

    const { edges } = state.plans[index];

    // Find the node that points TO this node (predecessor)
    const predecessorEdge = edges.find(e => e.to === nodeId);
    const prevNodeId = predecessorEdge?.from || null;

    // Find the node that this node points TO (successor)
    const successorEdge = edges.find(e => e.from === nodeId);
    const nextNodeId = successorEdge?.to || null;

    return { prevNodeId, nextNodeId };
  },

  // Insert before
  pendingInsertBefore: null,

  setPendingInsertBefore: (beforeNodeId) =>
    set({ pendingInsertBefore: beforeNodeId ? { beforeNodeId } : null }),
}));
