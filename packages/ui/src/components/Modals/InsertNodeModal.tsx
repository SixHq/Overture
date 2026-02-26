import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, FileText, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import { usePlanStore, PlanNode, PlanEdge, FieldType } from '@/stores/plan-store';
import { useWebSocket } from '@/hooks/useWebSocket';

interface NewFieldInput {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  title: string;
  description: string;
  options?: string;
}

interface NewFileInput {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'code' | 'document' | 'other';
  description: string;
}

interface NewNodeInput {
  id: string;
  title: string;
  description: string;
  expanded: boolean;
  fields: NewFieldInput[];
  files: NewFileInput[];
}

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'select', label: 'Dropdown' },
  { value: 'secret', label: 'Secret' },
  { value: 'file', label: 'File Path' },
];

const fileTypes: { value: NewFileInput['type']; label: string }[] = [
  { value: 'code', label: 'Code' },
  { value: 'image', label: 'Image' },
  { value: 'document', label: 'Document' },
  { value: 'other', label: 'Other' },
];

export function InsertNodeModal() {
  const { pendingInsert, setPendingInsert, nodes, edges } = usePlanStore();
  const { insertNodes } = useWebSocket();

  const createEmptyNode = (): NewNodeInput => ({
    id: `new_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: '',
    description: '',
    expanded: true,
    fields: [],
    files: [],
  });

  const [newNodes, setNewNodes] = useState<NewNodeInput[]>([createEmptyNode()]);

  const isOpen = pendingInsert !== null;

  const sourceNode = nodes.find(n => n.id === pendingInsert?.afterNodeId);
  const targetEdge = edges.find(e => e.from === pendingInsert?.afterNodeId);
  const targetNode = targetEdge ? nodes.find(n => n.id === targetEdge.to) : null;

  const handleClose = useCallback(() => {
    setPendingInsert(null);
    setNewNodes([createEmptyNode()]);
  }, [setPendingInsert]);

  const handleAddNode = useCallback(() => {
    setNewNodes(prev => [...prev, createEmptyNode()]);
  }, []);

  const handleRemoveNode = useCallback((id: string) => {
    setNewNodes(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleNodeChange = useCallback((id: string, field: keyof NewNodeInput, value: any) => {
    setNewNodes(prev => prev.map(n =>
      n.id === id ? { ...n, [field]: value } : n
    ));
  }, []);

  const toggleNodeExpanded = useCallback((id: string) => {
    setNewNodes(prev => prev.map(n =>
      n.id === id ? { ...n, expanded: !n.expanded } : n
    ));
  }, []);

  // Field management
  const addField = useCallback((nodeId: string) => {
    setNewNodes(prev => prev.map(n =>
      n.id === nodeId ? {
        ...n,
        fields: [...n.fields, {
          id: `field_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: '',
          type: 'string' as FieldType,
          required: false,
          title: '',
          description: '',
        }]
      } : n
    ));
  }, []);

  const removeField = useCallback((nodeId: string, fieldId: string) => {
    setNewNodes(prev => prev.map(n =>
      n.id === nodeId ? {
        ...n,
        fields: n.fields.filter(f => f.id !== fieldId)
      } : n
    ));
  }, []);

  const updateField = useCallback((nodeId: string, fieldId: string, updates: Partial<NewFieldInput>) => {
    setNewNodes(prev => prev.map(n =>
      n.id === nodeId ? {
        ...n,
        fields: n.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f)
      } : n
    ));
  }, []);

  // File management
  const addFile = useCallback((nodeId: string) => {
    setNewNodes(prev => prev.map(n =>
      n.id === nodeId ? {
        ...n,
        files: [...n.files, {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: '',
          path: '',
          type: 'code' as const,
          description: '',
        }]
      } : n
    ));
  }, []);

  const removeFile = useCallback((nodeId: string, fileId: string) => {
    setNewNodes(prev => prev.map(n =>
      n.id === nodeId ? {
        ...n,
        files: n.files.filter(f => f.id !== fileId)
      } : n
    ));
  }, []);

  const updateFile = useCallback((nodeId: string, fileId: string, updates: Partial<NewFileInput>) => {
    setNewNodes(prev => prev.map(n =>
      n.id === nodeId ? {
        ...n,
        files: n.files.map(f => f.id === fileId ? { ...f, ...updates } : f)
      } : n
    ));
  }, []);

  // File picker using File System Access API
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFilePicker = useCallback(async (nodeId: string, fileId: string) => {
    // Try modern File System Access API first (Chrome/Edge)
    if ('showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          multiple: false,
        });
        const file = await fileHandle.getFile();
        // Get the full path if available, otherwise use name
        const path = fileHandle.name || file.name;
        updateFile(nodeId, fileId, {
          path: path,
          name: file.name,
        });
        return;
      } catch (err) {
        // User cancelled or API not fully supported
        if ((err as Error).name !== 'AbortError') {
          console.log('File picker error, falling back to input');
        } else {
          return; // User cancelled
        }
      }
    }

    // Fallback to regular file input
    const inputId = `${nodeId}_${fileId}`;
    const input = fileInputRefs.current[inputId];
    if (input) {
      input.click();
    }
  }, [updateFile]);

  const handleFileInputChange = useCallback((nodeId: string, fileId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For regular file input, we can only get the filename, not full path
      // The user will need to provide the full path manually or we use webkitRelativePath if available
      const path = (file as any).webkitRelativePath || file.name;
      updateFile(nodeId, fileId, {
        path: path,
        name: file.name,
      });
    }
  }, [updateFile]);

  const handleInsert = useCallback(() => {
    if (!pendingInsert || newNodes.length === 0) return;

    const validNodes = newNodes.filter(n => n.title.trim());
    if (validNodes.length === 0) return;

    const planNodes: PlanNode[] = validNodes.map((n, index) => ({
      id: `inserted_${Date.now()}_${index}`,
      type: 'task' as const,
      status: 'pending' as const,
      title: n.title.trim(),
      description: n.description.trim() || `Inserted task: ${n.title.trim()}`,
      dynamicFields: n.fields.filter(f => f.name.trim()).map(f => ({
        id: f.id,
        name: f.name.trim(),
        type: f.type,
        required: f.required,
        title: f.title.trim() || f.name.trim(),
        description: f.description.trim(),
        options: f.options,
      })),
      attachments: n.files.filter(f => f.path.trim()).map(f => ({
        id: f.id,
        name: f.name.trim() || f.path.split('/').pop() || 'file',
        path: f.path.trim(),
        type: f.type,
        description: f.description.trim(),
      })),
    }));

    const newEdges: PlanEdge[] = [];

    newEdges.push({
      id: `edge_${pendingInsert.afterNodeId}_${planNodes[0].id}`,
      from: pendingInsert.afterNodeId,
      to: planNodes[0].id,
    });

    for (let i = 0; i < planNodes.length - 1; i++) {
      newEdges.push({
        id: `edge_${planNodes[i].id}_${planNodes[i + 1].id}`,
        from: planNodes[i].id,
        to: planNodes[i + 1].id,
      });
    }

    if (targetEdge) {
      newEdges.push({
        id: `edge_${planNodes[planNodes.length - 1].id}_${targetEdge.to}`,
        from: planNodes[planNodes.length - 1].id,
        to: targetEdge.to,
      });
    }

    insertNodes(pendingInsert.afterNodeId, planNodes, newEdges);
    handleClose();
  }, [pendingInsert, newNodes, targetEdge, insertNodes, handleClose]);

  const isValid = newNodes.some(n => n.title.trim());

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-text-primary">Insert Nodes</h2>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg hover:bg-surface-raised transition-colors"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            {/* Context info */}
            <div className="px-4 py-3 bg-surface-raised/50 border-b border-border shrink-0">
              <p className="text-sm text-text-secondary">
                Insert {newNodes.length === 1 ? 'a node' : `${newNodes.length} nodes`} between:
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="px-2 py-1 bg-accent-blue/10 text-accent-blue rounded-md font-medium">
                  {sourceNode?.title || 'Unknown'}
                </span>
                <span className="text-text-muted">→</span>
                <span className="px-2 py-1 bg-accent-purple/10 text-accent-purple rounded-md font-medium">
                  {targetNode?.title || 'End'}
                </span>
              </div>
            </div>

            {/* Node inputs - scrollable */}
            <div className="px-4 py-4 overflow-y-auto flex-1 space-y-4">
              {newNodes.map((node, index) => (
                <div key={node.id} className="border border-border rounded-lg overflow-hidden">
                  {/* Node header */}
                  <div
                    className="flex items-center justify-between px-3 py-2 bg-surface-raised cursor-pointer"
                    onClick={() => toggleNodeExpanded(node.id)}
                  >
                    <div className="flex items-center gap-2">
                      {node.expanded ? (
                        <ChevronUp className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      )}
                      <span className="text-sm font-medium text-text-primary">
                        Node {index + 1}{node.title && `: ${node.title}`}
                      </span>
                    </div>
                    {newNodes.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveNode(node.id);
                        }}
                        className="p-1 text-text-muted hover:text-accent-red transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Node content */}
                  {node.expanded && (
                    <div className="p-3 space-y-3">
                      {/* Basic fields */}
                      <input
                        type="text"
                        value={node.title}
                        onChange={(e) => handleNodeChange(node.id, 'title', e.target.value)}
                        placeholder="Task title (required)"
                        className="w-full px-3 py-2 bg-canvas border border-border rounded-lg
                                 text-sm text-text-primary placeholder:text-text-muted
                                 focus:outline-none focus:border-accent-blue transition-colors"
                        autoFocus={index === 0}
                      />
                      <textarea
                        value={node.description}
                        onChange={(e) => handleNodeChange(node.id, 'description', e.target.value)}
                        placeholder="Description (optional)"
                        rows={2}
                        className="w-full px-3 py-2 bg-canvas border border-border rounded-lg
                                 text-sm text-text-primary placeholder:text-text-muted
                                 focus:outline-none focus:border-accent-blue transition-colors resize-none"
                      />

                      {/* Custom Fields Section */}
                      <div className="border-t border-border pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-text-secondary">Custom Fields</span>
                          <button
                            onClick={() => addField(node.id)}
                            className="text-xs text-accent-blue hover:text-accent-blue/80 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Field
                          </button>
                        </div>

                        {node.fields.length === 0 ? (
                          <p className="text-xs text-text-muted italic">No custom fields</p>
                        ) : (
                          <div className="space-y-2">
                            {node.fields.map((field) => (
                              <div key={field.id} className="p-2 bg-canvas rounded-lg border border-border space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={field.name}
                                    onChange={(e) => updateField(node.id, field.id, { name: e.target.value })}
                                    placeholder="Field name"
                                    className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs
                                             text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
                                  />
                                  <select
                                    value={field.type}
                                    onChange={(e) => updateField(node.id, field.id, { type: e.target.value as FieldType })}
                                    className="px-2 py-1 bg-surface border border-border rounded text-xs
                                             text-text-primary focus:outline-none focus:border-accent-blue"
                                  >
                                    {fieldTypes.map(ft => (
                                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                                    ))}
                                  </select>
                                  <label className="flex items-center gap-1 text-xs text-text-secondary">
                                    <input
                                      type="checkbox"
                                      checked={field.required}
                                      onChange={(e) => updateField(node.id, field.id, { required: e.target.checked })}
                                      className="w-3 h-3"
                                    />
                                    Required
                                  </label>
                                  <button
                                    onClick={() => removeField(node.id, field.id)}
                                    className="p-1 text-text-muted hover:text-accent-red"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={field.title}
                                  onChange={(e) => updateField(node.id, field.id, { title: e.target.value })}
                                  placeholder="Display title (optional)"
                                  className="w-full px-2 py-1 bg-surface border border-border rounded text-xs
                                           text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
                                />
                                {field.type === 'select' && (
                                  <input
                                    type="text"
                                    value={field.options || ''}
                                    onChange={(e) => updateField(node.id, field.id, { options: e.target.value })}
                                    placeholder="Options (comma-separated)"
                                    className="w-full px-2 py-1 bg-surface border border-border rounded text-xs
                                             text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Files Section */}
                      <div className="border-t border-border pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-text-secondary">File Attachments</span>
                          <button
                            onClick={() => addFile(node.id)}
                            className="text-xs text-accent-blue hover:text-accent-blue/80 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add File
                          </button>
                        </div>

                        {node.files.length === 0 ? (
                          <p className="text-xs text-text-muted italic">No files attached</p>
                        ) : (
                          <div className="space-y-2">
                            {node.files.map((file) => (
                              <div key={file.id} className="p-2 bg-canvas rounded-lg border border-border space-y-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-text-muted shrink-0" />
                                  <input
                                    type="text"
                                    value={file.path}
                                    onChange={(e) => updateFile(node.id, file.id, { path: e.target.value })}
                                    placeholder="File path (e.g., /src/index.ts)"
                                    className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs
                                             text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
                                  />
                                  <button
                                    onClick={() => handleFilePicker(node.id, file.id)}
                                    className="px-2 py-1 bg-accent-blue/10 text-accent-blue rounded text-xs
                                             hover:bg-accent-blue/20 transition-colors flex items-center gap-1"
                                    title="Browse for file"
                                  >
                                    <FolderOpen className="w-3 h-3" />
                                    Browse
                                  </button>
                                  {/* Hidden file input for fallback */}
                                  <input
                                    type="file"
                                    ref={(el) => { fileInputRefs.current[`${node.id}_${file.id}`] = el; }}
                                    onChange={(e) => handleFileInputChange(node.id, file.id, e)}
                                    className="hidden"
                                  />
                                  <select
                                    value={file.type}
                                    onChange={(e) => updateFile(node.id, file.id, { type: e.target.value as NewFileInput['type'] })}
                                    className="px-2 py-1 bg-surface border border-border rounded text-xs
                                             text-text-primary focus:outline-none focus:border-accent-blue"
                                  >
                                    {fileTypes.map(ft => (
                                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => removeFile(node.id, file.id)}
                                    className="p-1 text-text-muted hover:text-accent-red"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={file.name}
                                    onChange={(e) => updateFile(node.id, file.id, { name: e.target.value })}
                                    placeholder="Display name (optional)"
                                    className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs
                                             text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
                                  />
                                  <input
                                    type="text"
                                    value={file.description}
                                    onChange={(e) => updateFile(node.id, file.id, { description: e.target.value })}
                                    placeholder="Description (optional)"
                                    className="flex-1 px-2 py-1 bg-surface border border-border rounded text-xs
                                             text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add another node */}
              <button
                onClick={handleAddNode}
                className="w-full py-2 border border-dashed border-border rounded-lg
                         text-sm text-text-muted hover:text-text-secondary hover:border-text-muted
                         transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add another node
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInsert}
                disabled={!isValid}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                          ${isValid
                            ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
                            : 'bg-surface-raised text-text-muted cursor-not-allowed'
                          }`}
              >
                Insert {newNodes.filter(n => n.title.trim()).length || ''} Node{newNodes.filter(n => n.title.trim()).length !== 1 ? 's' : ''}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
