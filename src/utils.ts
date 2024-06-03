export const addCorsHeaders = (response: Response) => {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY');
  return new Response(response.body, {
    ...response,
    headers: newHeaders,
  });
};
