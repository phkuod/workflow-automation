import { createContext, runInContext, Context } from 'vm';
import { spawn } from 'child_process';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { URL } from 'url';
import { StepConfig } from '../types/workflow';
import { createLogger } from '../utils/logger';

const log = createLogger('scriptRunner');

const HTTP_REQUEST_TIMEOUT_MS = 30000;
const CONDITION_EVAL_TIMEOUT_MS = 1000;

// Blocked hostname patterns for SSRF protection
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254', // Cloud metadata
  'metadata.google.internal',
]);

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 0.0.0.0
    if (parts[0] === 0) return true;
  }
  return false;
}

export interface ScriptResult {
  success: boolean;
  output?: unknown;
  error?: string;
  logs: string[];
}

export class ScriptRunner {
  /**
   * Execute JavaScript code in a sandboxed VM
   */
  static async executeJS(code: string, inputData: Record<string, unknown>, timeout = 30000): Promise<ScriptResult> {
    const logs: string[] = [];
    
    try {
      // Create sandbox context — user data spread first, then built-ins override
      // so user-controlled keys cannot shadow console, JSON, Object, etc.
      const sandbox: Context = {
        ...inputData,
        console: Object.freeze({
          log: (...args: unknown[]) => logs.push(args.map(a => JSON.stringify(a)).join(' ')),
          error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(a => JSON.stringify(a)).join(' ')}`),
          warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(a => JSON.stringify(a)).join(' ')}`)
        }),
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
        setTimeout: undefined,
        setInterval: undefined,
        setImmediate: undefined,
        fetch: undefined,
        require: undefined,
        process: undefined,
        global: undefined,
        globalThis: undefined,
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
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs
      };
    }
  }

  /**
   * Execute Python code via subprocess
   */
  static async executePython(code: string, context: { variables: Record<string, unknown>, inputData: Record<string, unknown>, steps: Record<string, unknown> }, timeout = 30000): Promise<ScriptResult> {
    return new Promise((resolve) => {
      const logs: string[] = [];
      let output = '';
      let errorOutput = '';

      // Fixed wrapper script — no user data interpolated into code string.
      // All data is passed safely via stdin as JSON.
      const wrapperScript = `
import json, sys

_payload = json.loads(sys.stdin.read())
input_data = _payload['input_data']
steps = _payload['steps']

exec(compile(_payload['code'], '<user_script>', 'exec'))
`;

      const pythonCmd = process.env.PYTHON_CMD || 'python';
      const python = spawn(pythonCmd, ['-c', wrapperScript], {
        timeout
      });

      // Pass user code and data safely via stdin as JSON
      const payload = JSON.stringify({
        input_data: context.inputData || {},
        steps: context.steps || {},
        code
      });
      python.stdin.write(payload);
      python.stdin.end();

      python.stdout.on('data', (data: Buffer) => {
        const str = data.toString();
        output += str;
        logs.push(str.trim());
      });

      python.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      python.on('close', (exitCode: number | null) => {
        if (exitCode === 0) {
          // Try to parse the last line as JSON output
          let parsedOutput: unknown;
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

      python.on('error', (err: Error) => {
        resolve({
          success: false,
          error: `Failed to start Python: ${err.message}`,
          logs
        });
      });
    });
  }

  /**
   * Validate URL to prevent SSRF attacks
   */
  private static validateUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Blocked protocol: ${parsed.protocol} — only http: and https: are allowed`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check against blocked hostnames
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      throw new Error(`Blocked request to restricted host: ${hostname}`);
    }

    // Check if hostname is a private/internal IP
    if (net.isIP(hostname) && isPrivateIP(hostname)) {
      throw new Error(`Blocked request to private/internal IP: ${hostname}`);
    }
  }

  /**
   * Execute HTTP Request
   */
  static async executeHttpRequest(config: StepConfig, inputData: Record<string, unknown>): Promise<ScriptResult> {
    const logs: string[] = [];

    try {
      const url = this.interpolateVariables(config.url || '', inputData);
      const method = config.method || 'GET';
      const headers = config.headers || {};

      // SSRF protection: validate URL before making request
      this.validateUrl(url);
      let body = config.body;

      if (body) {
        body = this.interpolateVariables(body, inputData);
      }

      logs.push(`Making ${method} request to ${url}`);

      const { status, statusText, data } = await this.httpRequest(url, method, headers, body);

      let responseData: unknown;
      try {
        responseData = JSON.parse(data);
      } catch {
        responseData = data;
      }

      logs.push(`Response status: ${status}`);

      if (status >= 200 && status < 300) {
        return {
          success: true,
          output: { status, statusText, data: responseData },
          logs
        };
      } else {
        return {
          success: false,
          error: `HTTP ${status}: ${statusText}`,
          output: { status, statusText, data: responseData },
          logs
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs
      };
    }
  }

  /**
   * Node 16-compatible HTTP request using built-in http/https modules
   */
  private static httpRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<{ status: number; statusText: string; data: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const options: http.RequestOptions = {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: HTTP_REQUEST_TIMEOUT_MS
      };

      const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

      const req = transport.request(options, (res: http.IncomingMessage) => {
        // Follow redirects (3xx) up to 5 times
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          req.destroy();
          resolve({ status: res.statusCode, statusText: `Redirect to ${res.headers.location}`, data: '' });
          return;
        }

        let data = '';
        let size = 0;
        res.on('data', (chunk: Buffer | string) => {
          size += Buffer.byteLength(chunk);
          if (size > MAX_RESPONSE_SIZE) {
            req.destroy();
            reject(new Error(`Response exceeded maximum size of ${MAX_RESPONSE_SIZE} bytes`));
            return;
          }
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request to ${url} timed out`));
      });

      if (body && method !== 'GET') {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * Evaluate condition expression
   */
  static evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    try {
      const interpolated = this.interpolateVariables(condition, context);
      // Use VM sandbox instead of new Function + with() for safer evaluation
      const sandbox = createContext({ ...context });
      const result = runInContext(`(${interpolated})`, sandbox, { timeout: CONDITION_EVAL_TIMEOUT_MS });
      return Boolean(result);
    } catch (error) {
      log.error({ err: error, condition }, `Condition evaluation failed for expression: "${condition}". Defaulting to false.`);
      return false;
    }
  }

  /**
   * Interpolate variables in a string
   * Replaces ${path.to.value} with actual values from context
   */
  static interpolateVariables(template: string, context: Record<string, unknown>): string {
    // Handle both ${var} and {{var}}
    const regex = /\$\{([^}]+)\}|\{\{([^}]+)\}\}/g;
    return template.replace(regex, (match, path1, path2) => {
      const path = (path1 || path2).trim();
      try {
        const value = this.getValueByPath(context, path);
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return value !== undefined && value !== null ? String(value) : '';
      } catch {
        return match;
      }
    });
  }

  /**
   * Get value from object by dot-notation path
   */
  static getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
