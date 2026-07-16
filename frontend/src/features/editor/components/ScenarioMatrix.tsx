import { useState } from 'react';
import { CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import type { Station, StationResult } from '../../../shared/types/workflow';
import type { ScenarioResult } from '../types/scenario';
import JsonTreeView from '../../../shared/components/JsonTreeView';
import { EDGE_COLORS } from '../../../shared/constants/colors';

interface ScenarioMatrixProps {
  results: ScenarioResult[];
  stations: Station[];
}

function CellIcon({ status }: { status?: StationResult['status'] }) {
  if (status === 'completed') return <CheckCircle size={16} style={{ color: EDGE_COLORS.success }} />;
  if (status === 'failed') return <XCircle size={16} style={{ color: EDGE_COLORS.error }} />;
  if (status === 'skipped') return <MinusCircle size={16} style={{ color: EDGE_COLORS.muted }} />;
  return <span style={{ color: 'var(--text-muted)' }}>–</span>;
}

export function ScenarioMatrix({ results, stations }: ScenarioMatrixProps) {
  const [selected, setSelected] = useState<{ s: number; stationId: string } | null>(null);

  const selectedStation: StationResult | undefined =
    selected != null ? results[selected.s]?.result.stations.find((st) => st.stationId === selected.stationId) : undefined;

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Scenario</th>
              {stations.map((st) => (
                <th key={st.id} style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{st.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r, s) => (
              <tr key={`${r.name}-${s}`}>
                <td style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</td>
                {stations.map((st) => {
                  const sr = r.result.stations.find((x) => x.stationId === st.id);
                  return (
                    <td key={st.id} style={{ padding: '2px', textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label={`${r.name} — ${st.name}`}
                        onClick={() => setSelected({ s, stationId: st.id })}
                      >
                        <CellIcon status={sr?.status} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStation && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div className="text-xs font-semibold" style={{ marginBottom: '8px' }}>
            {results[selected!.s].name} · {selectedStation.stationName}
          </div>
          {selectedStation.steps.length === 0 && (
            <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>No actions ran in this stage.</div>
          )}
          {selectedStation.steps.map((step) => (
            <div key={step.stepId} style={{ marginBottom: '10px' }}>
              <div className="text-xs font-semibold" style={{ marginBottom: '4px' }}>
                {step.stepName} — {step.status}
              </div>
              {step.error ? (
                <div className="text-xs" style={{ color: EDGE_COLORS.error }}>{step.error.message}</div>
              ) : (
                <div style={{ background: 'var(--bg-primary)', borderRadius: '6px', padding: '8px', border: '1px solid var(--border-color)' }}>
                  {step.output && Object.keys(step.output).length > 0
                    ? <JsonTreeView data={step.output} />
                    : <span className="text-xs text-muted" style={{ fontStyle: 'italic' }}>No output</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
