import { ClientInfo } from 'whatsapp-web.js';

export interface StatusResponse {
  status: string;
  info: ClientInfo | undefined;
}

export interface ContactResponse {
  name: string;
  number: string;
}

export interface ChatResponse {
  id: string;
  name: string;
  unreadCount: number;
  timestamp: string;
  lastMessage?: string;
}

export interface MessageResponse {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: string;
  contact?: string;
}

export interface SendMessageResponse {
  messageId: string;
}

export interface GroupResponse {
  id: string;
  name: string;
  description?: string;
  participants: GroupParticipant[];
  createdAt: string;
}

export interface GroupParticipant {
  id: string;
  number: string;
  name?: string;
  isAdmin: boolean;
}

export interface CreateGroupResponse {
  groupId: string;
  inviteCode?: string;
}

export interface AddParticipantsResponse {
  success: boolean;
  added: string[];
  failed?: { number: string; reason: string }[];
}

export interface MediaResponse {
  filePath: string;
  mimetype: string;
  filename: string;
  filesize: number;
  messageId: string;
}

export interface SendMediaMessageParams {
  number: string;
  source: string; // URI scheme format: URLs must use http:// or https:// prefixes, local files must use file:// prefix
  caption?: string;
}

export interface SendMediaMessageResponse extends SendMessageResponse {
  mediaInfo: {
    mimetype: string;
    filename: string;
    size?: number;
  };
}

export interface SendStickerParams {
  number: string;
  source: string;
}

export interface CreateStickerFromImageParams {
  number: string;
  source: string;
}

export interface SendVoiceMessageParams {
  number: string;
  source: string; // Audio file path or URL
  duration?: number; // Duration in seconds (optional)
}

export interface SendAudioFileParams {
  number: string;
  source: string; // Audio file path or URL
  caption?: string; // Optional caption for audio file
}

export interface CreateGroupOptions {
  timeout?: number; // Timeout in milliseconds (default: 60000)
  retries?: number; // Number of retries (default: 3)
  retryDelay?: number; // Delay between retries in milliseconds (default: 2000)
}

// Enhanced webhook payload types
export interface WebhookPayload {
  from: string;
  name: string;
  message: string;
  isGroup: boolean;
  timestamp: number;
  messageId: string;
  fromMe: boolean;
  type: string;
  deviceType: string;
  isForwarded: boolean;
  isStarred: boolean;
  hasQuotedMsg: boolean;
  hasReaction: boolean;
  isEphemeral: boolean;
  messageType: MessageType;
  content: MessageContent;
  media?: MediaInfo;
  quotedMessage?: QuotedMessageInfo;
  group?: GroupInfo;
  mentions?: MentionInfo[];
}

export type MessageType = 
  | 'text' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'voice' 
  | 'document' 
  | 'sticker' 
  | 'location' 
  | 'contact' 
  | 'reaction' 
  | 'group_invite' 
  | 'unknown';

export interface MessageContent {
  text?: string;
  caption?: string;
  hasMedia?: boolean;
  mediaType?: string;
  duration?: number;
  isVoiceMessage?: boolean;
  filename?: string;
  location?: LocationInfo;
  contact?: any[];
  reaction?: string;
  quotedMessageId?: string;
  inviteCode?: string;
  inviteExpiration?: number;
}

export interface MediaInfo {
  mimetype: string;
  filename?: string;
  filesize?: number;
  data?: string; // Base64 data
  error?: string;
}

export interface QuotedMessageInfo {
  messageId: string;
  body: string;
  type: string;
  fromMe: boolean;
}

export interface GroupInfo {
  id: string;
  name: string;
  participants: GroupParticipant[];
}

export interface MentionInfo {
  id: string;
  number: string;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}
