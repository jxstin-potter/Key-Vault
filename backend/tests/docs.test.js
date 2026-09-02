import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openApiDocument } from '../src/docs/openapi.js';

/**
 * The anti-drift test.
 *
 * The documentation this replaced was a JSON literal maintained by hand, and
 * it had silently fallen out of date: it advertised neither /api/keys nor
 * /api/checkout - the two routes that make this a key marketplace rather than
 * a generic store. Nothing caught that, because nothing was checking.
 *
 * This walks the Express router stack of the actual application and compares
 * it against the OpenAPI document in both directions. Adding a route without
 * documenting it fails CI; deleting a route without removing its docs fails
 * too. Documentation drift becomes a build error rather than a discovery.
 */

const app = createApp();

/** Express stores a mounted router's prefix only as a regex. Decode it back. */
function decodeMountPath(regexp) {
  return regexp.source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/');
}

/** `/orders/:id/status` -> `/orders/{id}/status` */
const toOpenApiPath = (path) => path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

function collectRoutes(application) {
  const found = new Set();
  const stack = application._router?.stack ?? application.router?.stack ?? [];

  for (const layer of stack) {
    if (layer.route) {
      found.add(toOpenApiPath(layer.route.path));
      continue;
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      const prefix = decodeMountPath(layer.regexp);
      for (const sub of layer.handle.stack) {
        if (!sub.route) continue;
        // A sub-route of '/' means the mount point itself.
        const full = sub.route.path === '/' ? prefix : `${prefix}${sub.route.path}`;
        found.add(toOpenApiPath(full));
      }
    }
  }

  return found;
}

// Served by swagger-ui-express as a middleware chain rather than a route, so
// it never appears in the router stack. It is genuinely mounted; the test
// below proves that by fetching it.
const NOT_IN_ROUTER_STACK = ['/api/docs'];

describe('OpenAPI document', () => {
  it('documents every route the application mounts', () => {
    const mounted = collectRoutes(app);
    const documented = new Set(Object.keys(openApiDocument.paths));

    const undocumented = [...mounted].filter((p) => !documented.has(p)).sort();

    expect(
      undocumented,
      `These routes exist but are not in the OpenAPI document. Add them to ` +
        `src/docs/openapi.js:\n  ${undocumented.join('\n  ')}`
    ).toEqual([]);
  });

  it('does not document routes that no longer exist', () => {
    const mounted = collectRoutes(app);
    const stale = Object.keys(openApiDocument.paths)
      .filter((p) => !mounted.has(p) && !NOT_IN_ROUTER_STACK.includes(p))
      .sort();

    expect(
      stale,
      `These paths are documented but not mounted. Remove them from ` +
        `src/docs/openapi.js:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });

  it('covers the endpoints that define this system', () => {
    // A blunt guard against someone "fixing" the drift test by deleting it.
    // If the key marketplace routes ever fall out of the docs again, this
    // names them explicitly.
    const documented = Object.keys(openApiDocument.paths);
    for (const critical of [
      '/api/checkout/session',
      '/api/webhooks/stripe',
      '/api/keys/mine',
      '/api/keys/bulk',
      '/api/orders/{id}/status'
    ]) {
      expect(documented).toContain(critical);
    }
  });

  it('declares bearer auth on protected endpoints', () => {
    const protectedPaths = ['/api/keys/mine', '/api/checkout/session', '/api/cart'];
    for (const path of protectedPaths) {
      const operations = Object.values(openApiDocument.paths[path]);
      const hasSecurity = operations.some((op) => Array.isArray(op.security) && op.security.length);
      expect(hasSecurity, `${path} should declare bearerAuth`).toBe(true);
    }
  });

  it('leaves the webhook explicitly unauthenticated', () => {
    // Stripe cannot send a bearer token. The webhook authenticates by
    // signature instead, and the document should say so rather than implying
    // a token is required.
    expect(openApiDocument.paths['/api/webhooks/stripe'].post.security).toEqual([]);
  });
});

describe('docs endpoints', () => {
  it('serves the OpenAPI document as JSON', async () => {
    const res = await request(app).get('/api/docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('KeyVault API');
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(30);
  });

  it('serves the interactive reference without a token', async () => {
    const res = await request(app).get('/api/docs/').redirects(1);

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });

  it('does not send a CSP header that would blank the docs page', async () => {
    // helmet's default policy blocks Swagger UI's inline assets, which renders
    // as an empty white page with only a console error to explain it.
    const res = await request(app).get('/api/docs/').redirects(1);
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
