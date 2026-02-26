import sax from 'sax';
import { PlanNode, PlanEdge, DynamicField, Branch, Plan } from '../types.js';

type ParseEvent =
  | { type: 'plan'; plan: Partial<Plan> }
  | { type: 'node'; node: PlanNode }
  | { type: 'edge'; edge: PlanEdge }
  | { type: 'complete' }
  | { type: 'error'; error: Error };

type ParseCallback = (event: ParseEvent) => void;

interface ParserState {
  currentNode: Partial<PlanNode> | null;
  currentBranch: Partial<Branch> | null;
  currentField: Partial<DynamicField> | null;
  currentEdge: Partial<PlanEdge> | null;
  currentElement: string | null;
  textBuffer: string;
  plan: Partial<Plan>;
}

export class StreamingXMLParser {
  private parser: sax.SAXParser;
  private state: ParserState;
  private callback: ParseCallback;
  private nodeCounter = 0;
  private edgeCounter = 0;
  private fieldCounter = 0;
  private branchCounter = 0;

  constructor(callback: ParseCallback) {
    this.callback = callback;
    this.parser = sax.parser(true, { trim: true });
    this.state = this.createInitialState();
    this.setupParser();
  }

  private createInitialState(): ParserState {
    return {
      currentNode: null,
      currentBranch: null,
      currentField: null,
      currentEdge: null,
      currentElement: null,
      textBuffer: '',
      plan: {},
    };
  }

  private setupParser(): void {
    this.parser.onerror = (error) => {
      this.callback({ type: 'error', error });
    };

    this.parser.onopentag = (tag) => {
      this.state.textBuffer = '';
      this.state.currentElement = tag.name;

      switch (tag.name) {
        case 'plan':
          this.state.plan = {
            id: (tag.attributes.id as string) || `plan_${Date.now()}`,
            title: (tag.attributes.title as string) || 'Untitled Plan',
            agent: (tag.attributes.agent as string) || 'unknown',
            createdAt: new Date().toISOString(),
            status: 'streaming',
          };
          this.callback({ type: 'plan', plan: this.state.plan });
          break;

        case 'node':
          this.state.currentNode = {
            id: (tag.attributes.id as string) || `n${++this.nodeCounter}`,
            type: (tag.attributes.type as 'task' | 'decision') || 'task',
            status: 'pending',
            title: '',
            description: '',
            dynamicFields: [],
            branches: [],
            branchParent: tag.attributes.branch_parent as string,
            branchId: tag.attributes.branch_id as string,
          };
          break;

        case 'branch':
          this.state.currentBranch = {
            id: (tag.attributes.id as string) || `b${++this.branchCounter}`,
            label: (tag.attributes.label as string) || '',
            description: '',
          };
          break;

        case 'dynamic_field':
          this.state.currentField = {
            id: (tag.attributes.id as string) || `f${++this.fieldCounter}`,
            name: (tag.attributes.name as string) || '',
            type: (tag.attributes.type as DynamicField['type']) || 'string',
            required: tag.attributes.required === 'true',
            title: (tag.attributes.title as string) || '',
            description: (tag.attributes.description as string) || '',
            value: tag.attributes.value as string,
            options: tag.attributes.options as string,
            setupInstructions: tag.attributes.setup_instructions as string,
          };
          break;

        case 'edge':
          this.state.currentEdge = {
            id: (tag.attributes.id as string) || `e${++this.edgeCounter}`,
            from: tag.attributes.from as string,
            to: tag.attributes.to as string,
          };
          break;
      }
    };

    this.parser.onclosetag = (tagName) => {
      const text = this.state.textBuffer.trim();

      switch (tagName) {
        case 'plan':
          this.callback({ type: 'complete' });
          break;

        case 'node':
          if (this.state.currentNode) {
            this.callback({
              type: 'node',
              node: this.state.currentNode as PlanNode,
            });
            this.state.currentNode = null;
          }
          break;

        case 'branch':
          if (this.state.currentBranch && this.state.currentNode) {
            if (!this.state.currentNode.branches) {
              this.state.currentNode.branches = [];
            }
            this.state.currentNode.branches.push(this.state.currentBranch as Branch);
            this.state.currentBranch = null;
          }
          break;

        case 'dynamic_field':
          if (this.state.currentField && this.state.currentNode) {
            if (!this.state.currentNode.dynamicFields) {
              this.state.currentNode.dynamicFields = [];
            }
            this.state.currentNode.dynamicFields.push(
              this.state.currentField as DynamicField
            );
            this.state.currentField = null;
          }
          break;

        case 'edge':
          if (this.state.currentEdge) {
            this.callback({
              type: 'edge',
              edge: this.state.currentEdge as PlanEdge,
            });
            this.state.currentEdge = null;
          }
          break;

        // Node child elements
        case 'title':
          if (this.state.currentNode) {
            this.state.currentNode.title = text;
          }
          break;

        case 'description':
          if (this.state.currentBranch) {
            this.state.currentBranch.description = text;
          } else if (this.state.currentNode) {
            this.state.currentNode.description = text;
          }
          break;

        case 'complexity':
          if (this.state.currentNode) {
            this.state.currentNode.complexity = text as 'low' | 'medium' | 'high';
          }
          break;

        case 'expected_output':
          if (this.state.currentNode) {
            this.state.currentNode.expectedOutput = text;
          }
          break;

        case 'risks':
          if (this.state.currentNode) {
            this.state.currentNode.risks = text;
          }
          break;

        // Branch child elements
        case 'label':
          if (this.state.currentBranch) {
            this.state.currentBranch.label = text;
          }
          break;

        case 'pros':
          if (this.state.currentBranch) {
            this.state.currentBranch.pros = text;
          }
          break;

        case 'cons':
          if (this.state.currentBranch) {
            this.state.currentBranch.cons = text;
          }
          break;
      }

      this.state.currentElement = null;
      this.state.textBuffer = '';
    };

    this.parser.ontext = (text) => {
      this.state.textBuffer += text;
    };

    this.parser.oncdata = (cdata) => {
      this.state.textBuffer += cdata;
    };
  }

  write(chunk: string): void {
    this.parser.write(chunk);
  }

  close(): void {
    this.parser.close();
  }

  reset(): void {
    this.parser = sax.parser(true, { trim: true });
    this.state = this.createInitialState();
    this.nodeCounter = 0;
    this.edgeCounter = 0;
    this.fieldCounter = 0;
    this.branchCounter = 0;
    this.setupParser();
  }
}
