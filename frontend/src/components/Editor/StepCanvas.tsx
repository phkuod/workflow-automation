import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import StepNode from '../Nodes/StepNode';
import type { Station, Step, StepType, Execution } from '../../types/workflow';

const nodeTypes = {
  step: StepNode,
};

interface StepCanvasProps {
  station: Station;
  execution?: Execution | null;
  isSimulating?: boolean;
  selectedStepId?: string | null;
  onStepClick: (stepId: string) => void;
  onStepUpdate?: (stepId: string, data: Partial<Step>) => void;
  onStepConnect?: (sourceId: string, targetId: string) => void;
  onAddStep?: (type: StepType, name: string) => void;
}

export default function StepCanvas({
  station,
  execution,
  isSimulating = false,
  selectedStepId,
  onStepClick,
  onStepUpdate,
  onStepConnect,
  onAddStep,
}: StepCanvasProps) {
  // Convert station steps to React Flow nodes
  const initialNodes = useMemo(() => {
    return station.steps.map((step, index) => ({
      id: step.id,
      type: 'step',
      position: step.position || { x: 100, y: index * 120 + 50 },
      data: {
        step,
        status: getStepStatus(step.id, station.id, execution),
        isSelected: selectedStepId === step.id,
      },
    }));
  }, [station.steps, execution, selectedStepId, station.id]);

  // Create edges between steps (auto-connect by order)
  const initialEdges = useMemo(() => {
    const edges: Edge[] = [];
    const steps = station.steps;

    for (let i = 1; i < steps.length; i++) {
      const prevStep = steps[i - 1];
      const currentStep = steps[i];
      
      edges.push({
        id: `step-edge-${prevStep.id}-${currentStep.id}`,
        source: prevStep.id,
        target: currentStep.id,
        type: 'smoothstep',
        animated: isSimulating,
        style: { 
          stroke: '#22c55e', 
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#22c55e',
          width: 16,
          height: 16,
        },
      });
    }

    return edges;
  }, [station.steps, isSimulating]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when station changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle manual connection
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        setEdges((eds) => addEdge({
          ...params,
          type: 'smoothstep',
          animated: isSimulating,
          style: { stroke: '#22c55e', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#22c55e',
            width: 16,
            height: 16,
          },
        }, eds));
        
        onStepConnect?.(params.source, params.target);
      }
    },
    [setEdges, isSimulating, onStepConnect]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onStepClick(node.id);
    },
    [onStepClick]
  );

  // Handle node position change
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      
      // Update step positions in workflow store
      changes.forEach((change: any) => {
        if (change.type === 'position' && change.position && onStepUpdate) {
          onStepUpdate(change.id, { position: change.position });
        }
      });
    },
    [onNodesChange, onStepUpdate]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        connectionLineStyle={{ stroke: '#22c55e', strokeWidth: 2 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#22c55e', strokeWidth: 2 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />

        {/* Empty state */}
        {station.steps.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            padding: '2rem',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '2px dashed var(--border-color)',
          }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              No steps in this stage yet.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Use the Node Library to add steps.
            </p>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}

// Helper function to get step execution status
function getStepStatus(stepId: string, stationId: string, execution?: Execution | null): string | undefined {
  if (!execution?.result) return undefined;
  
  const stationResult = execution.result.stations.find(s => s.stationId === stationId);
  if (!stationResult) return undefined;
  
  const stepResult = stationResult.steps.find(s => s.stepId === stepId);
  return stepResult?.status;
}
