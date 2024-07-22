import { TIME_FROM_AGO } from './constants';

const DEFAULT_TTL_IN_SECONDS = 30;

export const callAPI = async (request: Request, cache: Cache, executionCtx: ExecutionContext) => {
  const resp = await fetch(request);

  if (resp.status === 200) {
    const modifiedResp = new Response(resp.body, resp);
    modifiedResp.headers.set('Cache-Control', `public, max-age=${DEFAULT_TTL_IN_SECONDS}`);

    // save cache
    executionCtx.waitUntil(cache.put(request, modifiedResp.clone()));
    return modifiedResp;
  } else {
    return resp;
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
