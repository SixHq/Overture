import { motion } from 'framer-motion';
import { Pause, Play, Loader2 } from 'lucide-react';
import { usePlanStore } from '@/stores/plan-store';
import { useWebSocket } from '@/hooks/useWebSocket';

export function ExecutionControls() {
  const { plan, completedCount, totalCount } = usePlanStore();
  const { pauseExecution, resumeExecution } = useWebSocket();

  const isExecuting = plan?.status === 'executing';
  const isPaused = plan?.status === 'paused';

  // Only show during execution or when paused
  if (!isExecuting && !isPaused) {
    return null;
  }

  const handleToggle = () => {
    if (isPaused) {
      resumeExecution();
    } else {
      pauseExecution();
    }
  };

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3"
      >
        {/* Execution status indicator */}
        <div className="flex items-center gap-3 px-4 py-2 bg-surface/90 backdrop-blur-sm border border-border rounded-lg">
          <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />
          <span className="text-sm text-text-primary">
            {isPaused ? 'Paused' : 'Executing'}
          </span>
          <span className="text-xs text-text-muted">
            {completedCount}/{totalCount} nodes
          </span>
        </div>

        {/* Pause/Resume button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleToggle}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm
            transition-all duration-200 shadow-lg
            ${isPaused
              ? 'bg-gradient-to-r from-accent-green to-emerald-500 text-white shadow-glow-green hover:shadow-lg'
              : 'bg-surface border border-border text-text-primary hover:bg-surface-raised'
            }`}
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4" />
              Resume Execution
            </>
          ) : (
            <>
              <Pause className="w-4 h-4" />
              Pause Execution
            </>
          )}
        </motion.button>

        {/* Hint text */}
        {isPaused ? (
          <span className="text-xs text-accent-yellow flex items-center gap-1.5">
            Agent is waiting for you to resume
          </span>
        ) : (
          <span className="text-xs text-text-muted">
            Press <kbd className="px-1 py-0.5 bg-surface rounded font-mono">Space</kbd> to pause
          </span>
        )}
      </motion.div>
    </div>
  );
}
