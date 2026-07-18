import { useEffect, useState } from 'react';
import { workflowApi } from '../../../shared/api/workflowApi';
import type { DataShapesResponse } from '../../../shared/types/shapes';

/** Latest-run output shapes for a workflow; null while loading or unavailable. */
export function useDataShapes(workflowId: string): DataShapesResponse | null {
  const [shapes, setShapes] = useState<DataShapesResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    setShapes(null);
    workflowApi
      .getDataShapes(workflowId)
      .then((data) => { if (mounted) setShapes(data); })
      .catch(() => { if (mounted) setShapes(null); });
    return () => { mounted = false; };
  }, [workflowId]);

  return shapes;
}
