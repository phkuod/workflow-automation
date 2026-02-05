import { createContext, runInContext, Context } from 'vm';
import { spawn } from 'child_process';
import { StepConfig } from '../types/workflow';

export interface ScriptResult {
  success: boolean;
  output?: any;
  error?: string;
  logs: string[];
}

export class ScriptRunner {
  /**
   * Execute JavaScript code in a sandboxed VM
   */
  static async executeJS(code: string, inputData: Record<string, any>, timeout = 30000): Promise<ScriptResult> {
    const logs: string[] = [];
    
    try {
      // Create sandbox context
      const sandbox: Context = {
        ...inputData,
        console: {
          log: (...args: any[]) => logs.push(args.map(a => JSON.stringify(a)).join(' ')),
          error: (...args: any[]) => logs.push(`[ERROR] ${args.map(a => JSON.stringify(a)).join(' ')}`),
          warn: (...args: any[]) => logs.push(`[WARN] ${args.map(a => JSON.stringify(a)).join(' ')}`)
        },
        JSON,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        setTimeout: undefined, // Disabled for security
        setInterval: undefined,
        fetch: undefined // Could enable if needed
      };

      const context = createContext(sandbox);

      // Wrap code to capture return value
      const wrappedCode = `
        (function() {
          ${code}
        })()
      `;

      const result = runInContext(wrappedCode, context, {
        timeout,
        displayErrors: true
      });

      return {
        success: true,
        output: result,
        logs
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        logs
      };
    }
  }

  /**
   * Execute Python code via subprocess
   */
  static async executePython(code: string, context: { variables: Record<string, any>, inputData: Record<string, any>, steps: Record<string, any> }, timeout = 30000): Promise<ScriptResult> {
    return new Promise((resolve) => {
      const logs: string[] = [];
      let output = '';
      let errorOutput = '';

      // Prepare Python script with input data and steps (Zero-Config access)
      const pythonScript = `
import json
import sys

# Input data (legacy)
input_data = json.loads('''${JSON.stringify(context.inputData)}''')

# Steps (Zero-Config access) - access via steps['Step Name']['output']
steps = json.loads('''${JSON.stringify(context.steps)}''')

# User code
${code}
`;

      const pythonCmd = process.env.PYTHON_CMD || 'python';
      const python = spawn(pythonCmd, ['-c', pythonScript], {
        timeout
      });

      python.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;
        logs.push(str.trim());
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (exitCode) => {
        if (exitCode === 0) {
          // Try to parse the last line as JSON output
          let parsedOutput: any;
          try {
            const lines = output.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            parsedOutput = JSON.parse(lastLine);
          } catch {
            parsedOutput = output.trim();
          }

          resolve({
            success: true,
            output: parsedOutput,
            logs
          });
        } else {
          resolve({
            success: false,
            error: errorOutput || `Python exited with code ${exitCode}`,
            logs
          });
        }
      });

      python.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to start Python: ${err.message}`,
          logs
        });
      });
    });
  }

  /**
   * Execute HTTP Request
   */
  static async executeHttpRequest(config: StepConfig, inputData: Record<string, any>): Promise<ScriptResult> {
    const logs: string[] = [];

    try {
      const url = this.interpolateVariables(config.url || '', inputData);
      const method = config.method || 'GET';
      const headers = config.headers || {};
      let body = config.body;

      if (body) {
        body = this.interpolateVariables(body, inputData);
      }

      logs.push(`Making ${method} request to ${url}`);

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (body && method !== 'GET') {
        fetchOptions.body = body;
      }

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();
      
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      logs.push(`Response status: ${response.status}`);

      if (response.ok) {
        return {
          success: true,
          output: {
            status: response.status,
            statusText: response.statusText,
            data: responseData
          },
          logs
        };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          output: {
            status: response.status,
            statusText: response.statusText,
            data: responseData
          },
          logs
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        logs
      };
    }
  }

  /**
   * Evaluate condition expression
   */
  static evaluateCondition(condition: string, context: Record<string, any>): boolean {
    try {
      const interpolated = this.interpolateVariables(condition, context);
      // Safe evaluation using Function constructor
      const fn = new Function('context', `with(context) { return ${interpolated}; }`);
      return Boolean(fn(context));
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return false;
    }
  }

  /**
   * Interpolate variables in a string
   * Replaces ${path.to.value} with actual values from context
   */
  static interpolateVariables(template: string, context: Record<string, any>): string {
    // Handle both ${var} and {{var}}
    const regex = /\$\{([^}]+)\}|\{\{([^}]+)\}\}/g;
    return template.replace(regex, (match, path1, path2) => {
      const path = (path1 || path2).trim();
      try {
        const value = this.getValueByPath(context, path);
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value ?? match);
      } catch {
        return match;
      }
    });
  }

  /**
   * Get value from object by dot-notation path
   */
  static getValueByPath(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
