import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

/** The shared queries, defined once: key, fetcher (cancellable), staleTime. Pass `enabled` where the caller needs it. */
export const meOptions = (enabled = true) => queryOptions({ queryKey: ['me'], queryFn: ({ signal }) => api.me(signal), staleTime: 5 * 60_000, enabled });
export const teamOptions = (enabled = true) => queryOptions({ queryKey: ['team'], queryFn: ({ signal }) => api.team(signal), enabled });
export const usageOptions = (enabled = true) => queryOptions({ queryKey: ['usage'], queryFn: ({ signal }) => api.usage(signal), staleTime: 60_000, enabled });
export const configOptions = queryOptions({ queryKey: ['config'], queryFn: ({ signal }) => api.config(signal), staleTime: 5 * 60_000 });
