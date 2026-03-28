import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Integration tests verifying MiniMax provider is consistently
 * integrated across both UI and MCP server packages.
 */
describe('MiniMax Provider Integration', () => {
  const rootDir = join(__dirname, '..', '..', '..', '..');

  describe('PlanSettingsModal.tsx consistency', () => {
    it('should have minimax in PROVIDERS array', () => {
      const content = readFileSync(
        join(rootDir, 'packages/ui/src/components/Modals/PlanSettingsModal.tsx'),
        'utf-8'
      );
      expect(content).toContain("id: 'minimax'");
      expect(content).toContain("name: 'MiniMax'");
    });

    it('should have minimax models in MODELS_BY_PROVIDER', () => {
      const content = readFileSync(
        join(rootDir, 'packages/ui/src/components/Modals/PlanSettingsModal.tsx'),
        'utf-8'
      );
      expect(content).toContain('minimax:');
      expect(content).toContain("'MiniMax-M2.7'");
      expect(content).toContain("'MiniMax-M2.7-highspeed'");
      expect(content).toContain("'MiniMax-M2.5'");
      expect(content).toContain("'MiniMax-M2.5-highspeed'");
    });
  });

  describe('Server types.ts consistency', () => {
    it('should mention minimax in provider comment', () => {
      const content = readFileSync(
        join(rootDir, 'packages/mcp-server/src/types.ts'),
        'utf-8'
      );
      expect(content).toContain("'minimax'");
    });
  });

  describe('UI plan-store.ts consistency', () => {
    it('should mention minimax in provider comment', () => {
      const content = readFileSync(
        join(rootDir, 'packages/ui/src/stores/plan-store.ts'),
        'utf-8'
      );
      expect(content).toContain("'minimax'");
    });
  });

  describe('Package.json consistency', () => {
    it('should have MiniMax in mcp-server package description', () => {
      const pkg = JSON.parse(readFileSync(
        join(rootDir, 'packages/mcp-server/package.json'),
        'utf-8'
      ));
      expect(pkg.description).toContain('MiniMax');
    });

    it('should have minimax keywords in mcp-server package', () => {
      const pkg = JSON.parse(readFileSync(
        join(rootDir, 'packages/mcp-server/package.json'),
        'utf-8'
      ));
      expect(pkg.keywords).toContain('minimax');
      expect(pkg.keywords).toContain('MiniMax');
    });
  });
});
