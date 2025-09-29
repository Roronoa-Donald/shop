const tap = require('tap');
const build = require('../backend/src/server');

tap.test('API Health Check', async (t) => {
  const app = await build();
  
  t.teardown(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/health'
  });

  t.equal(response.statusCode, 200);
  const payload = JSON.parse(response.payload);
  t.equal(payload.status, 'ok');
  t.ok(payload.timestamp);
});

tap.test('Products API', async (t) => {
  const app = await build();
  
  t.teardown(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/products'
  });

  t.equal(response.statusCode, 200);
  const payload = JSON.parse(response.payload);
  t.ok(Array.isArray(payload.products));
  t.ok(payload.pagination);
});

tap.test('Admin OTP Request', async (t) => {
  const app = await build();
  
  t.teardown(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/request-otp',
    payload: {
      email: 'wrong@email.com'
    }
  });

  t.equal(response.statusCode, 403);
  const payload = JSON.parse(response.payload);
  t.equal(payload.error, 'Unauthorized email');
});