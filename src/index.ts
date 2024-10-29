import { Hono } from 'hono';
import { BlankSchema } from 'hono/types';
import { cors } from 'hono/cors';
import { callAPI, computeTimeAgo } from './utils';
import { TIME_FROM_AGO } from './constants';

const app = new Hono<
  {
    Bindings: {
      BIRDEYE_API_KEY: string;
      CODEX_API_KEY: string;
    };
  },
  BlankSchema,
  '/'
>();

app.all(
  '*',
  cors({
    allowHeaders: ['*'],
    origin: '*',
    maxAge: 7200,
    allowMethods: ['GET', 'POST'],
  }),
);

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
    return new Response(cached.body);
  } else {
    try {
      return await callAPI(request, cache, executionCtx);
    } catch (error) {
      console.log({ error });
    }
  }
});

app.get('/defi/ohlcv/*', async ({ env, req, text, executionCtx }) => {
  const { BIRDEYE_API_KEY } = env;
  if (!BIRDEYE_API_KEY) {
    throw new Error('BIRDEYE_API_KEY is not set');
  }

  const query = req.query();
  const { time_to: timeTo, time_ago: timeAgo, round_off_epoch: roundOffEpoch, time_from } = query;

  if (!timeTo) {
    throw new Error('time_to is required');
  }

  // we do time_from to be backward compatible
  if (!time_from) {
    if (!timeAgo || !(timeAgo in TIME_FROM_AGO)) {
      throw new Error('time_ago is required or invalid');
    }

    if (!roundOffEpoch) {
      throw new Error('round_epoch is required');
    }
  }

  const roundedTimeTo = Math.floor(+timeTo / +roundOffEpoch) * +roundOffEpoch;
  const timefrom = time_from || computeTimeAgo(roundedTimeTo, timeAgo as TIME_FROM_AGO);

  const params = new URLSearchParams({
    ...query,
    time_from: timefrom.toString(),
    time_to: roundedTimeTo.toString(),
  });

  // clean up params
  params.delete('time_ago');
  params.delete('round_off_epoch');

  const url = `https://public-api.birdeye.so${req.path}?${params.toString()}`;

  const request = new Request(url, {
    headers: new Headers({
      'X-API-KEY': BIRDEYE_API_KEY || '',
    }),
  });

  let cache = caches.default;
  const cached = await cache.match(request);

  if (cached) {
    console.log('cached');
    return new Response(cached.body);
  } else {
    try {
      return await callAPI(request, cache, executionCtx);
    } catch (error) {
      console.log({ error });
    }
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
    return new Response(cached.body);
  } else {
    try {
      return await callAPI(request, cache, executionCtx);
    } catch (error) {
      console.log({ error });
    }
  }
});

app.get('/codex/getTokenPrices', async ({ env, req, executionCtx }) => {
  const { CODEX_API_KEY } = env;
  if (!CODEX_API_KEY) {
    throw new Error('CODEX_API_KEY is not set');
  }

  const listAddress = req.query('list_address')?.split(',');
  if (listAddress?.length === 0)
    return new Response(JSON.stringify({ message: 'No address detected' }), { status: 400 });
  if (listAddress?.length && listAddress?.length > 25)
    return new Response(JSON.stringify({ message: 'Up to 25 addresses supported per request' }), { status: 400 });

  // solana networkId is 1399811149
  const request = new Request('https://graph.defined.fi/graphql', {
    method: 'POST',
    headers: new Headers({
      'Content-Type': 'application/json',
      Authorization: CODEX_API_KEY,
      Origin: 'https://jup.ag', // TODO: It's a pain to support origin as of the moment due to whitelisting, let's fix tomorrow
    }),
    body: JSON.stringify({
      query: `{
        getTokenPrices(inputs: [
          ${listAddress?.map((addr) => `{ address:"${addr}" networkId:1399811149 }`)}
        ]) {
          priceUsd
          timestamp
        }
      }`,
    }),
  });

  let cache = caches.default;
  // Purposely patch request to GET so caching can work
  const userRequest = new Request(req.url);
  const cached = await cache.match(userRequest);
  const cachedJson = cached
    ? ((await cached.json()) as {
        data: {
          getTokenPrices: Array<{
            priceUsd: number;
            timestamp: number;
          }>;
        };
      })
    : null;

  const cacheExpired = cachedJson ? Date.now() / 1000 - cachedJson.data.getTokenPrices[0].timestamp > 30 : false;

  if (cached && !cacheExpired) {
    console.log(`HIT: ${req.url}`);
    return new Response(JSON.stringify(cachedJson), { headers: cached.headers });
  } else {
    try {
      const resp = await fetch(request);

      if (resp.status === 200) {
        const modifiedResp = new Response(resp.body, {
          status: resp.status,
          statusText: resp.statusText,
          headers: {
            'Cache-Control': `public, max-age=30`,
          },
        });

        // save cache
        executionCtx.waitUntil(cache.put(userRequest, modifiedResp.clone()));
        return modifiedResp;
      } else {
        return new Response(resp.body, {
          headers: resp.headers,
          status: resp.status,
        });
      }
    } catch (error) {
      console.log({ error });
    }
  }
});

export default app;
