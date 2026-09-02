import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi.js';

/**
 * Serve the OpenAPI document and an interactive reference.
 *
 * Mounted before the authenticated routes so the docs themselves stay public -
 * an API reference nobody can read without a token is not a reference. The
 * document describes which endpoints require a bearer token; it does not
 * expose any data.
 */
export function mountApiDocs(app) {
  // The raw document, for client generators and for the drift test.
  app.get('/api/docs.json', (req, res) => {
    res.json(openApiDocument);
  });

  // helmet's default Content-Security-Policy blocks the inline styles and
  // scripts Swagger UI injects, which renders the page blank with only a CSP
  // console error to explain it. Relaxing CSP for this one subtree is safer
  // than weakening it globally: nothing here reads user data.
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
