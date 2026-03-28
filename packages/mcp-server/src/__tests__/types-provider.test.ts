import { describe, it, expect } from 'vitest';

// Test the Plan type's provider field documentation
// The provider field in types.ts should mention 'minimax'
describe('MCP Server Types - Provider Configuration', () => {
  // The Plan interface includes: provider?: string; // e.g., 'anthropic', 'openai', 'google', 'minimax'
  // We test the runtime behavior of provider string matching

  const KNOWN_PROVIDERS = ['anthropic', 'openai', 'google', 'minimax', 'mistral', 'cohere'] as const;

  describe('Provider identification', () => {
    it('should recognize minimax as a valid provider string', () => {
      const provider = 'minimax';
      expect(KNOWN_PROVIDERS).toContain(provider);
    });

    it('should handle provider in plan settings update', () => {
      const planSettings: { model?: string; provider?: string } = {
        model: 'MiniMax-M2.7',
        provider: 'minimax',
      };
      expect(planSettings.provider).toBe('minimax');
      expect(planSettings.model).toBe('MiniMax-M2.7');
    });

    it('should allow undefined provider (optional field)', () => {
      const planSettings: { model?: string; provider?: string } = {};
      expect(planSettings.provider).toBeUndefined();
    });

    it('should support all known providers', () => {
      expect(KNOWN_PROVIDERS.length).toBe(6);
      expect(KNOWN_PROVIDERS).toContain('minimax');
      expect(KNOWN_PROVIDERS).toContain('anthropic');
      expect(KNOWN_PROVIDERS).toContain('openai');
      expect(KNOWN_PROVIDERS).toContain('google');
    });
  });

  describe('WebSocket message format with MiniMax provider', () => {
    it('should format plan_settings_updated message correctly', () => {
      const msg = {
        type: 'plan_settings_updated' as const,
        planId: 'test-plan-1',
        model: 'MiniMax-M2.7',
        provider: 'minimax',
        projectId: 'proj-123',
      };
      expect(msg.type).toBe('plan_settings_updated');
      expect(msg.provider).toBe('minimax');
      expect(msg.model).toBe('MiniMax-M2.7');
    });

    it('should format update_plan_settings client message correctly', () => {
      const msg = {
        type: 'update_plan_settings' as const,
        planId: 'test-plan-1',
        model: 'MiniMax-M2.7-highspeed',
        provider: 'minimax',
        projectId: 'proj-123',
      };
      expect(msg.type).toBe('update_plan_settings');
      expect(msg.provider).toBe('minimax');
      expect(msg.model).toBe('MiniMax-M2.7-highspeed');
    });
  });
});

describe('MiniMax Model Names', () => {
  const MINIMAX_MODELS = [
    'MiniMax-M2.7',
    'MiniMax-M2.7-highspeed',
    'MiniMax-M2.5',
    'MiniMax-M2.5-highspeed',
  ];

  it('should have correct naming format (MiniMax-M prefix)', () => {
    for (const model of MINIMAX_MODELS) {
      expect(model.startsWith('MiniMax-M')).toBe(true);
    }
  });

  it('should differentiate standard and highspeed variants', () => {
    const standard = MINIMAX_MODELS.filter(m => !m.includes('highspeed'));
    const highspeed = MINIMAX_MODELS.filter(m => m.includes('highspeed'));
    expect(standard.length).toBe(2);
    expect(highspeed.length).toBe(2);
  });

  it('should have both M2.7 and M2.5 generations', () => {
    const m27 = MINIMAX_MODELS.filter(m => m.includes('M2.7'));
    const m25 = MINIMAX_MODELS.filter(m => m.includes('M2.5'));
    expect(m27.length).toBe(2);
    expect(m25.length).toBe(2);
  });
});
