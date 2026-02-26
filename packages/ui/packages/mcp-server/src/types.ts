// Plan types matching the UI store
export type NodeStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
export type NodeType = 'task' | 'decision';
export type FieldType = 'string' | 'secret' | 'select' | 'boolean' | 'number' | 'file';

export interface DynamicField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  title: string;
  description: string;
  value?: string;
  options?: string;
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
  output?: string;
  attachments?: FileAttachment[];
  metaInstructions?: string;
  mcpServers?: McpServer[];
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
}

export interface NodeConfig {
  fieldValues: Record<string, string>;
  attachments: FileAttachment[];
  metaInstructions?: string;
  mcpServers?: McpServer[];
}

export interface PlanState {
  plan: Plan | null;
  nodes: PlanNode[];
  edges: PlanEdge[];
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, NodeConfig>; // nodeId -> config
}

// Project identification for multi-project support
export interface ProjectContext {
  projectId: string;        // Hash of workspace path for uniqueness
  workspacePath: string;    // Absolute path: /Users/dev/my-project
  projectName: string;      // Display name: my-project
  agentType: string;        // claude-code, cline, cursor, sixth, etc.
}

// Extended Plan with project context
export interface PlanWithProject extends Plan {
  projectId: string;
  workspacePath: string;
}

// History entry for plan listing (lightweight)
export interface HistoryEntry {
  id: string;               // plan.id
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

// Complete persisted plan with all data
export interface PersistedPlan {
  plan: PlanWithProject;
  nodes: PlanNode[];
  edges: PlanEdge[];
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, NodeConfig>;
}

// Plan diff for showing changes between plan versions
export interface PlanDiff {
  addedNodes: PlanNode[];
  removedNodes: PlanNode[];
  modifiedNodes: Array<{ before: PlanNode; after: PlanNode }>;
  addedEdges: PlanEdge[];
  removedEdges: PlanEdge[];
}

// History file structure (stored at ~/.overture/history.json)
export interface HistoryFile {
  version: 1;
  lastUpdated: string;
  entries: HistoryEntry[];
  plans: Record<string, PersistedPlan>;  // planId -> full plan data
}

// Resume plan information - sent when resuming execution
export interface ResumePlanInfo {
  // Plan metadata
  planId: string;
  planTitle: string;
  agent: string;
  status: Plan['status'];
  projectId: string;
  workspacePath: string;

  // Execution state
  currentNodeId: string | null;       // The node where execution stopped (last active/failed)
  currentNodeTitle: string | null;
  currentNodeStatus: NodeStatus | null;

  // Progress
  completedNodes: Array<{
    id: string;
    title: string;
    output?: string;
  }>;
  pendingNodes: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  failedNodes: Array<{
    id: string;
    title: string;
    output?: string;  // Error message
  }>;

  // User configurations
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, NodeConfig>;

  // Timestamps
  createdAt: string;
  pausedAt?: string;
}

// Per-project plan state
export interface ProjectPlanState extends PlanState {
  projectId: string;
  workspacePath: string;
}

// WebSocket message types
export type WSMessage =
  | { type: 'connected' }
  | { type: 'plan_started'; plan: Plan; projectId?: string }
  | { type: 'node_added'; node: PlanNode; projectId?: string }
  | { type: 'edge_added'; edge: PlanEdge; projectId?: string }
  | { type: 'plan_ready'; projectId?: string }
  | { type: 'node_status_updated'; nodeId: string; status: NodeStatus; output?: string; projectId?: string }
  | { type: 'plan_completed'; projectId?: string }
  | { type: 'plan_failed'; error: string; projectId?: string }
  | { type: 'plan_paused'; projectId?: string }
  | { type: 'plan_resumed'; projectId?: string }
  | { type: 'nodes_inserted'; nodes: PlanNode[]; edges: PlanEdge[]; removedEdgeIds: string[]; projectId?: string }
  | { type: 'node_removed'; nodeId: string; newEdges: PlanEdge[]; removedEdgeIds: string[]; projectId?: string }
  | { type: 'error'; message: string }
  // New multi-project messages
  | { type: 'project_registered'; projectId: string; projectName: string; workspacePath: string }
  | { type: 'projects_list'; projects: ProjectContext[] }
  | { type: 'history_entries'; entries: HistoryEntry[] }
  | { type: 'plan_loaded'; plan: PersistedPlan; projectId: string }
  | { type: 'resume_plan_info'; resumeInfo: ResumePlanInfo }
  | { type: 'plan_saved'; projectId: string; planId: string }
  // Plan update events
  | { type: 'plan_updated'; plan: PersistedPlan; previousPlan: PersistedPlan; diff: PlanDiff; projectId: string }
  | { type: 'new_plan_created'; planId: string; projectId: string }
  | { type: 'plan_updated_incrementally'; operationCount: number; successCount: number; failCount: number; projectId: string }
  | { type: 'node_replaced'; oldNodeId: string; node: PlanNode; projectId: string }
  // Internal relay sync
  | { type: 'approval_granted'; projectId: string; fieldValues: Record<string, string>; selectedBranches: Record<string, string>; nodeConfigs: Record<string, NodeConfig> };

export type WSClientMessage =
  | {
      type: 'approve_plan';
      fieldValues: Record<string, string>;
      selectedBranches: Record<string, string>;
      nodeConfigs: Record<string, NodeConfig>;
      projectId?: string;
    }
  | { type: 'cancel_plan'; projectId?: string }
  | { type: 'rerun_request'; nodeId: string; mode: 'single' | 'to-bottom'; projectId?: string }
  | { type: 'pause_execution'; projectId?: string }
  | { type: 'resume_execution'; projectId?: string }
  | { type: 'insert_nodes'; afterNodeId: string; nodes: PlanNode[]; edges: PlanEdge[]; projectId?: string }
  | { type: 'remove_node'; nodeId: string; projectId?: string }
  // New multi-project messages
  | { type: 'register_project'; projectContext: ProjectContext }
  | { type: 'subscribe_project'; projectId: string }
  | { type: 'unsubscribe_project'; projectId: string }
  | { type: 'get_history'; projectId?: string }
  | { type: 'load_plan'; planId: string }
  | { type: 'get_resume_info'; projectId?: string; planId?: string }
  | { type: 'save_plan'; projectId?: string }
  // Plan update events
  | { type: 'request_plan_update'; projectId?: string }
  | { type: 'create_new_plan'; projectId?: string };
