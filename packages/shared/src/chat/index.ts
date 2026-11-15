// The WhatsApp chat reader, shared with the website (generated from the server's domain files: see scripts/sync-chat-domain.mjs).
import ChatParseRaw from './chatParse';
import ChatMatchRaw from './chatMatch';

export interface ChatFileRef { name: string; i: number; at: string | null }
export interface ChatPost {
  /** The message number in the chat (stable id of the post). */
  i: number;
  sender: string | null;
  at: string | null;
  text: string;
  /** The unit code the post writes, upper-case, or null. */
  code: string | null;
  /** Photos of the post in chat order, up to 60 (a unit keeps 15). */
  files: ChatFileRef[];
  /** Photos beyond the 60 kept. */
  over: number;
  /** Videos and other files next to the post: never uploaded. */
  videos: number;
  verify: boolean;
}
export interface ChatMatchStats { messages: number; dividers: number; photos: number; skippedMedia: number; omittedMedia: number; duplicates: number; truncated: number }
export interface ChatMatchResult {
  mode: 'posts' | 'codes';
  pattern: string;
  stats: ChatMatchStats;
  posts?: ChatPost[];
  tray: { id: string; reason: string; sender: string | null; at: string | null; files: ChatFileRef[] }[];
}
export interface ChatMatchOptions { since?: string | null; windowMin?: number; sameSender?: boolean; pattern?: 'auto' | 'photos_first' | 'text_first'; codes?: string[] | null; aliases?: Record<string, string> }
export interface ChatMatcher {
  match(text: string, o?: ChatMatchOptions): ChatMatchResult;
  postCode(text: string): string | null;
  normCode(text: string): string;
  MAX_POSTS: number;
}
export interface ChatParser { defaultSince(): string; MAX_PHOTOS: number }

export const ChatMatch = ChatMatchRaw as unknown as ChatMatcher;
export const ChatParse = ChatParseRaw as unknown as ChatParser;
