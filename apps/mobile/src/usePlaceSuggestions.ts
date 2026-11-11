import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { suggestPlaces, type PlaceMatch } from '@wehdathub/shared';
import { api } from './api';
import { usePlaces } from './placeList';
import { useDebounced } from './useDebounced';

/**
 * Suggestions for typed text. Matched on the phone from the saved place list (no server call per key). Until a list has been
 * downloaded (first open, offline) the server's suggest answers instead, with the same rules.
 */
export function usePlaceSuggestions(text: string): PlaceMatch[] {
  const list = usePlaces((s) => s.list);
  const pending = usePlaces((s) => s.pending);
  const typed = text.trim();
  const local = useMemo(() => (list && typed.length >= 2 ? suggestPlaces(typed, { places: [...list.places, ...pending], areas: list.areas }, 8) : []), [list, pending, typed]);
  const slow = useDebounced(typed, 250);
  const remote = useQuery({ queryKey: ['place-suggest', slow], queryFn: () => api.placeSuggest(slow), enabled: !list && slow.length >= 2, staleTime: 60_000 });
  return list ? local : (remote.data?.items ?? []).map((p) => ({ ...p, lat: null, lng: null }));
}
