import { describe, expect, test } from 'vitest';
import fx from './place-suggest.fixture.json';
import { suggestPlaces, type ListArea, type ListPlace } from './placeMatch';

// The same file the server's test checks (tests/fixtures/place-suggest.json): both copies must give the same answers.
const places = fx.places as ListPlace[];
const areas = fx.areas as ListArea[];

describe('place matching matches the server', () => {
  test.each(fx.cases.map((c) => [c.q, c.expect] as [string, string[]]))('suggest %j', (q, expected) => {
    expect(suggestPlaces(q, { places, areas }, 8).map((r) => r.id)).toEqual(expected);
  });
  test('a compound carries its coordinates for the map', () => {
    const [first] = suggestPlaces('mivida', { places, areas });
    expect(first.lat).toBe(30);
    expect(first.lng).toBe(31.55);
  });
});
