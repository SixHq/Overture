import { PlanNode, PlanEdge, PlanDiff } from '../types.js';

/**
 * Calculate the diff between two plan versions
 */
export function calculatePlanDiff(
  oldPlan: { nodes: PlanNode[]; edges: PlanEdge[] },
  newPlan: { nodes: PlanNode[]; edges: PlanEdge[] }
): PlanDiff {
  const oldNodeMap = new Map(oldPlan.nodes.map(n => [n.id, n]));
  const newNodeMap = new Map(newPlan.nodes.map(n => [n.id, n]));

  const addedNodes: PlanNode[] = [];
  const removedNodes: PlanNode[] = [];
  const modifiedNodes: Array<{ before: PlanNode; after: PlanNode }> = [];

  // Find added and modified nodes
  for (const [nodeId, newNode] of newNodeMap) {
    const oldNode = oldNodeMap.get(nodeId);
    if (!oldNode) {
      addedNodes.push(newNode);
    } else if (!nodesAreEqual(oldNode, newNode)) {
      modifiedNodes.push({ before: oldNode, after: newNode });
    }
  }

  // Find removed nodes
  for (const [nodeId, oldNode] of oldNodeMap) {
    if (!newNodeMap.has(nodeId)) {
      removedNodes.push(oldNode);
    }
  }

  // Calculate edge diff
  const oldEdgeSet = new Set(oldPlan.edges.map(e => `${e.from}->${e.to}`));
  const newEdgeSet = new Set(newPlan.edges.map(e => `${e.from}->${e.to}`));

  const addedEdges = newPlan.edges.filter(e => !oldEdgeSet.has(`${e.from}->${e.to}`));
  const removedEdges = oldPlan.edges.filter(e => !newEdgeSet.has(`${e.from}->${e.to}`));

  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedEdges,
    removedEdges,
  };
}

/**
 * Check if two nodes are equal (for diff purposes)
 */
function nodesAreEqual(a: PlanNode, b: PlanNode): boolean {
  // Compare key fields that matter for diff
  if (a.title !== b.title) return false;
  if (a.description !== b.description) return false;
  if (a.type !== b.type) return false;
  if (a.complexity !== b.complexity) return false;
  if (a.expectedOutput !== b.expectedOutput) return false;
  if (a.risks !== b.risks) return false;

  // Compare dynamic fields
  if (a.dynamicFields.length !== b.dynamicFields.length) return false;
  for (let i = 0; i < a.dynamicFields.length; i++) {
    const fieldA = a.dynamicFields[i];
    const fieldB = b.dynamicFields.find(f => f.id === fieldA.id);
    if (!fieldB) return false;
    if (fieldA.name !== fieldB.name) return false;
    if (fieldA.type !== fieldB.type) return false;
    if (fieldA.title !== fieldB.title) return false;
    if (fieldA.required !== fieldB.required) return false;
  }

  // Compare branches (for decision nodes)
  if (a.branches?.length !== b.branches?.length) return false;
  if (a.branches && b.branches) {
    for (let i = 0; i < a.branches.length; i++) {
      const branchA = a.branches[i];
      const branchB = b.branches.find(br => br.id === branchA.id);
      if (!branchB) return false;
      if (branchA.label !== branchB.label) return false;
      if (branchA.description !== branchB.description) return false;
    }
  }

  return true;
}

/**
 * Check if a diff has any changes
 */
export function hasDiffChanges(diff: PlanDiff): boolean {
  return (
    diff.addedNodes.length > 0 ||
    diff.removedNodes.length > 0 ||
    diff.modifiedNodes.length > 0 ||
    diff.addedEdges.length > 0 ||
    diff.removedEdges.length > 0
  );
}

/**
 * Get a human-readable summary of the diff
 */
export function getDiffSummary(diff: PlanDiff): string {
  const parts: string[] = [];

  if (diff.addedNodes.length > 0) {
    parts.push(`${diff.addedNodes.length} node(s) added`);
  }
  if (diff.removedNodes.length > 0) {
    parts.push(`${diff.removedNodes.length} node(s) removed`);
  }
  if (diff.modifiedNodes.length > 0) {
    parts.push(`${diff.modifiedNodes.length} node(s) modified`);
  }
  if (diff.addedEdges.length > 0) {
    parts.push(`${diff.addedEdges.length} connection(s) added`);
  }
  if (diff.removedEdges.length > 0) {
    parts.push(`${diff.removedEdges.length} connection(s) removed`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No changes';
}
