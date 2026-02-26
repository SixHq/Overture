import React from 'react';
import { X, FolderOpen, Clock, CheckCircle, XCircle, Loader2, Pause, Filter } from 'lucide-react';
import { useMultiProjectStore, HistoryEntry } from '@/stores/multi-project-store';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';

interface HistoryItemProps {
  entry: HistoryEntry;
  onLoad: () => void;
}

function HistoryItem({ entry, onLoad }: HistoryItemProps) {
  const getStatusIcon = () => {
    switch (entry.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-accent-green" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-accent-red" />;
      case 'executing':
        return <Loader2 className="w-4 h-4 text-accent-yellow animate-spin" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-accent-orange" />;
      default:
        return <Clock className="w-4 h-4 text-text-muted" />;
    }
  };

  const getStatusColor = () => {
    switch (entry.status) {
      case 'completed':
        return 'border-accent-green/30';
      case 'failed':
        return 'border-accent-red/30';
      case 'executing':
        return 'border-accent-yellow/30';
      case 'paused':
        return 'border-accent-orange/30';
      default:
        return 'border-border';
    }
  };

  const progress = entry.nodeCount > 0
    ? Math.round((entry.completedNodeCount / entry.nodeCount) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        p-3 rounded-lg border bg-surface-raised/50
        hover:bg-surface-raised cursor-pointer transition-colors
        ${getStatusColor()}
      `}
      onClick={onLoad}
    >
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-text-primary truncate">
            {entry.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <FolderOpen className="w-3 h-3 text-text-muted flex-shrink-0" />
            <span className="text-xs text-text-muted truncate">
              {entry.projectName}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-text-muted">
              {entry.agent}
            </span>
            <span className="text-xs text-text-muted">
              {formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true })}
            </span>
          </div>
          {/* Progress bar */}
          {entry.nodeCount > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                <span>{entry.completedNodeCount}/{entry.nodeCount} nodes</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    entry.status === 'completed'
                      ? 'bg-accent-green'
                      : entry.status === 'failed'
                        ? 'bg-accent-red'
                        : 'bg-accent-blue'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface HistoryPanelProps {
  onLoadPlan?: (planId: string) => void;
}

export function HistoryPanel({ onLoadPlan }: HistoryPanelProps) {
  const {
    historyEntries,
    isHistoryPanelOpen,
    toggleHistoryPanel,
    activeTabId,
  } = useMultiProjectStore();

  // State for filtering by current project (defaults to showing all history)
  const [filterByProject, setFilterByProject] = React.useState(false);

  // Filter entries by active project only if toggle is on
  const filteredEntries = filterByProject && activeTabId
    ? historyEntries.filter(e => e.projectId === activeTabId)
    : historyEntries;

  // Group entries by date
  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const date = format(new Date(entry.updatedAt), 'MMM d, yyyy');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, HistoryEntry[]>);

  const handleLoadPlan = (planId: string) => {
    if (onLoadPlan) {
      onLoadPlan(planId);
    }
  };

  return (
    <AnimatePresence>
      {isHistoryPanelOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="
            fixed right-0 top-14 bottom-0 w-80 z-40
            bg-surface border-l border-border
            flex flex-col
            shadow-xl
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-medium text-text-primary flex items-center gap-2">
              <Clock className="w-4 h-4" />
              History
            </h2>
            <div className="flex items-center gap-2">
              {/* Filter by project toggle */}
              {activeTabId && (
                <button
                  onClick={() => setFilterByProject(!filterByProject)}
                  className={`p-1.5 rounded transition-colors ${
                    filterByProject
                      ? 'bg-accent-blue/20 text-accent-blue'
                      : 'hover:bg-surface-raised text-text-muted'
                  }`}
                  title={filterByProject ? 'Showing current project only' : 'Showing all projects'}
                >
                  <Filter className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={toggleHistoryPanel}
                className="p-1 rounded hover:bg-surface-raised transition-colors"
              >
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Clock className="w-12 h-12 text-text-muted/30 mb-3" />
                <p className="text-sm text-text-muted">No history yet</p>
                <p className="text-xs text-text-muted/70 mt-1">
                  Plans you create will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedEntries).map(([date, entries]) => (
                  <div key={date}>
                    <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                      {date}
                    </h3>
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {entries.map((entry) => (
                          <HistoryItem
                            key={entry.id}
                            entry={entry}
                            onLoad={() => handleLoadPlan(entry.id)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with filter info */}
          <div className="px-4 py-2 border-t border-border">
            <p className="text-[10px] text-text-muted text-center">
              {filterByProject && activeTabId
                ? `Showing ${filteredEntries.length} plan(s) for current project`
                : `Showing all ${historyEntries.length} plan(s)`}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
