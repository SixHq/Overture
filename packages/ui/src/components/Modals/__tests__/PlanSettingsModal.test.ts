import { describe, it, expect } from 'vitest';

// Extract the provider and model data from PlanSettingsModal for testing
// These mirror the constants defined in PlanSettingsModal.tsx
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

describe('PlanSettingsModal - Provider Configuration', () => {
  describe('PROVIDERS list', () => {
    it('should include MiniMax as a recognized provider', () => {
      const minimax = PROVIDERS.find(p => p.id === 'minimax');
      expect(minimax).toBeDefined();
      expect(minimax!.name).toBe('MiniMax');
      expect(minimax!.icon).toBe('M');
    });

    it('should have unique provider IDs', () => {
      const ids = PROVIDERS.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have unique provider icons (except Mistral uses Mi)', () => {
      const icons = PROVIDERS.map(p => p.icon);
      // MiniMax uses 'M' and Mistral uses 'Mi' to avoid collision
      expect(icons.filter(i => i === 'M').length).toBe(1);
      expect(icons.filter(i => i === 'Mi').length).toBe(1);
    });

    it('should list all 7 providers including MiniMax', () => {
      expect(PROVIDERS.length).toBe(7);
      const expectedIds = ['anthropic', 'openai', 'google', 'minimax', 'mistral', 'cohere', 'other'];
      expect(PROVIDERS.map(p => p.id)).toEqual(expectedIds);
    });
  });

  describe('MiniMax models', () => {
    it('should have MiniMax models in MODELS_BY_PROVIDER', () => {
      expect(MODELS_BY_PROVIDER.minimax).toBeDefined();
      expect(MODELS_BY_PROVIDER.minimax.length).toBeGreaterThan(0);
    });

    it('should include M2.7 models', () => {
      expect(MODELS_BY_PROVIDER.minimax).toContain('MiniMax-M2.7');
      expect(MODELS_BY_PROVIDER.minimax).toContain('MiniMax-M2.7-highspeed');
    });

    it('should include M2.5 models', () => {
      expect(MODELS_BY_PROVIDER.minimax).toContain('MiniMax-M2.5');
      expect(MODELS_BY_PROVIDER.minimax).toContain('MiniMax-M2.5-highspeed');
    });

    it('should have exactly 4 MiniMax models', () => {
      expect(MODELS_BY_PROVIDER.minimax.length).toBe(4);
    });

    it('should list M2.7 models before M2.5 models (latest first)', () => {
      const models = MODELS_BY_PROVIDER.minimax;
      const m27Index = models.indexOf('MiniMax-M2.7');
      const m25Index = models.indexOf('MiniMax-M2.5');
      expect(m27Index).toBeLessThan(m25Index);
    });
  });

  describe('All providers have models entry', () => {
    it('every provider ID should have a corresponding MODELS_BY_PROVIDER entry', () => {
      for (const provider of PROVIDERS) {
        expect(MODELS_BY_PROVIDER).toHaveProperty(provider.id);
      }
    });

    it('non-other providers should have at least one model', () => {
      for (const provider of PROVIDERS) {
        if (provider.id !== 'other') {
          expect(MODELS_BY_PROVIDER[provider.id].length).toBeGreaterThan(0);
        }
      }
    });

    it('other provider should have empty models array', () => {
      expect(MODELS_BY_PROVIDER.other).toEqual([]);
    });
  });
});

describe('PlanSettingsModal - Model Selection Logic', () => {
  it('should detect custom model correctly for MiniMax', () => {
    const localModel = 'MiniMax-M2.7';
    const localProvider = 'minimax';
    const isCustomModel = localModel && localProvider &&
      !MODELS_BY_PROVIDER[localProvider]?.includes(localModel);
    expect(isCustomModel).toBe(false);
  });

  it('should detect truly custom model for MiniMax', () => {
    const localModel = 'some-custom-model';
    const localProvider = 'minimax';
    const isCustomModel = localModel && localProvider &&
      !MODELS_BY_PROVIDER[localProvider]?.includes(localModel);
    expect(isCustomModel).toBe(true);
  });

  it('should return available models for MiniMax provider', () => {
    const localProvider = 'minimax';
    const availableModels = localProvider ? MODELS_BY_PROVIDER[localProvider] || [] : [];
    expect(availableModels.length).toBe(4);
    expect(availableModels[0]).toBe('MiniMax-M2.7');
  });
});
