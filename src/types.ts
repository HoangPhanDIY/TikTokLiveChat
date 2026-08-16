export interface TikTokUserBadge {
  type: string;
  name?: string;
}

export interface TikTokCommentEvent {
  id: string;
  type: "chat";
  uniqueId: string;
  nickname: string;
  comment: string;
  userId?: string;
  profilePictureUrl?: string;
  userBadges?: TikTokUserBadge[];
  timestamp: number;
  isModerator?: boolean;
  isSubscriber?: boolean;
  followRole?: number;
  isPinned?: boolean;
  isRead?: boolean;
}

export interface TikTokGiftEvent {
  id: string;
  type: "gift";
  uniqueId: string;
  nickname: string;
  giftId: number | string;
  giftName: string;
  giftPictureUrl?: string;
  diamondCount: number;
  repeatCount: number;
  userId?: string;
  profilePictureUrl?: string;
  timestamp: number;
}

export interface TikTokLikeEvent {
  id: string;
  type: "like";
  uniqueId: string;
  nickname: string;
  likeCount: number;
  totalLikeCount: number;
  profilePictureUrl?: string;
  timestamp: number;
}

export interface TikTokMemberEvent {
  id: string;
  type: "member";
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  timestamp: number;
}

export interface TikTokSocialEvent {
  id: string;
  type: "social";
  uniqueId: string;
  nickname: string;
  displayType: string; // follow or share
  label?: string;
  profilePictureUrl?: string;
  timestamp: number;
}

export type LiveFeedItem =
  | TikTokCommentEvent
  | TikTokGiftEvent
  | TikTokLikeEvent
  | TikTokMemberEvent
  | TikTokSocialEvent;

export interface RoomInfo {
  title: string;
  ownerName: string;
  ownerAvatar: string;
  viewerCount: number;
  likeCount: number;
  giftCount: number;
  startedAt: number;
}

export type TtsEngine = "google_authentic" | "web_speech";

export interface TtsSettings {
  enabled: boolean;
  engine: TtsEngine;
  voiceName: string;
  rate: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 1.5
  volume: number; // 0 to 1
  delayBetweenMessages: number; // in seconds
  
  // Format & Content rules
  readSenderName: boolean;
  nameCommentSeparator: string; // "nói:", "bảo:", "hỏi:", ":"
  readGifts: boolean;
  giftTemplate: string; // "Cảm ơn {name} đã tặng {count} {gift}"
  minGiftDiamonds: number;
  readFollows: boolean;
  readLikes: boolean;
  
  // Filters
  minCharLength: number;
  maxCharLength: number;
  stripEmojis: boolean;
  simplifyRepeatedChars: boolean;
  blacklistWords: string[];
  blockPrefixes: string[]; // e.g. "!", "/"
  onlyReadQuestions: boolean;
  soundEffects: boolean;
}

export interface QueueItem {
  id: string;
  textToSpeak: string;
  sender: string;
  originalText: string;
  type: "chat" | "gift" | "social";
  addedAt: number;
}
