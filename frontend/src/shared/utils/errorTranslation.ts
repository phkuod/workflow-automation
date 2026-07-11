export interface TranslatedError {
  title: string;
  suggestion?: string;
  raw: string;
  matched: boolean;
}

interface ErrorPattern {
  pattern: RegExp;
  title: string;
  suggestion: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /ETIMEDOUT|ESOCKETTIMEDOUT|timed? ?out/i,
    title: 'The service took too long to respond',
    suggestion: 'Try again later, or increase the timeout in Advanced settings.',
  },
  {
    pattern: /ENOTFOUND|EAI_AGAIN|getaddrinfo/i,
    title: "Couldn't find the service address",
    suggestion: 'Check the URL for typos.',
  },
  {
    pattern: /ECONNREFUSED/i,
    title: 'The service refused the connection',
    suggestion: 'The service may be down, or the port may be wrong.',
  },
  {
    pattern: /invalid login|EAUTH|535/i,
    title: 'Email sign-in failed',
    suggestion: 'Check the SMTP username and password settings.',
  },
  {
    pattern: /unexpected token|JSON at position|is not valid JSON/i,
    title: "The data received wasn't in the expected format",
    suggestion: 'The service may have returned an error page instead of data.',
  },
  {
    pattern: /status code 404/i,
    title: "The address wasn't found (404)",
    suggestion: 'Check the URL path.',
  },
  {
    pattern: /status code 40[13]/i,
    title: 'Access to the service was denied',
    suggestion: 'Check the credentials or API key in Advanced settings.',
  },
  {
    pattern: /status code 5\d\d/i,
    title: 'The external service had an internal problem',
    suggestion: 'This is on their side — try again later.',
  },
];

/** Map a raw error message to a plain-English explanation. */
export function translateError(message: string): TranslatedError {
  for (const { pattern, title, suggestion } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return { title, suggestion, raw: message, matched: true };
    }
  }
  return { title: message, raw: message, matched: false };
}
