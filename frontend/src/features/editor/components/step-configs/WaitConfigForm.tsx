interface WaitConfigFormProps {
  duration: number;
  unit: string;
  onDurationChange: (duration: number) => void;
  onUnitChange: (unit: string) => void;
}

export default function WaitConfigForm({ duration, unit, onDurationChange, onUnitChange }: WaitConfigFormProps) {
  return (
    <div className="flex gap-4">
      <div className="form-group flex-1">
        <label className="form-label">Duration</label>
        <input
          type="number"
          className="form-input"
          value={duration}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          min={1}
        />
      </div>
      <div className="form-group flex-1">
        <label className="form-label">Unit</label>
        <select
          className="form-select"
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
        >
          <option value="seconds">Seconds</option>
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
        </select>
      </div>
    </div>
  );
}
