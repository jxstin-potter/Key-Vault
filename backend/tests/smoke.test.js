import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createProduct, countKeys } from './helpers/factories.js';

const app = createApp();

describe('test harness', () => {
  it('serves the liveness probe', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('reaches a real database', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });

  it('builds fixtures with real key rows', async () => {
    const product = await createProduct({ availableKeys: 3 });
    expect(await countKeys(product.id, 'AVAILABLE')).toBe(3);
  });
});
