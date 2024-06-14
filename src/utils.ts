const DEFAULT_TTL_IN_SECONDS = 60;

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
