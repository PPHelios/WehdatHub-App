import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { boxSuggest, type BoxItem, type Lang } from '@wehdathub/shared';
import { api } from './api';
import { usePlaces } from './placeList';
import { useDebounced } from './useDebounced';

/**
 * The unit box's suggestions for typed text: places, then features. Answered on the phone from the saved list (no call per key,
 * and it works offline). A list saved before the box has no features, and none saved yet means nothing to match: then the server's
 * GET /places/box answers, with the same rules. `areasOnly` leaves compounds out (the project forms and the catalogue box: a place is an area or a sub-area).
 */
export function useBoxItems(text: string, lang: Lang, areasOnly = false): BoxItem[] {
  const list = usePlaces((s) => s.list);
  const pending = usePlaces((s) => s.pending);
  const typed = text.trim();
  const onPhone = Boolean(list?.features);
  const local = useMemo(
    () => (list?.features && typed.length >= 2 ? boxSuggest(typed, { places: areasOnly ? [] : [...list.places, ...pending], areas: list.areas, zones: list.zones, features: list.features }, lang) : []),
    [list, pending, typed, lang, areasOnly],
  );
  const slow = useDebounced(typed, 180);
  const remote = useQuery({ queryKey: ['unit-box', slow, lang, areasOnly], queryFn: () => (areasOnly ? api.placeBox(slow, lang, 'areas') : api.placeBox(slow, lang)), enabled: !onPhone && slow.length >= 2, staleTime: 60_000 });
  if (onPhone) return local;
  return typed.length >= 2 ? remote.data?.items ?? [] : [];
}
