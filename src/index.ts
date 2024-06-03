import { Hono } from 'hono';
import { BlankEnv, BlankSchema } from 'hono/types';
import { addCorsHeaders } from './utils';

const DEFAULT_TTL_IN_SECONDS = 60;

const app = new Hono<
  {
    Bindings: {
      BIRDEYE_API_KEY: string;
    };
  },
  BlankSchema,
  '/'
>();

app.options('/defi/*', async ({ req }) => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
});

app.get('/defi/history_price', async ({ env, req, text, executionCtx }) => {
  const { BIRDEYE_API_KEY } = env;
  if (!BIRDEYE_API_KEY) {
    throw new Error('BIRDEYE_API_KEY is not set');
  }

  const timeTo = req.query()['time_to'];

  if (!timeTo) {
    throw new Error('time_to is required');
  }

  const flooredToMinTimeTo = Math.floor(+timeTo / 100) * 100;
  const timefrom = flooredToMinTimeTo - 86400; // 1 day ago

  const params = new URLSearchParams({
    ...req.query(),
    address_type: 'token',
    time_from: timefrom.toString(),
    time_to: flooredToMinTimeTo.toString(),
  });

  const url = `https://public-api.birdeye.so/defi/history_price?${params.toString()}`;

  const request = new Request(url, {
    headers: new Headers({
      'X-API-KEY': BIRDEYE_API_KEY || '',
    }),
  });

  let cache = caches.default;
  const cached = await cache.match(request);

  if (cached) {
    console.log('cached');
    return addCorsHeaders(cached);
  } else {
    const resp = await fetch(request);
    const modifiedResp = new Response(resp.body, resp);
    modifiedResp.headers.set('Cache-Control', `public, max-age=${DEFAULT_TTL_IN_SECONDS}`);

    // save cache
    executionCtx.waitUntil(cache.put(request, modifiedResp.clone()));

    return addCorsHeaders(modifiedResp);
  }
});

app.get('/defi/*', async ({ env, req, text, executionCtx }) => {
  const { BIRDEYE_API_KEY } = env;
  if (!BIRDEYE_API_KEY) {
    throw new Error('BIRDEYE_API_KEY is not set');
  }

  // Add cache API to cache birdeye responses
  let url = req.url.split(req.header('host') || '')[1];

  url = `https://public-api.birdeye.so${url}`;

  const request = new Request(url, {
    headers: new Headers({
      'X-API-KEY': BIRDEYE_API_KEY || '',
    }),
  });

  let cache = caches.default;
  const cached = await cache.match(request);

  if (cached) {
    console.log('cached');
    return addCorsHeaders(cached);
  } else {
    const resp = await fetch(request);
    const modifiedResp = new Response(resp.body, resp);
    modifiedResp.headers.set('Cache-Control', `public, max-age=${DEFAULT_TTL_IN_SECONDS}`);

    // save cache
    executionCtx.waitUntil(cache.put(request, modifiedResp.clone()));

    return addCorsHeaders(modifiedResp);
  }
});

export default app;
