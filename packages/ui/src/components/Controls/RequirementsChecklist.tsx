import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, GitBranch, FormInput, ChevronRight } from 'lucide-react';
import { usePlanStore } from '@/stores/plan-store';
import { clsx } from 'clsx';

interface RequirementItem {
  id: string;
  nodeId: string;
  nodeTitle: string;
  planId: string;
  type: 'field' | 'decision';
  label: string;
  description?: string;
  isComplete: boolean;
}

export function RequirementsChecklist() {
  const { plans, setSelectedNodeId, selectedNodeId } = usePlanStore();

  // Find the most recent plan that's in 'ready' status
  const readyPlan = [...plans].reverse().find(p => p.plan.status === 'ready');

  // Only show when there's a ready plan
  if (!readyPlan) {
    return null;
  }

  const { plan, nodes, selectedBranches } = readyPlan;

  // Helper function to check if a node is in a selected branch
  // Returns true if:
  // - Node is not part of any branch (no branchParent/branchId)
  // - Node's branch is selected by its parent decision node
  const isNodeInSelectedBranch = (node: typeof nodes[0]): boolean => {
    // If node is not part of a branch, always include it
    if (!node.branchParent || !node.branchId) {
      return true;
    }

    // Check if this node's branch is selected by the parent decision node
    const selectedBranchId = selectedBranches[node.branchParent];
    return selectedBranchId === node.branchId;
  };

  // Collect all requirements
  const requirements: RequirementItem[] = [];

  for (const node of nodes) {
    // Required fields - only include if node is in a selected branch
    if (isNodeInSelectedBranch(node)) {
      for (const field of node.dynamicFields) {
        if (field.required) {
          requirements.push({
            id: `${node.id}-field-${field.id}`,
            nodeId: node.id,
            nodeTitle: node.title,
            planId: plan.id,
            type: 'field',
            label: field.title,
            description: field.description,
            isComplete: !!field.value,
          });
        }
      }
    }

    // Decision nodes - always show (they're not inside branches themselves)
    if (node.type === 'decision' && node.branches && node.branches.length > 0) {
      requirements.push({
        id: `${node.id}-decision`,
        nodeId: node.id,
        nodeTitle: node.title,
        planId: plan.id,
        type: 'decision',
        label: node.title,
        description: `Choose from ${node.branches.length} options`,
        isComplete: !!node.selectedBranchId,
      });
    }
  }

  // If no requirements, don't show anything
  if (requirements.length === 0) {
    return null;
  }

  const completedCount = requirements.filter(r => r.isComplete).length;
  const totalCount = requirements.length;
  const allComplete = completedCount === totalCount;
  const progress = (completedCount / totalCount) * 100;

  const handleItemClick = (nodeId: string, planId: string) => {
    setSelectedNodeId(nodeId, planId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed left-4 top-1/2 -translate-y-1/2 z-20 w-72"
    >
      <div className="bg-surface/95 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-surface-raised/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Requirements
            </h3>
            <span className={clsx(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              allComplete
                ? 'bg-accent-green/20 text-accent-green'
                : 'bg-accent-yellow/20 text-accent-yellow'
            )}>
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <motion.div
              className={clsx(
                'h-full rounded-full',
                allComplete ? 'bg-accent-green' : 'bg-accent-blue'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Requirements list */}
        <div className="max-h-80 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {requirements.map((req, index) => (
              <motion.button
                key={req.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handleItemClick(req.nodeId, req.planId)}
                className={clsx(
                  'w-full px-4 py-3 flex items-start gap-3 text-left',
                  'border-b border-border/50 last:border-b-0',
                  'hover:bg-surface-raised/50 transition-colors',
                  'focus:outline-none focus:bg-surface-raised/50',
                  selectedNodeId === req.nodeId && 'bg-accent-blue/10'
                )}
              >
                {/* Checkbox */}
                <div className="mt-0.5 flex-shrink-0">
                  {req.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-accent-green" />
                  ) : (
                    <Circle className="w-4 h-4 text-text-muted" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {req.type === 'field' ? (
                      <FormInput className="w-3 h-3 text-accent-blue flex-shrink-0" />
                    ) : (
                      <GitBranch className="w-3 h-3 text-accent-purple flex-shrink-0" />
                    )}
                    <span className={clsx(
                      'text-sm font-medium truncate',
                      req.isComplete
                        ? 'text-text-muted line-through'
                        : 'text-text-primary'
                    )}>
                      {req.label}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 truncate">
                    {req.nodeTitle}
                  </p>
                </div>

                {/* Arrow indicator */}
                <ChevronRight className={clsx(
                  'w-4 h-4 flex-shrink-0 transition-colors',
                  selectedNodeId === req.nodeId
                    ? 'text-accent-blue'
                    : 'text-text-muted'
                )} />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer hint */}
        {!allComplete && (
          <div className="px-4 py-2 border-t border-border bg-surface-raised/30">
            <p className="text-[10px] text-text-muted text-center">
              Click an item to open its details
            </p>
          </div>
        )}

        {/* All complete message */}
        {allComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 py-3 border-t border-border bg-accent-green/10"
          >
            <p className="text-xs text-accent-green text-center font-medium">
              All requirements complete! Ready to approve.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
