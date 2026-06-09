import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/**
 * HTTP client for making outbound API requests.
 */
export class HttpClient {
  /**
   * @param {object} options
   * @param {string} [options.baseUrl=''] - Base URL prepended to all paths
   * @param {number} [options.timeout=30000] - Request timeout in milliseconds
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.timeout = options.timeout || 30000;
    this.defaultHeaders = {
      'User-Agent': 'my-node-app/1.0',
      'Accept': 'application/json',
    };
  }

  /**
   * Send a GET request.
   * @param {string} path - URL path or full URL
   * @param {object} [headers] - Additional headers
   * @returns {Promise<{ status: number, body: string }>}
   */
  async get(path, headers = {}) {
    return this.request('GET', path, null, headers);
  }

  /**
   * Send a POST request with a JSON body.
   * @param {string} path - URL path or full URL
   * @param {object|string|null} body - Request body
   * @param {object} [headers] - Additional headers
   * @returns {Promise<{ status: number, body: string }>}
   */
  async post(path, body = null, headers = {}) {
    const payload = typeof body === 'object' ? JSON.stringify(body) : body;
    const contentHeaders = typeof body === 'object'
      ? { 'Content-Type': 'application/json', ...headers }
      : headers;
    return this.request('POST', path, payload, contentHeaders);
  }

  /**
   * Send an HTTP request.
   * @param {string} method
   * @param {string} path
   * @param {string|null} body
   * @param {object} headers
   * @returns {Promise<{ status: number, body: string }>}
   */
  async request(method, path, body = null, headers = {}) {
    const url = new URL(path, this.baseUrl || undefined);
    const isHttps = url.protocol === 'https:';
    const doRequest = isHttps ? httpsRequest : httpRequest;

    const mergedHeaders = { ...this.defaultHeaders, ...headers };

    return new Promise((resolve, reject) => {
      const req = doRequest(url, {
        method,
        headers: mergedHeaders,
        timeout: this.timeout,
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out: ${method} ${url}`));
      });

      if (body) req.write(body);
      req.end();
    });
  }
}
