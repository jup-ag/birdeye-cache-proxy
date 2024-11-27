import { TIME_FROM_AGO } from './constants';
import { Context } from 'hono';

const DEFAULT_TTL_IN_SECONDS = 30;

export const callAPI = async (request: Request, cache: Cache, executionCtx: ExecutionContext) => {
  const resp = await fetch(request);

  if (resp.status === 200) {
    const modifiedResp = new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: {
        'Cache-Control': `public, max-age=${DEFAULT_TTL_IN_SECONDS}`,
      },
    });

    // save cache
    executionCtx.waitUntil(cache.put(request, modifiedResp.clone()));
    return modifiedResp;
  } else {
    return new Response(resp.body, {
      headers: resp.headers,
      status: resp.status
    })
  }
};

export const computeTimeAgo = (time: number, timeAgo: TIME_FROM_AGO) => {
  let secondsToSubtract = 0;

  if (timeAgo === TIME_FROM_AGO.ONE_HOUR) {
    secondsToSubtract = 3600;
  } else if (timeAgo === TIME_FROM_AGO.ONE_DAY) {
    secondsToSubtract = 86400;
  } else if (timeAgo === TIME_FROM_AGO.ONE_WEEK) {
    secondsToSubtract = 604800;
  } else if (timeAgo === TIME_FROM_AGO.ONE_MONTH) {
    secondsToSubtract = 2628000;
  } else if (timeAgo === TIME_FROM_AGO.SIX_MONTHS) {
    secondsToSubtract = 15768000;
  } else if (timeAgo === TIME_FROM_AGO.ONE_YEAR) {
    secondsToSubtract = 31536000;
  }

  return time - secondsToSubtract;
};

export const getAddressKeys = (query: Record<string, string>): string[] => {
  const addressKeys: string[] = [];

  Object.entries(query).forEach(([key, value]) => {
    // We have params with different names, but has the word address in it
    if (key.toLowerCase().includes('address')) {
      addressKeys.push(value);
    }
  });

  return addressKeys;
};



export const trackAnalytics = async (c: Context, next: () => Promise<void>) => {
  const token = c.env.MIXPANEL_TOKEN;

  const address = getAddressKeys(c.req.query());
  const properties = JSON.stringify([   {
    properties: {
      address,
      token: 'e57f50a6a30b33c9418a0872c56cb1d8',
      distinct_id: Date.now(),
      $insert_id: Math.random().toString(36)
    },
    event: 'birdeye-proxy'
  }]);



  try {
    fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${token}`,
      },
      body: properties
    });
  } catch (error) {
    console.error('Failed to track analytics:', error);
  } finally {
    await next();
  }
};
