// The WhatsApp chat reader, shared with the website (generated from the server's domain files: see scripts/sync-chat-domain.mjs).
import ChatParseRaw from './chatParse';
import ChatMatchRaw from './chatMatch';
import ChatFingerprintRaw from './chatFingerprint';

export interface ChatFileRef { name: string; i: number; at: string | null }
export interface ChatPost {
  /** The message number in the chat (stable id of the post). */
  i: number;
  sender: string | null;
  at: string | null;
  text: string;
  /** The message exactly as written in WhatsApp (Arabic digits, blank lines, spacing kept); `text` is the cleaned copy the readers use. */
  orig?: string;
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
export interface ChatUnit { code: string; files: ChatFileRef[]; messages: number; verify: boolean; over: number }
export interface ChatMatchStats { messages: number; dividers: number; photos: number; skippedMedia: number; omittedMedia: number; duplicates: number; truncated: number }
export interface ChatMatchResult {
  mode: 'posts' | 'codes';
  pattern: string;
  stats: ChatMatchStats;
  detected?: string;
  posts?: ChatPost[];
  /** Codes mode only: one entry per known code, in chat order. */
  units?: ChatUnit[];
  unknownCodes?: { token: string; suggestions: string[]; sender: string | null; at: string | null }[];
  noPhotos?: string[];
  tray: { id: string; reason: string; sender: string | null; at: string | null; files: ChatFileRef[] }[];
}
export interface ChatMatchOptions { since?: number | string | null; until?: number | string | null; windowMin?: number; sameSender?: boolean; pattern?: 'auto' | 'photos_first' | 'text_first'; codes?: string[] | null; aliases?: Record<string, string> }
export interface ChatMatcher {
  match(text: string, o?: ChatMatchOptions): ChatMatchResult;
  postCode(text: string): string | null;
  normCode(text: string): string;
  MAX_POSTS: number;
}
export type ChatRangeKind = 'last' | '7' | '30' | '90' | 'all' | 'custom';
export interface ChatParser {
  defaultSince(): string;
  MAX_PHOTOS: number;
  /** The date bounds of an import range choice; `until` is exclusive, a custom until date is inclusive as typed. */
  rangeBounds(kind: ChatRangeKind | string, o?: { now?: Date; lastImportAt?: string | null; since?: string | null; until?: string | null }): { since: string | null; until: string | null };
}

export const ChatMatch = ChatMatchRaw as unknown as ChatMatcher;
export const ChatParse = ChatParseRaw as unknown as ChatParser;

export interface ChatFingerprinter {
  /** at: the chat's own time text ("24/10/2026 10:15") or epoch ms; text: the message as written. Base-36. */
  postFingerprint(sender: string | null, at: string | number | null, text: string): string;
  /** 16 hex characters from the chat file name and the first message's header ("24/10/2026 10:15"). */
  chatFingerprint(chatFileName: string, firstHeader: string): string;
  firstHeaderOf(text: string): string;
  isChatFp(v: unknown): boolean;
  isPostFp(v: unknown): boolean;
}
export const ChatFingerprint = ChatFingerprintRaw as unknown as ChatFingerprinter;
