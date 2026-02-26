import { FolderOpen, X, History } from 'lucide-react';
import { useMultiProjectStore, ProjectTab } from '@/stores/multi-project-store';
import { motion, AnimatePresence } from 'framer-motion';

interface TabProps {
  tab: ProjectTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}

function Tab({ tab, isActive, onActivate, onClose }: TabProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={`
        group flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer
        transition-colors relative
        ${isActive
          ? 'bg-surface text-text-primary border-t border-l border-r border-border'
          : 'bg-surface-raised/50 text-text-secondary hover:text-text-primary hover:bg-surface-raised'
        }
      `}
      onClick={onActivate}
    >
      <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="text-xs font-medium truncate max-w-[120px]">
        {tab.projectName}
      </span>

      {/* Unread badge */}
      {tab.unreadUpdates > 0 && !isActive && (
        <span className="px-1.5 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue text-[10px] font-medium">
          {tab.unreadUpdates > 9 ? '9+' : tab.unreadUpdates}
        </span>
      )}

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="
          opacity-0 group-hover:opacity-100
          ml-1 p-0.5 rounded hover:bg-border/50
          transition-opacity
        "
      >
        <X className="w-3 h-3" />
      </button>

      {/* Active indicator line */}
      {isActive && (
        <motion.div
          layoutId="activeTabIndicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue"
        />
      )}
    </motion.div>
  );
}

export function TabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    removeTab,
    isHistoryPanelOpen,
    toggleHistoryPanel,
  } = useMultiProjectStore();

  // Don't render if no tabs or only one tab
  if (tabs.length <= 1) {
    return null;
  }

  return (
    <div className="h-8 bg-surface-raised/30 border-b border-border flex items-end px-2 gap-1 overflow-x-auto">
      <AnimatePresence mode="popLayout">
        {tabs.map((tab) => (
          <Tab
            key={tab.projectId}
            tab={tab}
            isActive={tab.projectId === activeTabId}
            onActivate={() => setActiveTab(tab.projectId)}
            onClose={() => removeTab(tab.projectId)}
          />
        ))}
      </AnimatePresence>

      {/* Spacer */}
      <div className="flex-1" />

      {/* History button */}
      <button
        onClick={toggleHistoryPanel}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded text-xs
          transition-colors mb-1
          ${isHistoryPanelOpen
            ? 'bg-accent-blue/20 text-accent-blue'
            : 'text-text-muted hover:text-text-secondary hover:bg-surface-raised'
          }
        `}
        title="View History"
      >
        <History className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">History</span>
      </button>
    </div>
  );
}
