#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import open from 'open';
import { wsManager } from './websocket/ws-server.js';
import { startHttpServer } from './http/server.js';
import { historyStorage } from './storage/history-storage.js';
import {
  handleStreamPlanChunk,
  handleSubmitPlan,
  handleGetApproval,
  handleUpdateNodeStatus,
  handlePlanCompleted,
  handlePlanFailed,
  handleCheckRerun,
  handleCheckPause,
  handleGetResumeInfo,
  handleRequestPlanUpdate,
  handleCreateNewPlan,
  handleGetUsageInstructions,
} from './tools/handlers.js';
import { NodeStatus } from './types.js';

// Configuration
const HTTP_PORT = parseInt(process.env.OVERTURE_HTTP_PORT || '3031', 10);
const WS_PORT = parseInt(process.env.OVERTURE_WS_PORT || '3030', 10);
const AUTO_OPEN_BROWSER = process.env.OVERTURE_AUTO_OPEN !== 'false';

// Tool schemas
const StreamPlanChunkSchema = z.object({
  xml_chunk: z.string().describe('A chunk of the plan XML to process'),
  workspace_path: z.string().optional().describe('Absolute path to the workspace/project directory'),
  agent_type: z.string().optional().describe('The type of agent (claude-code, cline, cursor, sixth, gh_copilot)'),
});

const SubmitPlanSchema = z.object({
  plan_xml: z.string().describe('The complete plan XML'),
  workspace_path: z.string().optional().describe('Absolute path to the workspace/project directory'),
  agent_type: z.string().optional().describe('The type of agent (claude-code, cline, cursor, sixth, gh_copilot)'),
});

const GetApprovalSchema = z.object({
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

const UpdateNodeStatusSchema = z.object({
  node_id: z.string().describe('The ID of the node to update'),
  status: z
    .enum(['pending', 'active', 'completed', 'failed', 'skipped'])
    .describe('The new status of the node'),
  output: z.string().optional().describe('Optional output/result from the node execution'),
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

const PlanCompletedSchema = z.object({
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

const PlanFailedSchema = z.object({
  error: z.string().describe('The error message'),
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

const CheckRerunSchema = z.object({
  timeout_ms: z.number().optional().describe('How long to wait for a rerun request (default 5000ms)'),
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

const CheckPauseSchema = z.object({
  wait: z.boolean().optional().describe('If true, block until execution is resumed. If false, return immediately.'),
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

const GetResumeInfoSchema = z.object({
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

// Schema for node data used in operations
const NodeDataSchema = z.object({
  id: z.string().describe('Unique ID for the node'),
  type: z.enum(['task', 'decision']).describe('Node type'),
  title: z.string().describe('Node title'),
  description: z.string().describe('Node description'),
  complexity: z.enum(['low', 'medium', 'high']).optional().describe('Task complexity'),
  expectedOutput: z.string().optional().describe('Expected output description'),
  risks: z.string().optional().describe('Potential risks'),
});

// Schema for plan update operations
const PlanOperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('insert_after'),
    reference_node_id: z.string().describe('Node ID to insert after'),
    node: NodeDataSchema,
  }),
  z.object({
    op: z.literal('insert_before'),
    reference_node_id: z.string().describe('Node ID to insert before'),
    node: NodeDataSchema,
  }),
  z.object({
    op: z.literal('delete'),
    node_id: z.string().describe('Node ID to delete'),
  }),
  z.object({
    op: z.literal('replace'),
    node_id: z.string().describe('Node ID to replace'),
    node: z.object({
      id: z.string().optional().describe('New ID (optional)'),
      type: z.enum(['task', 'decision']).optional(),
      title: z.string().describe('New title'),
      description: z.string().describe('New description'),
      complexity: z.enum(['low', 'medium', 'high']).optional(),
      expectedOutput: z.string().optional(),
      risks: z.string().optional(),
    }),
  }),
]);

const RequestPlanUpdateSchema = z.object({
  operations: z.array(PlanOperationSchema).describe('Array of operations to apply to the plan (insert_after, insert_before, delete, replace)'),
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

const CreateNewPlanSchema = z.object({
  project_id: z.string().optional().describe('Project ID (optional, uses current project if not specified)'),
});

const GetUsageInstructionsSchema = z.object({
  agent_type: z.string().describe('The type of agent requesting instructions (claude-code, cline, cursor, sixth, gh_copilot)'),
});

// Tool definitions
const TOOLS = [
  {
    name: 'stream_plan_chunk',
    description:
      'Stream a chunk of the plan XML to Overture. IMPORTANT: Call get_usage_instructions first to learn the correct XML format and workflow. Use this to send the plan incrementally as it is generated. Each chunk will be parsed and nodes/edges will appear in real-time on the canvas.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        xml_chunk: {
          type: 'string',
          description: 'A chunk of the plan XML to process',
        },
        workspace_path: {
          type: 'string',
          description: 'Absolute path to the workspace/project directory. Used to identify the project for multi-project support.',
        },
        agent_type: {
          type: 'string',
          description: 'The type of agent (claude-code, cline, cursor, sixth, gh_copilot)',
        },
      },
      required: ['xml_chunk'],
    },
  },
  {
    name: 'submit_plan',
    description:
      'Submit a complete plan XML to Overture. IMPORTANT: Call get_usage_instructions first to learn the correct XML format and workflow. Use this if you have the entire plan ready at once. The plan will be parsed and displayed on the canvas.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        plan_xml: {
          type: 'string',
          description: 'The complete plan XML',
        },
        workspace_path: {
          type: 'string',
          description: 'Absolute path to the workspace/project directory. Used to identify the project for multi-project support.',
        },
        agent_type: {
          type: 'string',
          description: 'The type of agent (claude-code, cline, cursor, sixth, gh_copilot)',
        },
      },
      required: ['plan_xml'],
    },
  },
  {
    name: 'get_approval',
    description:
      'Wait for user approval of the plan in the Overture UI. Returns status: "approved" (with field values and selected branches), "cancelled" (user rejected), or "pending" (still waiting). If status is "pending", call this tool again to continue waiting - the user may need up to 15-30 minutes to review and customize the plan.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_node_status',
    description:
      'Update the status of a node during execution. Use this to show progress as you work through the plan. The node will visually update on the canvas.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        node_id: {
          type: 'string',
          description: 'The ID of the node to update',
        },
        status: {
          type: 'string',
          enum: ['pending', 'active', 'completed', 'failed', 'skipped'],
          description: 'The new status of the node',
        },
        output: {
          type: 'string',
          description: 'Optional output/result from the node execution',
        },
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: ['node_id', 'status'],
    },
  },
  {
    name: 'plan_completed',
    description: 'Mark the plan as successfully completed. Call this after all nodes have been executed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'plan_failed',
    description: 'Mark the plan as failed. Call this if an unrecoverable error occurs during execution.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        error: {
          type: 'string',
          description: 'The error message',
        },
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: ['error'],
    },
  },
  {
    name: 'check_rerun',
    description: 'Check if the user has requested to re-run any nodes. Call this after plan_completed to allow users to re-run specific nodes or re-run from a node to the end. Returns immediately if there\'s a pending request, otherwise waits briefly.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        timeout_ms: {
          type: 'number',
          description: 'How long to wait for a rerun request (default 5000ms)',
        },
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'check_pause',
    description: 'Check if the user has paused execution. Call this before starting each node to respect user pause requests. If wait=true, blocks until the user resumes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        wait: {
          type: 'boolean',
          description: 'If true, block until execution is resumed. If false, return immediately with current state.',
        },
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_resume_info',
    description: 'Get detailed information about a paused or failed plan to help resume execution. Returns the current node where execution stopped, list of completed/pending/failed nodes, user-configured field values, selected branches, and other metadata. Use this when resuming a plan that was paused, failed, or loaded from history.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'request_plan_update',
    description: 'Update an existing plan with incremental operations. Pass an array of operations to insert, delete, or replace nodes. Operations are applied in order with smooth animations. After calling this, call get_approval to confirm changes with the user.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        operations: {
          type: 'array',
          description: 'Array of operations to apply to the plan',
          items: {
            type: 'object',
            oneOf: [
              {
                type: 'object',
                properties: {
                  op: { type: 'string', enum: ['insert_after'], description: 'Insert a node after the reference node' },
                  reference_node_id: { type: 'string', description: 'Node ID to insert after' },
                  node: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string', enum: ['task', 'decision'] },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                      expectedOutput: { type: 'string' },
                      risks: { type: 'string' },
                    },
                    required: ['id', 'type', 'title', 'description'],
                  },
                },
                required: ['op', 'reference_node_id', 'node'],
              },
              {
                type: 'object',
                properties: {
                  op: { type: 'string', enum: ['insert_before'], description: 'Insert a node before the reference node' },
                  reference_node_id: { type: 'string', description: 'Node ID to insert before' },
                  node: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string', enum: ['task', 'decision'] },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                      expectedOutput: { type: 'string' },
                      risks: { type: 'string' },
                    },
                    required: ['id', 'type', 'title', 'description'],
                  },
                },
                required: ['op', 'reference_node_id', 'node'],
              },
              {
                type: 'object',
                properties: {
                  op: { type: 'string', enum: ['delete'], description: 'Delete a node (edges auto-reconnect)' },
                  node_id: { type: 'string', description: 'Node ID to delete' },
                },
                required: ['op', 'node_id'],
              },
              {
                type: 'object',
                properties: {
                  op: { type: 'string', enum: ['replace'], description: 'Replace a node\'s content in-place' },
                  node_id: { type: 'string', description: 'Node ID to replace' },
                  node: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string', enum: ['task', 'decision'] },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                      expectedOutput: { type: 'string' },
                      risks: { type: 'string' },
                    },
                    required: ['title', 'description'],
                  },
                },
                required: ['op', 'node_id', 'node'],
              },
            ],
          },
        },
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: ['operations'],
    },
  },
  {
    name: 'create_new_plan',
    description: 'Signal that you are creating a completely new, unrelated plan. IMPORTANT: Call get_usage_instructions first if you haven\'t already. Call this BEFORE submitting a new plan when the user asks for something unrelated to the current plan (e.g., "let\'s work on something else", "forget that, build X instead"). The new plan will be added alongside existing plans (Figma-style artboards). After calling this, submit the new plan using submit_plan or stream_plan_chunk, then call get_approval.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID (optional, uses current project if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_usage_instructions',
    description: 'Get detailed usage instructions for Overture MCP. CALL THIS FIRST before using any other Overture tools. Returns comprehensive documentation on how to structure plans, use XML format, handle approvals, and execute nodes. Pass your agent type to get agent-specific instructions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_type: {
          type: 'string',
          description: 'The type of agent requesting instructions. Supported: "claude-code", "cline", "cursor", "sixth", "gh_copilot"',
        },
      },
      required: ['agent_type'],
    },
  },
];

async function main() {
  // Initialize history storage (creates file if it doesn't exist)
  await historyStorage.initialize();

  // Start HTTP server for the UI
  startHttpServer(HTTP_PORT);

  // Start WebSocket server for real-time updates
  wsManager.start(WS_PORT);

  // Open browser to the UI
  if (AUTO_OPEN_BROWSER) {
    setTimeout(() => {
      open(`http://localhost:${HTTP_PORT}`);
    }, 500);
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'overture',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'stream_plan_chunk': {
          const parsed = StreamPlanChunkSchema.parse(args);
          const result = handleStreamPlanChunk(parsed.xml_chunk, parsed.workspace_path, parsed.agent_type);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'submit_plan': {
          const parsed = SubmitPlanSchema.parse(args);
          const result = handleSubmitPlan(parsed.plan_xml, parsed.workspace_path, parsed.agent_type);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'get_approval': {
          const parsed = GetApprovalSchema.parse(args);
          const result = await handleGetApproval(parsed.project_id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'update_node_status': {
          const parsed = UpdateNodeStatusSchema.parse(args);
          const result = handleUpdateNodeStatus(
            parsed.node_id,
            parsed.status as NodeStatus,
            parsed.output,
            parsed.project_id
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'plan_completed': {
          const parsed = PlanCompletedSchema.parse(args);
          const result = handlePlanCompleted(parsed.project_id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'plan_failed': {
          const parsed = PlanFailedSchema.parse(args);
          const result = handlePlanFailed(parsed.error, parsed.project_id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'check_rerun': {
          const parsed = CheckRerunSchema.parse(args);
          const result = await handleCheckRerun(parsed.timeout_ms || 5000, parsed.project_id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'check_pause': {
          const parsed = CheckPauseSchema.parse(args);
          const result = await handleCheckPause(parsed.wait || false, parsed.project_id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'get_resume_info': {
          const parsed = GetResumeInfoSchema.parse(args);
          const result = handleGetResumeInfo(parsed.project_id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'request_plan_update': {
          const parsed = RequestPlanUpdateSchema.parse(args);
          const result = handleRequestPlanUpdate(parsed.operations, parsed.project_id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'create_new_plan': {
          const parsed = CreateNewPlanSchema.parse(args);
          const result = handleCreateNewPlan(parsed.project_id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        case 'get_usage_instructions': {
          const parsed = GetUsageInstructionsSchema.parse(args);
          const result = await handleGetUsageInstructions(parsed.agent_type);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: message }),
          },
        ],
        isError: true,
      };
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[Overture] MCP server started');
  console.error(`[Overture] UI: http://localhost:${HTTP_PORT}`);
  console.error(`[Overture] WebSocket: ws://localhost:${WS_PORT}`);
}

main().catch((error) => {
  console.error('[Overture] Fatal error:', error);
  process.exit(1);
});
