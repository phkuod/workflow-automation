import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  MarkerType,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import StageNode from '../Nodes/StageNode';
import type { Workflow, Execution } from '../../types/workflow';
import { Plus } from 'lucide-react';

const nodeTypes: NodeTypes = {
  stage: StageNode as any,
};

interface StageCanvasProps {
  workflow: Workflow;
  execution?: Execution | null;
  isSimulating?: boolean;
  onStageDoubleClick: (stageId: string) => void;
  onStageClick?: (stageId: string) => void;
  onAddStation: () => void;
  onStageConnect?: (sourceId: string, targetId: string) => void;
}

export default function StageCanvas({
  workflow,
  execution,
  isSimulating = false,
  onStageDoubleClick,
  onStageClick,
  onAddStation,
  onStageConnect,
}: StageCanvasProps) {
  // Convert workflow stations to React Flow nodes
  const initialNodes = useMemo((): Node[] => {
    return workflow.definition.stations.map((station, index) => ({
      id: station.id,
      type: 'stage',
      position: station.position || { x: index * 350, y: 100 },
      data: {
        station,
        stationIndex: index,
        status: getStationStatus(station.id, execution),
        onDoubleClick: onStageDoubleClick,
        onEditClick: onStageDoubleClick,
      },
    }));
  }, [workflow.definition.stations, execution, onStageDoubleClick]);

  // Create edges between stations (auto-connect by order)
  const initialEdges = useMemo(() => {
    const edges: Edge[] = [];
    const stations = workflow.definition.stations;

    for (let i = 1; i < stations.length; i++) {
      const prevStation = stations[i - 1];
      const currentStation = stations[i];
      
      edges.push({
        id: `stage-edge-${prevStation.id}-${currentStation.id}`,
        source: prevStation.id,
        target: currentStation.id,
        type: 'smoothstep',
        animated: isSimulating,
        style: { 
          stroke: '#8b5cf6', 
          strokeWidth: 3,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#8b5cf6',
          width: 20,
          height: 20,
        },
      });
    }

    return edges;
  }, [workflow.definition.stations, isSimulating]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when workflow changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle manual connection
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        // Add the edge
        setEdges((eds) => addEdge({
          ...params,
          type: 'smoothstep',
          animated: isSimulating,
          style: { stroke: '#8b5cf6', strokeWidth: 3 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#8b5cf6',
            width: 20,
            height: 20,
          },
        }, eds));
        
        // Notify parent about the connection
        onStageConnect?.(params.source, params.target);
      }
    },
    [setEdges, isSimulating, onStageConnect]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onStageClick?.(node.id);
    },
    [onStageClick]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        connectionLineStyle={{ stroke: '#8b5cf6', strokeWidth: 2 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#8b5cf6', strokeWidth: 3 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const status = node.data?.status;
            if (status === 'completed') return '#22c55e';
            if (status === 'failed') return '#ef4444';
            if (status === 'running') return '#3b82f6';
            return '#8b5cf6';
          }}
          style={{ background: 'var(--bg-secondary)' }}
        />

        {/* Empty state */}
        {workflow.definition.stations.length === 0 && (
          <Panel position="top-center">
            <div className="card" style={{ textAlign: 'center', padding: '2rem 3rem' }}>
              <h3>Get Started</h3>
              <p className="text-muted mt-2">Add a stage to begin building your workflow</p>
              <button className="btn btn-primary mt-4" onClick={onAddStation}>
                <Plus size={18} />
                Add Stage
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

// Helper function to get station execution status
function getStationStatus(stationId: string, execution?: Execution | null): string | undefined {
  if (!execution?.result) return undefined;
  
  const stationResult = execution.result.stations.find(s => s.stationId === stationId);
  return stationResult?.status;
}
