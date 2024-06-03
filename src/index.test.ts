/// <reference path="../node_modules/@types/bun/index.d.ts" />

import { expect, test, describe, it } from 'bun:test';

describe('proxy birdeye requests', () => {
  it('should work', async () => {
    type PriceResponse = {
      value: number;
      updateUnixTime: number;
      updateHumanTime: string;
      priceChange24h: number;
    };
    const response = await fetch(
      'http://localhost:8787/defi/multi_price?list_address=So11111111111111111111111111111111111111112,27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
    );
    const { data } = await response.json<{
      data: Record<string, PriceResponse>;
      success: true;
    }>();

    expect(data).toMatchSnapshot({
      So11111111111111111111111111111111111111112: {
        value: expect.any(Number),
        updateUnixTime: expect.any(Number),
        updateHumanTime: expect.any(String),
        priceChange24h: expect.any(Number),
      },
      '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4': {
        value: expect.any(Number),
        updateUnixTime: expect.any(Number),
        updateHumanTime: expect.any(String),
        priceChange24h: expect.any(Number),
      },
    });
  });
});
