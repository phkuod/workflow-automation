interface DatabaseConfigFormProps {
  dbType: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbQuery: string;
  onDbTypeChange: (type: string) => void;
  onDbHostChange: (host: string) => void;
  onDbPortChange: (port: number) => void;
  onDbNameChange: (name: string) => void;
  onDbUserChange: (user: string) => void;
  onDbPasswordChange: (password: string) => void;
  onDbQueryChange: (query: string) => void;
}

export default function DatabaseConfigForm({
  dbType, dbHost, dbPort, dbName, dbUser, dbPassword, dbQuery,
  onDbTypeChange, onDbHostChange, onDbPortChange, onDbNameChange,
  onDbUserChange, onDbPasswordChange, onDbQueryChange,
}: DatabaseConfigFormProps) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Database Type</label>
        <select
          className="form-select"
          value={dbType}
          onChange={(e) => onDbTypeChange(e.target.value)}
        >
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
        </select>
      </div>
      <div className="flex gap-2">
        <div className="form-group" style={{ flex: 3 }}>
          <label className="form-label">Host</label>
          <input
            type="text"
            className="form-input"
            value={dbHost}
            onChange={(e) => onDbHostChange(e.target.value)}
            placeholder="localhost"
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Port</label>
          <input
            type="number"
            className="form-input"
            value={dbPort}
            onChange={(e) => onDbPortChange(Number(e.target.value))}
            placeholder="5432"
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Database Name</label>
        <input
          type="text"
          className="form-input"
          value={dbName}
          onChange={(e) => onDbNameChange(e.target.value)}
          placeholder="my_database"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Username</label>
        <input
          type="text"
          className="form-input"
          value={dbUser}
          onChange={(e) => onDbUserChange(e.target.value)}
          placeholder="db_user"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Password</label>
        <input
          type="password"
          className="form-input"
          value={dbPassword}
          onChange={(e) => onDbPasswordChange(e.target.value)}
          placeholder="--------"
        />
      </div>
      <div className="form-group">
        <label className="form-label">SQL Query</label>
        <textarea
          className="form-textarea"
          value={dbQuery}
          onChange={(e) => onDbQueryChange(e.target.value)}
          placeholder="SELECT * FROM users WHERE active = true"
          style={{ minHeight: '120px', fontFamily: 'monospace' }}
        />
        <p className="text-xs text-muted mt-2">
          Use <code>{'${variable}'}</code> syntax for dynamic values.
        </p>
      </div>
    </>
  );
}
