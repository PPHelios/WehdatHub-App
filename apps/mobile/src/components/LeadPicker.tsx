import React, { useState } from 'react';
import { View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ApiLead } from '@wehdathub/shared';
import { api } from '../api';
import { currentLang } from '../auth';
import { errorText } from '../errors';
import { t } from '../i18n';
import { spacing } from '../theme';
import { useDebounced } from '../useDebounced';
import { Button } from './Button';
import { Field } from './Field';
import { EmptyView, ErrorView, Loading } from './StateViews';

export function LeadPicker({ initial = '', onPick }: { initial?: string; onPick: (lead: ApiLead) => void }) {
  const lang = currentLang();
  const [text, setText] = useState(initial);
  const q = useDebounced(text.trim());
  const list = useInfiniteQuery({
    queryKey: ['leads', 'picker', q],
    queryFn: ({ pageParam }) => api.leads({ q, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (page) => page.more ? page.offset + page.limit : undefined,
    enabled: q.length > 0,
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  return <View style={{ gap: spacing.sm }}>
    <Field label={t(lang, 'searchLeads')} value={text} onChangeText={setText} testID="lead-picker-input" />
    {q && list.isPending ? <Loading label={t(lang, 'loading')} /> : null}
    {list.isError ? <ErrorView message={errorText(list.error, lang)} retryLabel={t(lang, 'retry')} onRetry={() => list.refetch()} /> : null}
    {q && list.isSuccess && !items.length ? <EmptyView title={t(lang, 'noLeads')} /> : null}
    {items.map((lead) => <Button key={lead.ref} variant="secondary"
      label={[lead.name, lead.ref, lead.assignee, lead.phones[0] ? '•••' + lead.phones[0].slice(-4) : null].filter(Boolean).join(' · ')}
      disabled={q !== text.trim()} onPress={() => onPick(lead)} />)}
    {list.hasNextPage ? <Button variant="secondary" label={lang === 'ar' ? 'عملاء أكتر' : 'More leads'} loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} /> : null}
  </View>;
}
