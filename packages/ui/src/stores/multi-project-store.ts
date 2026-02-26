import { create } from 'zustand';
import { Plan, PlanNode, PlanEdge, NodeConfig, FileAttachment } from './plan-store';

// Re-export types
export type { Plan, PlanNode, PlanEdge };

/**
 * Project context information
 */
export interface ProjectContext {
  projectId: string;
  workspacePath: string;
  projectName: string;
  agentType: string;
}

/**
 * History entry for plan listing
 */
export interface HistoryEntry {
  id: string;
  projectId: string;
  workspacePath: string;
  projectName: string;
  title: string;
  agent: string;
  status: Plan['status'];
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  completedNodeCount: number;
}

/**
 * Complete persisted plan with all data
 */
export interface PersistedPlan {
  plan: Plan & { projectId: string; workspacePath: string };
  nodes: PlanNode[];
  edges: PlanEdge[];
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, NodeConfig>;
}

/**
 * Project tab in the UI
 */
export interface ProjectTab {
  projectId: string;
  projectName: string;
  workspacePath: string;
  isActive: boolean;
  unreadUpdates: number;
  // Plans for this project (supports multiple plans on same canvas)
  plans: Plan[];
}

/**
 * Per-project plan data
 */
export interface ProjectPlanData {
  plan: Plan | null;
  nodes: PlanNode[];
  edges: PlanEdge[];
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, NodeConfig>;
}

/**
 * Plan diff for showing changes between plan versions
 */
export interface PlanDiff {
  addedNodes: PlanNode[];
  removedNodes: PlanNode[];
  modifiedNodes: Array<{ before: PlanNode; after: PlanNode }>;
  addedEdges: PlanEdge[];
  removedEdges: PlanEdge[];
}

interface MultiProjectState {
  // Tabs
  tabs: ProjectTab[];
  activeTabId: string | null;

  // Per-project data
  projectData: Map<string, ProjectPlanData>;

  // History
  historyEntries: HistoryEntry[];
  isHistoryPanelOpen: boolean;

  // Diff view state
  previousPlanData: Map<string, ProjectPlanData>;
  currentDiff: PlanDiff | null;
  showDiffView: boolean;

  // Tab actions
  addTab: (project: ProjectContext) => void;
  removeTab: (projectId: string) => void;
  setActiveTab: (projectId: string) => void;
  updateTabUnread: (projectId: string, count: number) => void;
  incrementTabUnread: (projectId: string) => void;

  // Project data actions
  initProjectData: (projectId: string) => void;
  setProjectPlan: (projectId: string, plan: Plan) => void;
  addProjectNode: (projectId: string, node: PlanNode) => void;
  addProjectEdge: (projectId: string, edge: PlanEdge) => void;
  updateProjectPlanStatus: (projectId: string, status: Plan['status']) => void;
  updateProjectNodeStatus: (projectId: string, nodeId: string, status: PlanNode['status'], output?: string) => void;
  setProjectFieldValue: (projectId: string, nodeId: string, fieldId: string, value: string) => void;
  setProjectSelectedBranch: (projectId: string, nodeId: string, branchId: string) => void;
  setProjectNodeConfig: (projectId: string, nodeId: string, config: Partial<NodeConfig>) => void;
  clearProjectData: (projectId: string) => void;

  // History actions
  setHistoryEntries: (entries: HistoryEntry[]) => void;
  loadPlanFromHistory: (plan: PersistedPlan) => void;
  toggleHistoryPanel: () => void;

  // Diff view actions
  setPreviousPlanData: (projectId: string, data: ProjectPlanData) => void;
  setCurrentDiff: (diff: PlanDiff | null) => void;
  setShowDiffView: (show: boolean) => void;

  // Helpers
  getActiveProjectData: () => ProjectPlanData | null;
  getProjectData: (projectId: string) => ProjectPlanData | null;
  hasMultipleTabs: () => boolean;
}

const createEmptyProjectData = (): ProjectPlanData => ({
  plan: null,
  nodes: [],
  edges: [],
  fieldValues: {},
  selectedBranches: {},
  nodeConfigs: {},
});

export const useMultiProjectStore = create<MultiProjectState>((set, get) => ({
  // Initial state
  tabs: [],
  activeTabId: null,
  projectData: new Map(),
  historyEntries: [],
  isHistoryPanelOpen: false,
  previousPlanData: new Map(),
  currentDiff: null,
  showDiffView: false,

  // Tab actions
  addTab: (project) =>
    set((state) => {
      // Check if tab already exists
      const existingTab = state.tabs.find((t) => t.projectId === project.projectId);
      if (existingTab) {
        // Just activate the existing tab
        return {
          tabs: state.tabs.map((t) => ({
            ...t,
            isActive: t.projectId === project.projectId,
          })),
          activeTabId: project.projectId,
        };
      }

      // Create new tab
      const newTab: ProjectTab = {
        projectId: project.projectId,
        projectName: project.projectName,
        workspacePath: project.workspacePath,
        isActive: true,
        unreadUpdates: 0,
        plans: [],
      };

      // Deactivate other tabs and add new one
      return {
        tabs: [
          ...state.tabs.map((t) => ({ ...t, isActive: false })),
          newTab,
        ],
        activeTabId: project.projectId,
      };
    }),

  removeTab: (projectId) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.projectId !== projectId);
      const newProjectData = new Map(state.projectData);
      newProjectData.delete(projectId);

      // If we removed the active tab, activate the last remaining tab
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === projectId) {
        newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].projectId : null;
        if (newActiveTabId) {
          newTabs.forEach((t) => {
            t.isActive = t.projectId === newActiveTabId;
          });
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
        projectData: newProjectData,
      };
    }),

  setActiveTab: (projectId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => ({
        ...t,
        isActive: t.projectId === projectId,
        unreadUpdates: t.projectId === projectId ? 0 : t.unreadUpdates,
      })),
      activeTabId: projectId,
    })),

  updateTabUnread: (projectId, count) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.projectId === projectId ? { ...t, unreadUpdates: count } : t
      ),
    })),

  incrementTabUnread: (projectId) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.projectId === projectId && !t.isActive
          ? { ...t, unreadUpdates: t.unreadUpdates + 1 }
          : t
      ),
    })),

  // Project data actions
  initProjectData: (projectId) =>
    set((state) => {
      if (state.projectData.has(projectId)) {
        return state;
      }
      const newProjectData = new Map(state.projectData);
      newProjectData.set(projectId, createEmptyProjectData());
      return { projectData: newProjectData };
    }),

  setProjectPlan: (projectId, plan) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      const existing = newProjectData.get(projectId) || createEmptyProjectData();

      // Only clear nodes/edges if this is a DIFFERENT plan ID (new plan)
      // If same plan ID, preserve existing nodes/edges (plan update)
      const isSamePlan = existing.plan?.id === plan.id;

      newProjectData.set(projectId, {
        ...existing,
        plan,
        // Preserve nodes/edges if updating same plan, clear if new plan
        nodes: isSamePlan ? existing.nodes : [],
        edges: isSamePlan ? existing.edges : [],
        fieldValues: isSamePlan ? existing.fieldValues : {},
        selectedBranches: isSamePlan ? existing.selectedBranches : {},
        nodeConfigs: isSamePlan ? existing.nodeConfigs : {},
      });

      // Also update the tab's plans list
      const newTabs = state.tabs.map((t) =>
        t.projectId === projectId
          ? { ...t, plans: [...t.plans.filter((p) => p.id !== plan.id), plan] }
          : t
      );

      return { projectData: newProjectData, tabs: newTabs };
    }),

  addProjectNode: (projectId, node) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      const existing = newProjectData.get(projectId) || createEmptyProjectData();

      // Check for duplicate - don't add if node already exists
      const nodeExists = existing.nodes.some((n) => n.id === node.id);
      if (nodeExists) {
        // Update existing node instead
        newProjectData.set(projectId, {
          ...existing,
          nodes: existing.nodes.map((n) =>
            n.id === node.id ? { ...node, attachments: node.attachments || [] } : n
          ),
        });
      } else {
        newProjectData.set(projectId, {
          ...existing,
          nodes: [...existing.nodes, { ...node, attachments: node.attachments || [] }],
        });
      }
      return { projectData: newProjectData };
    }),

  addProjectEdge: (projectId, edge) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      const existing = newProjectData.get(projectId) || createEmptyProjectData();

      // Check for duplicate - don't add if edge already exists
      const edgeExists = existing.edges.some((e) => e.id === edge.id);
      if (edgeExists) {
        return { projectData: newProjectData }; // No change
      }

      newProjectData.set(projectId, {
        ...existing,
        edges: [...existing.edges, edge],
      });
      return { projectData: newProjectData };
    }),

  updateProjectPlanStatus: (projectId, status) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      const existing = newProjectData.get(projectId);
      if (existing?.plan) {
        newProjectData.set(projectId, {
          ...existing,
          plan: { ...existing.plan, status },
        });
      }
      return { projectData: newProjectData };
    }),

  updateProjectNodeStatus: (projectId, nodeId, status, output) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      const existing = newProjectData.get(projectId);
      if (existing) {
        newProjectData.set(projectId, {
          ...existing,
          nodes: existing.nodes.map((n) =>
            n.id === nodeId ? { ...n, status, output: output ?? n.output } : n
          ),
        });
      }
      return { projectData: newProjectData };
    }),

  setProjectFieldValue: (projectId, nodeId, fieldId, value) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      const existing = newProjectData.get(projectId);
      if (existing) {
        newProjectData.set(projectId, {
          ...existing,
          fieldValues: {
            ...existing.fieldValues,
            [`${nodeId}:${fieldId}`]: value,
          },
          nodes: existing.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  dynamicFields: n.dynamicFields.map((f) =>
                    f.id === fieldId ? { ...f, value } : f
                  ),
                }
              : n
          ),
        });
      }
      return { projectData: newProjectData };
    }),

  setProjectSelectedBranch: (projectId, nodeId, branchId) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      const existing = newProjectData.get(projectId);
      if (existing) {
        newProjectData.set(projectId, {
          ...existing,
          selectedBranches: {
            ...existing.selectedBranches,
            [nodeId]: branchId,
          },
          nodes: existing.nodes.map((n) =>
            n.id === nodeId ? { ...n, selectedBranchId: branchId } : n
          ),
        });
      }
      return { projectData: newProjectData };
    }),

  setProjectNodeConfig: (projectId, nodeId, config) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      const existing = newProjectData.get(projectId);
      if (existing) {
        const existingConfig = existing.nodeConfigs[nodeId] || { fieldValues: {}, attachments: [] };
        newProjectData.set(projectId, {
          ...existing,
          nodeConfigs: {
            ...existing.nodeConfigs,
            [nodeId]: { ...existingConfig, ...config },
          },
        });
      }
      return { projectData: newProjectData };
    }),

  clearProjectData: (projectId) =>
    set((state) => {
      const newProjectData = new Map(state.projectData);
      newProjectData.set(projectId, createEmptyProjectData());
      return { projectData: newProjectData };
    }),

  // History actions
  setHistoryEntries: (entries) =>
    set((state) => {
      // Only update if entries actually changed (prevents UI flickering from polling)
      const currentJson = JSON.stringify(state.historyEntries);
      const newJson = JSON.stringify(entries);
      if (currentJson === newJson) {
        return state;
      }
      return { historyEntries: entries };
    }),

  loadPlanFromHistory: (persistedPlan) =>
    set((state) => {
      const projectId = persistedPlan.plan.projectId;

      // Initialize project data
      const newProjectData = new Map(state.projectData);
      newProjectData.set(projectId, {
        plan: persistedPlan.plan,
        nodes: persistedPlan.nodes,
        edges: persistedPlan.edges,
        fieldValues: persistedPlan.fieldValues,
        selectedBranches: persistedPlan.selectedBranches,
        nodeConfigs: persistedPlan.nodeConfigs,
      });

      // Add or activate tab
      const existingTabIndex = state.tabs.findIndex((t) => t.projectId === projectId);
      let newTabs = state.tabs;

      if (existingTabIndex >= 0) {
        newTabs = state.tabs.map((t) => ({
          ...t,
          isActive: t.projectId === projectId,
        }));
      } else {
        const newTab: ProjectTab = {
          projectId,
          projectName: persistedPlan.plan.workspacePath.split('/').pop() || projectId,
          workspacePath: persistedPlan.plan.workspacePath,
          isActive: true,
          unreadUpdates: 0,
          plans: [persistedPlan.plan],
        };
        newTabs = [
          ...state.tabs.map((t) => ({ ...t, isActive: false })),
          newTab,
        ];
      }

      return {
        projectData: newProjectData,
        tabs: newTabs,
        activeTabId: projectId,
      };
    }),

  toggleHistoryPanel: () =>
    set((state) => ({ isHistoryPanelOpen: !state.isHistoryPanelOpen })),

  // Diff view actions
  setPreviousPlanData: (projectId, data) =>
    set((state) => {
      const newPreviousPlanData = new Map(state.previousPlanData);
      newPreviousPlanData.set(projectId, data);
      return { previousPlanData: newPreviousPlanData };
    }),

  setCurrentDiff: (diff) =>
    set({ currentDiff: diff }),

  setShowDiffView: (show) =>
    set({ showDiffView: show }),

  // Helpers
  getActiveProjectData: () => {
    const state = get();
    if (!state.activeTabId) return null;
    return state.projectData.get(state.activeTabId) || null;
  },

  getProjectData: (projectId) => {
    return get().projectData.get(projectId) || null;
  },

  hasMultipleTabs: () => {
    return get().tabs.length > 1;
  },
}));

// Re-export NodeConfig for convenience
export type { NodeConfig, FileAttachment };
