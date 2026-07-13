import { useMemo, useState } from 'react';
import type { Workflow, Step } from '../../../shared/types/workflow';
import type { ShapeNode, StepShapeEntry, DataShapesSource } from '../../../shared/types/shapes';
import { Database, Sparkles } from 'lucide-react';
import { ShapeTree } from '../../../shared/components/ShapeTree';
import { aiApi } from '../../../shared/api/workflowApi';
import { useAiEnabled } from '../../../shared/hooks/useAiEnabled';
import { useDataShapes } from '../hooks/useDataShapes';

const aiShapeCache = new Map<string, ShapeNode>();

export function clearAiShapeCacheForTests(): void {
  aiShapeCache.clear();
}

function outputPath(stepName: string, path: string): string {
  return `steps['${stepName}'].output${path.startsWith('[') ? '' : '.'}${path}`;
}

interface VariablePickerProps {
  workflow: Workflow;
  currentStepId: string;
  onSelect: (variablePath: string) => void;
}

export function VariablePicker({ workflow, currentStepId, onSelect }: VariablePickerProps) {
  const availableSteps = useMemo(() => {
    const steps: Step[] = [];
    let currentStepFound = false;

    for (const station of workflow.definition.stations) {
      if (currentStepFound) break;

      for (const step of station.steps) {
        if (step.id === currentStepId) {
          currentStepFound = true;
          break;
        }
        steps.push(step);
      }
    }
    return steps;
  }, [workflow, currentStepId]);

  const shapes = useDataShapes(workflow.id);
  const aiEnabled = useAiEnabled();

  if (availableSteps.length === 0) {
    return (
      <div className="p-3 text-xs text-muted italic border rounded bg-tertiary">
        Nothing to use yet — earlier actions' results appear here.
      </div>
    );
  }

  return (
    <div className="border rounded bg-secondary overflow-hidden">
      <div className="p-2 bg-tertiary border-b text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
        <Database size={12} />
        Use result from
      </div>
      <div className="max-h-48 overflow-auto">
        {availableSteps.map((step) => (
          <div key={step.id} className="border-b last:border-0">
            <div className="p-2 py-1.5 bg-bg-primary/50 text-[11px] font-semibold flex items-center gap-1">
              <span className="opacity-70 dark:opacity-50">#</span> {step.name}
            </div>
            <StepShapeSection
              step={step}
              entry={shapes?.steps[step.id]}
              source={shapes?.source}
              aiEnabled={aiEnabled}
              onSelect={onSelect}
            />
            <div className="p-1 px-2 pb-2 flex flex-wrap gap-1">
              <button
                onClick={() => onSelect(`steps['${step.name}'].output`)}
                className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                title={`Full output object (JS Object) — steps['${step.name}'].output`}
              >
                whole result (as code)
              </button>
              <button
                onClick={() => onSelect(`\${steps['${step.name}'].output}`)}
                className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
                title={`Interpolated string value — \${steps['${step.name}'].output}`}
              >
                whole result (as text)
              </button>
              
              {/* Special helpers for HTTP requests */}
              {step.type === 'http-request' && (
                <>
                  <button
                    onClick={() => onSelect(`steps['${step.name}'].output.data`)}
                    className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
                    title={`Response Body — steps['${step.name}'].output.data`}
                  >
                    response body
                  </button>
                  <button
                    onClick={() => onSelect(`steps['${step.name}'].output.status`)}
                    className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title={`HTTP Status Code — steps['${step.name}'].output.status`}
                  >
                    status code
                  </button>
                </>
              )}

              {step.outputVars?.map((v) => (
                <button
                  key={v.name}
                  onClick={() => onSelect(`steps['${step.name}'].output.${v.name}`)}
                  className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                  title={`${v.description || v.name} — steps['${step.name}'].output.${v.name}`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StepShapeSectionProps {
  step: Step;
  entry?: StepShapeEntry;
  source?: DataShapesSource;
  aiEnabled: boolean;
  onSelect: (variablePath: string) => void;
}

function StepShapeSection({ step, entry, source, aiEnabled, onSelect }: StepShapeSectionProps) {
  const [aiShape, setAiShape] = useState<ShapeNode | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleSelect = (path: string) => onSelect(outputPath(step.name, path));

  if (entry?.shape) {
    return (
      <div className="px-2 pb-1">
        <div className="text-[9px] text-muted mb-0.5">
          📸 From run at {source?.time ? new Date(source.time).toLocaleString() : 'unknown time'}
        </div>
        <ShapeTree shape={entry.shape} onSelectPath={handleSelect} />
      </div>
    );
  }

  if (aiShape) {
    return (
      <div className="px-2 pb-1">
        <div className="text-[9px] text-muted mb-0.5">✨ AI guess — verify before relying on it</div>
        <ShapeTree shape={aiShape} onSelectPath={handleSelect} />
      </div>
    );
  }

  const predict = async () => {
    const cacheKey = `${step.type}:${JSON.stringify(step.config)}`;
    const cached = aiShapeCache.get(cacheKey);
    if (cached) {
      setAiShape(cached);
      return;
    }
    setAiState('loading');
    try {
      const shape = await aiApi.inferShape({ name: step.name, type: step.type, config: step.config as Record<string, unknown> });
      aiShapeCache.set(cacheKey, shape);
      setAiShape(shape);
      setAiState('idle');
    } catch {
      setAiState('error');
    }
  };

  return (
    <div className="px-2 pb-1 flex items-center gap-2">
      {entry && entry.status !== 'completed' && (
        <span className="text-[10px] text-muted italic">No data from last run</span>
      )}
      {aiEnabled && (
        <button
          onClick={predict}
          disabled={aiState === 'loading'}
          className="text-[10px] flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
        >
          <Sparkles size={10} />
          {aiState === 'loading' ? 'Predicting…' : 'Predict fields'}
        </button>
      )}
      {aiState === 'error' && (
        <span className="text-[10px] text-red-500">Could not predict — try again</span>
      )}
    </div>
  );
}
