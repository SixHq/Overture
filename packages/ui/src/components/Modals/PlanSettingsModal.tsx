import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Building2, ChevronDown } from 'lucide-react';
import { usePlanStore, Plan } from '@/stores/plan-store';

// Common AI providers with their models
const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', icon: 'A' },
  { id: 'openai', name: 'OpenAI', icon: 'O' },
  { id: 'google', name: 'Google', icon: 'G' },
  { id: 'minimax', name: 'MiniMax', icon: 'M' },
  { id: 'mistral', name: 'Mistral', icon: 'Mi' },
  { id: 'cohere', name: 'Cohere', icon: 'C' },
  { id: 'other', name: 'Other', icon: '?' },
] as const;

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  anthropic: [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1-preview',
    'o1-mini',
  ],
  google: [
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
  ],
  minimax: [
    'MiniMax-M2.7',
    'MiniMax-M2.7-highspeed',
    'MiniMax-M2.5',
    'MiniMax-M2.5-highspeed',
  ],
  mistral: [
    'mistral-large',
    'mistral-medium',
    'mistral-small',
    'codestral',
    'mixtral-8x7b',
  ],
  cohere: [
    'command-r-plus',
    'command-r',
    'command',
  ],
  other: [],
};

interface PlanSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan;
  onSave?: (settings: { model?: string; provider?: string }) => void;
}

export function PlanSettingsModal({ isOpen, onClose, plan, onSave }: PlanSettingsModalProps) {
  const { updatePlanSettings } = usePlanStore();

  // Local state for editing (so we can cancel changes)
  const [localModel, setLocalModel] = useState(plan.model || '');
  const [localProvider, setLocalProvider] = useState(plan.provider || '');
  const [customModel, setCustomModel] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalModel(plan.model || '');
      setLocalProvider(plan.provider || '');
      setCustomModel('');
      setShowModelDropdown(false);
    }
  }, [isOpen, plan.model, plan.provider]);

  // Check if current model is in the predefined list
  const isCustomModel = localModel && localProvider &&
    !MODELS_BY_PROVIDER[localProvider]?.includes(localModel);

  const handleSave = () => {
    const settings = {
      model: localModel || undefined,
      provider: localProvider || undefined,
    };

    updatePlanSettings(plan.id, settings);

    if (onSave) {
      onSave(settings);
    }

    onClose();
  };

  const handleCancel = () => {
    setLocalModel(plan.model || '');
    setLocalProvider(plan.provider || '');
    onClose();
  };

  const handleProviderChange = (providerId: string) => {
    setLocalProvider(providerId);
    // Reset model when provider changes
    setLocalModel('');
    setCustomModel('');
  };

  const handleModelSelect = (model: string) => {
    setLocalModel(model);
    setShowModelDropdown(false);
  };

  const handleCustomModelChange = (value: string) => {
    setCustomModel(value);
    setLocalModel(value);
  };

  const availableModels = localProvider ? MODELS_BY_PROVIDER[localProvider] || [] : [];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shadow-lg shadow-accent-cyan/20">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Plan Settings</h2>
                  <p className="text-xs text-text-muted truncate max-w-[200px]">{plan.title}</p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="w-9 h-9 rounded-xl bg-surface-raised hover:bg-surface-overlay flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </header>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Provider Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-text-muted" />
                  <label className="text-sm font-semibold text-text-primary">
                    AI Provider
                  </label>
                </div>
                <p className="text-xs text-text-muted">
                  Select the AI provider for this plan
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleProviderChange(provider.id)}
                      className={`
                        px-3 py-2 rounded-xl border-2 transition-all text-sm font-medium
                        ${localProvider === provider.id
                          ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                          : 'border-border bg-surface-raised hover:border-accent-blue/30 text-text-secondary hover:text-text-primary'
                        }
                      `}
                    >
                      <span className="text-xs opacity-60 mr-1">{provider.icon}</span>
                      {provider.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-text-muted" />
                  <label className="text-sm font-semibold text-text-primary">
                    Model
                  </label>
                </div>
                <p className="text-xs text-text-muted">
                  {localProvider
                    ? 'Select a model or enter a custom model ID'
                    : 'Select a provider first to see available models'}
                </p>

                {localProvider && (
                  <>
                    {/* Predefined models dropdown */}
                    {availableModels.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowModelDropdown(!showModelDropdown)}
                          className="w-full px-4 py-3 bg-canvas border border-border rounded-xl
                                   text-left text-sm text-text-primary
                                   flex items-center justify-between
                                   hover:border-accent-blue/50 transition-colors"
                        >
                          <span className={localModel && !isCustomModel ? 'text-text-primary' : 'text-text-muted'}>
                            {localModel && !isCustomModel ? localModel : 'Select a model...'}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                          {showModelDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto"
                            >
                              {availableModels.map((model) => (
                                <button
                                  key={model}
                                  onClick={() => handleModelSelect(model)}
                                  className={`
                                    w-full px-4 py-2.5 text-left text-sm transition-colors
                                    ${localModel === model
                                      ? 'bg-accent-blue/10 text-accent-blue'
                                      : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                                    }
                                  `}
                                >
                                  {model}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Custom model input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Or enter custom model ID..."
                        value={isCustomModel ? localModel : customModel}
                        onChange={(e) => handleCustomModelChange(e.target.value)}
                        className="w-full px-4 py-3 bg-canvas border border-border rounded-xl
                                 text-sm text-text-primary placeholder:text-text-muted
                                 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue
                                 transition-all"
                      />
                    </div>
                  </>
                )}

                {!localProvider && (
                  <div className="px-4 py-3 bg-surface-raised rounded-xl text-sm text-text-muted text-center">
                    Select a provider above to configure the model
                  </div>
                )}
              </div>

              {/* Current Selection Summary */}
              {(localModel || localProvider) && (
                <div className="p-4 bg-accent-blue/5 border border-accent-blue/20 rounded-xl">
                  <p className="text-xs text-text-muted mb-2">Current Configuration</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {localProvider && (
                      <span className="px-2 py-1 bg-accent-purple/20 text-accent-purple text-xs font-medium rounded-lg">
                        {PROVIDERS.find(p => p.id === localProvider)?.name || localProvider}
                      </span>
                    )}
                    {localModel && (
                      <span className="px-2 py-1 bg-accent-blue/20 text-accent-blue text-xs font-medium rounded-lg">
                        {localModel}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <footer className="px-6 py-4 border-t border-border bg-surface/50 flex items-center justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 text-sm font-medium text-text-secondary
                         hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 bg-gradient-to-r from-accent-cyan to-accent-blue
                         text-white text-sm font-semibold rounded-xl
                         hover:shadow-lg hover:shadow-accent-cyan/25 hover:-translate-y-0.5
                         transition-all"
              >
                Save Settings
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
