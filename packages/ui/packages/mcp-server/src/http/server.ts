import express from 'express';
import path from 'path';
import { createServer } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { handleSubmitPlan } from '../tools/handlers.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startHttpServer(port: number): void {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Serve static files from the UI dist directory
  // Use paths relative to this module's location (works regardless of cwd)
  const possiblePaths = [
    path.resolve(__dirname, '../ui-dist'),           // packages/mcp-server/dist/../ui-dist
    path.resolve(__dirname, '../../ui-dist'),        // packages/mcp-server/ui-dist
    path.resolve(__dirname, '../../../ui/dist'),     // packages/ui/dist
    path.resolve(process.cwd(), 'ui-dist'),          // fallback to cwd
    path.resolve(process.cwd(), 'packages/mcp-server/ui-dist'),
  ];

  let staticPath = possiblePaths[0];
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'index.html'))) {
      staticPath = p;
      break;
    }
  }

  console.error(`[Overture] Serving UI from: ${staticPath}`);

  // Test endpoint to submit a plan (for development/demo)
  app.post('/api/test-plan', (req, res) => {
    const { plan_xml } = req.body;
    if (!plan_xml) {
      return res.status(400).json({ error: 'plan_xml is required' });
    }
    const result = handleSubmitPlan(plan_xml);
    res.json(result);
  });

  // Proxy endpoint for MCP marketplace to avoid CORS issues
  app.get('/api/mcp-marketplace', async (req, res) => {
    try {
      const response = await fetch('https://api.cline.bot/v1/mcp/marketplace');
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch MCP marketplace' });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[Overture] Failed to fetch MCP marketplace:', error);
      res.status(500).json({ error: 'Failed to fetch MCP marketplace' });
    }
  });

  app.use(express.static(staticPath));

  // SPA fallback - serve index.html for all routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  const server = createServer(app);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Overture] Port ${port} already in use - another instance may be running`);
      // Don't crash - the existing instance will serve the UI
    } else {
      console.error(`[Overture] HTTP server error:`, err);
    }
  });

  server.listen(port, () => {
    console.error(`[Overture] UI server listening on http://localhost:${port}`);
  });
}
