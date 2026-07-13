export interface ShapeNode {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  sample?: string;
  children?: ShapeNode[];
  truncated?: boolean;
  omittedCount?: number;
}

export interface DataShapesSource {
  kind: 'run' | 'none';
  executionId?: string;
  time?: string;
}

export interface StepShapeEntry {
  shape?: ShapeNode;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface DataShapesResponse {
  source: DataShapesSource;
  steps: Record<string, StepShapeEntry>;
}
