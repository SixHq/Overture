import { X, Plus, Minus, Edit3, ArrowRight, GitCompare } from 'lucide-react';
import { useMultiProjectStore, PlanNode, PlanEdge } from '@/stores/multi-project-store';
import { motion, AnimatePresence } from 'framer-motion';

interface DiffSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  children: React.ReactNode;
}

function DiffSection({ title, icon, count, color, children }: DiffSectionProps) {
  if (count === 0) return null;

  return (
    <div className="mb-4">
      <div className={`flex items-center gap-2 mb-2 text-sm font-medium ${color}`}>
        {icon}
        <span>{title}</span>
        <span className="text-xs text-text-muted">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface NodeDiffItemProps {
  node: PlanNode;
  type: 'added' | 'removed';
}

function NodeDiffItem({ node, type }: NodeDiffItemProps) {
  const bgColor = type === 'added' ? 'bg-accent-green/10 border-accent-green/30' : 'bg-accent-red/10 border-accent-red/30';
  const icon = type === 'added' ? <Plus className="w-3 h-3 text-accent-green" /> : <Minus className="w-3 h-3 text-accent-red" />;

  return (
    <div className={`p-2 rounded border ${bgColor}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-text-primary">{node.title}</span>
        <span className="text-xs text-text-muted">({node.type})</span>
      </div>
      {node.description && (
        <p className="text-xs text-text-muted mt-1 ml-5 line-clamp-2">{node.description}</p>
      )}
    </div>
  );
}

interface ModifiedNodeItemProps {
  before: PlanNode;
  after: PlanNode;
}

function ModifiedNodeItem({ before, after }: ModifiedNodeItemProps) {
  const changes: string[] = [];

  if (before.title !== after.title) changes.push('title');
  if (before.description !== after.description) changes.push('description');
  if (before.complexity !== after.complexity) changes.push('complexity');
  if (before.type !== after.type) changes.push('type');
  if (before.dynamicFields.length !== after.dynamicFields.length) changes.push('fields');
  if (before.branches?.length !== after.branches?.length) changes.push('branches');

  return (
    <div className="p-2 rounded border bg-accent-yellow/10 border-accent-yellow/30">
      <div className="flex items-center gap-2">
        <Edit3 className="w-3 h-3 text-accent-yellow" />
        <span className="text-sm font-medium text-text-primary">{after.title}</span>
      </div>
      <div className="flex items-center gap-2 mt-1 ml-5">
        <span className="text-xs text-text-muted">Changed:</span>
        {changes.map((change) => (
          <span key={change} className="text-xs px-1.5 py-0.5 bg-accent-yellow/20 rounded text-accent-yellow">
            {change}
          </span>
        ))}
      </div>
      {before.title !== after.title && (
        <div className="flex items-center gap-2 mt-1 ml-5 text-xs text-text-muted">
          <span className="line-through">{before.title}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="text-text-primary">{after.title}</span>
        </div>
      )}
    </div>
  );
}

interface EdgeDiffItemProps {
  edge: PlanEdge;
  type: 'added' | 'removed';
}

function EdgeDiffItem({ edge, type }: EdgeDiffItemProps) {
  const color = type === 'added' ? 'text-accent-green' : 'text-accent-red';
  const icon = type === 'added' ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />;

  return (
    <div className={`flex items-center gap-2 text-xs ${color}`}>
      {icon}
      <span>{edge.from}</span>
      <ArrowRight className="w-3 h-3" />
      <span>{edge.to}</span>
    </div>
  );
}

interface PlanDiffPanelProps {
  onClose?: () => void;
}

export function PlanDiffPanel({ onClose }: PlanDiffPanelProps) {
  const { currentDiff, showDiffView, setShowDiffView, setCurrentDiff } = useMultiProjectStore();

  const handleClose = () => {
    setShowDiffView(false);
    setCurrentDiff(null);
    onClose?.();
  };

  if (!showDiffView || !currentDiff) return null;

  const totalChanges =
    currentDiff.addedNodes.length +
    currentDiff.removedNodes.length +
    currentDiff.modifiedNodes.length +
    currentDiff.addedEdges.length +
    currentDiff.removedEdges.length;

  return (
    <AnimatePresence>
      {showDiffView && (
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="
            fixed left-0 top-14 bottom-0 w-80 z-40
            bg-surface border-r border-border
            flex flex-col
            shadow-xl
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-medium text-text-primary flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Plan Changes
              <span className="text-xs text-text-muted">({totalChanges})</span>
            </h2>
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-surface-raised transition-colors"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {totalChanges === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <GitCompare className="w-12 h-12 text-text-muted/30 mb-3" />
                <p className="text-sm text-text-muted">No changes detected</p>
              </div>
            ) : (
              <>
                {/* Added Nodes */}
                <DiffSection
                  title="Added Nodes"
                  icon={<Plus className="w-4 h-4" />}
                  count={currentDiff.addedNodes.length}
                  color="text-accent-green"
                >
                  {currentDiff.addedNodes.map((node) => (
                    <NodeDiffItem key={node.id} node={node} type="added" />
                  ))}
                </DiffSection>

                {/* Removed Nodes */}
                <DiffSection
                  title="Removed Nodes"
                  icon={<Minus className="w-4 h-4" />}
                  count={currentDiff.removedNodes.length}
                  color="text-accent-red"
                >
                  {currentDiff.removedNodes.map((node) => (
                    <NodeDiffItem key={node.id} node={node} type="removed" />
                  ))}
                </DiffSection>

                {/* Modified Nodes */}
                <DiffSection
                  title="Modified Nodes"
                  icon={<Edit3 className="w-4 h-4" />}
                  count={currentDiff.modifiedNodes.length}
                  color="text-accent-yellow"
                >
                  {currentDiff.modifiedNodes.map(({ before, after }) => (
                    <ModifiedNodeItem key={after.id} before={before} after={after} />
                  ))}
                </DiffSection>

                {/* Edge Changes */}
                {(currentDiff.addedEdges.length > 0 || currentDiff.removedEdges.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                      Connection Changes
                    </h3>

                    {currentDiff.addedEdges.length > 0 && (
                      <div className="mb-2">
                        {currentDiff.addedEdges.map((edge) => (
                          <EdgeDiffItem key={edge.id} edge={edge} type="added" />
                        ))}
                      </div>
                    )}

                    {currentDiff.removedEdges.length > 0 && (
                      <div>
                        {currentDiff.removedEdges.map((edge) => (
                          <EdgeDiffItem key={edge.id} edge={edge} type="removed" />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border">
            <p className="text-[10px] text-text-muted text-center mb-2">
              Review changes before approving the updated plan
            </p>
            <button
              onClick={handleClose}
              className="w-full py-2 px-4 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
            >
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
