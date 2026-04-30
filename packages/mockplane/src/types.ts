export interface MockHandlerDefinition {
  url: string;
  request: {
    method: string;
    headers?: Record<string, string>;
  };
  response: {
    status: number;
    body: unknown;
  };
}

export interface MockFile {
  /** Short SHA-256 hash used for file lookup and cookie/header identification. */
  hash: string;
  /** Human-readable test identifier: "{file} - {title}". */
  label: string;
  handlers: MockHandlerDefinition[];
}

export interface MockOptions {
  /**
   * Directory where per-test mock JSON files are written and read.
   * @default "node_modules/.mockplane"
   */
  mocksDir?: string;
  /**
   * Directory where leaked-requests.txt and incorrect-request-*.txt files are written.
   * @default "test-results"
   */
  resultsDir?: string;
  /**
   * Whether to intercept matching client-side fetch requests via Playwright's
   * page.route(), using the same handler definitions as the server-side MSW
   * interception. Set to false to opt out for a specific test.
   * @default true
   */
  interceptClientSide?: boolean;
}
