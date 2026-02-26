import { useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlanStore } from '@/stores/plan-store';

interface InsertableEdgeData {
  isActiveEdge?: boolean;
  isExecutedEdge?: boolean;
  isDisabledEdge?: boolean;
  isUnexecutedEdge?: boolean;
}

export function InsertableEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  source,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { plan, setPendingInsert } = usePlanStore();

  // Cast data to our interface
  const edgeData = (data || {}) as InsertableEdgeData;

  // Get edge path using smoothstep
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Only allow insertion when plan is ready (not executing)
  const canInsert = plan?.status === 'ready' && !edgeData.isDisabledEdge;

  const handleInsertClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canInsert && source) {
      setPendingInsert(source);
    }
  }, [canInsert, source, setPendingInsert]);

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={20}
        className={edgeData.isActiveEdge ? 'edge-active-pulse' : ''}
      />

      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: canInsert ? 'pointer' : 'default' }}
      />

      {/* Plus button */}
      <EdgeLabelRenderer>
        <AnimatePresence>
          {isHovered && canInsert && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan"
            >
              <button
                onClick={handleInsertClick}
                className="w-7 h-7 rounded-full bg-accent-blue text-white
                         flex items-center justify-center shadow-lg
                         hover:bg-accent-blue/90 hover:scale-110
                         transition-all duration-150 border-2 border-canvas"
                title="Insert node here"
              >
                <Plus className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </EdgeLabelRenderer>
    </>
  );
}
