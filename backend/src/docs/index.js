import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi.js';

/**
 * Serve the OpenAPI document and an interactive reference.
 *
 * Mounted before the authenticated routes so the docs themselves stay public -
 * an API reference nobody can read without a token is not a reference. The
 * document describes which endpoints require a bearer token; it does not
 * expose any data.
 *
 * @param {import('express').Express} app - The Express app to mount onto.
 *   Call this before mounting authenticated routes/middleware (see app.js),
 *   so the docs subtree is never accidentally gated behind auth.
 * @returns {void} Mutates `app` in place by registering routes.
 */
export function mountApiDocs(app) {
  /**
   * @route GET /api/docs.json
   * @access Public
   * @description The raw OpenAPI 3.1 document - the source of truth
   *   consumed by client generators and by the docs drift test
   *   (tests/docs.test.js), which asserts this document's paths match the
   *   actual mounted router stack in both directions.
   * @returns {200} The OpenAPI document as JSON.
   */
  app.get('/api/docs.json', (req, res) => {
    res.json(openApiDocument);
  });

  /**
   * @route GET /api/docs
   * @access Public
   * @description Interactive Swagger UI reference, rendered from the same
   *   document served at /api/docs.json.
   *
   *   helmet's default Content-Security-Policy blocks the inline styles and
   *   scripts Swagger UI injects, which renders the page blank with only a
   *   CSP console error to explain it. Relaxing CSP for this one subtree is
   *   safer than weakening it globally: nothing here reads user data.
   * @returns {200} The Swagger UI HTML page and its static assets.
   */
  app.use(
    '/api/docs',
    (req, res, next) => {
      res.removeHeader('Content-Security-Policy');
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'KeyVault API reference',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'list' }
    })
  );
}

export { openApiDocument };
export default mountApiDocs;
