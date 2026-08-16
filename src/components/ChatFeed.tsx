import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Gift,
  Heart,
  UserPlus,
  Share2,
  Volume2,
  Pin,
  Search,
  Trash2,
  ArrowDown,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Award,
  Crown,
} from "lucide-react";
import { LiveFeedItem, TikTokCommentEvent, TikTokGiftEvent } from "../types";

interface ChatFeedProps {
  feedItems: LiveFeedItem[];
  currentSpeakingId?: string;
  onSpeakItem: (item: LiveFeedItem) => void;
  onTogglePin: (id: string) => void;
  onClearFeed: () => void;
  soundEnabled: boolean;
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  feedItems,
  currentSpeakingId,
  onSpeakItem,
  onTogglePin,
  onClearFeed,
}) => {
  const [activeFilter, setActiveFilter] = useState<
    "all" | "chat" | "gift" | "question" | "pinned"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // Filter items
  const filteredItems = (feedItems || []).filter((item) => {
    if (!item) return false;
    // 1. Filter by category
    if (activeFilter === "chat" && item.type !== "chat") return false;
    if (activeFilter === "gift" && item.type !== "gift") return false;
    if (activeFilter === "question") {
      if (item.type !== "chat") return false;
      const c = ((item as TikTokCommentEvent).comment || "").toLowerCase();
      if (
        !c.includes("?") &&
        !c.includes("không") &&
        !c.includes("sao") &&
        !c.includes("hả") &&
        !c.includes("bao nhiêu")
      ) {
        return false;
      }
    }
    if (activeFilter === "pinned") {
      if (item.type !== "chat" || !(item as TikTokCommentEvent).isPinned)
        return false;
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nicknameMatch = (item.nickname || "").toLowerCase().includes(q);
      const uniqueIdMatch = (item.uniqueId || "").toLowerCase().includes(q);
      const textMatch =
        item.type === "chat" &&
        ((item as TikTokCommentEvent).comment || "").toLowerCase().includes(q);
      const giftMatch =
        item.type === "gift" &&
        ((item as TikTokGiftEvent).giftName || "").toLowerCase().includes(q);
      return nicknameMatch || uniqueIdMatch || textMatch || giftMatch;
    }

    return true;
  });

  // Handle auto-scroll
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
      setNewMessagesCount(0);
    } else {
      setNewMessagesCount((prev) => prev + 1);
    }
  }, [feedItems.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
    if (isAtBottom) {
      setNewMessagesCount(0);
    }
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
      setAutoScroll(true);
      setNewMessagesCount(0);
    }
  };

  const commentCount = feedItems.filter((i) => i.type === "chat").length;
  const giftCount = feedItems.filter((i) => i.type === "gift").length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col h-[800px] shadow-xl overflow-hidden backdrop-blur-sm">
      {/* Feed Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-pink-400" />
            <h3 className="font-semibold text-sm text-slate-100">
              Bình luận & Sự kiện Live
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {feedItems.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {feedItems.length > 0 && (
              <button
                onClick={onClearFeed}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Xóa danh sách bình luận"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xóa chat</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                activeFilter === "all"
                  ? "bg-pink-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Tất cả ({feedItems.length})
            </button>
            <button
              onClick={() => setActiveFilter("chat")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                activeFilter === "chat"
                  ? "bg-pink-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              Chat ({commentCount})
            </button>
            <button
              onClick={() => setActiveFilter("gift")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                activeFilter === "gift"
                  ? "bg-pink-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Gift className="w-3 h-3 text-amber-300" />
              Quà ({giftCount})
            </button>
            <button
              onClick={() => setActiveFilter("question")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                activeFilter === "question"
                  ? "bg-pink-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Lọc các bình luận đặt câu hỏi"
            >
              <HelpCircle className="w-3 h-3 text-cyan-400" />
              Câu hỏi (?)
            </button>
            <button
              onClick={() => setActiveFilter("pinned")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                activeFilter === "pinned"
                  ? "bg-pink-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Pin className="w-3 h-3 text-yellow-400" />
              Ghim
            </button>
          </div>

          <div className="relative flex-1 min-w-[130px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm người dùng, nội dung..."
              className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-pink-500"
            />
          </div>
        </div>
      </div>

      {/* Main Comment List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2.5 relative scroll-smooth divide-y divide-slate-800/40"
      >
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-slate-600" />
            </div>
            <p className="font-semibold text-slate-300 text-sm">
              Chưa có bình luận nào
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Hãy kết nối với phòng Live hoặc bấm "Test Giả Lập" để trải nghiệm
              thử giọng đọc Chị Google ngay!
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isCurrentlySpeaking = currentSpeakingId === item.id;

            if (item.type === "chat") {
              const chatItem = item as TikTokCommentEvent;
              const commentStr = chatItem.comment || "";
              const isQuestion =
                commentStr.includes("?") ||
                commentStr.toLowerCase().includes("sao") ||
                commentStr.toLowerCase().includes("không");

              return (
                <div
                  key={chatItem.id}
                  className={`pt-2.5 first:pt-0 group transition rounded-xl p-2.5 ${
                    chatItem.isPinned
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : isCurrentlySpeaking
                        ? "bg-pink-500/15 border border-pink-500/40 shadow-md shadow-pink-500/10 ring-1 ring-pink-500/30"
                        : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* User Avatar */}
                    <img
                      src={
                        chatItem.profilePictureUrl ||
                        `/api/avatar?name=${encodeURIComponent(chatItem.nickname || "U")}&uniqueId=${encodeURIComponent(chatItem.uniqueId || "")}`
                      }
                      alt={chatItem.nickname || "User"}
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700 mt-0.5 bg-slate-900"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          `/api/avatar?name=${encodeURIComponent(chatItem.nickname || "U")}&uniqueId=${encodeURIComponent(chatItem.uniqueId || "")}`;
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Name & Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-slate-200 truncate max-w-[150px]">
                          {chatItem.nickname || "Khách"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          @{chatItem.uniqueId || "user"}
                        </span>

                        {chatItem.isModerator && (
                          <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 rounded text-[10px] flex items-center gap-0.5 border border-blue-500/30">
                            <ShieldCheck className="w-2.5 h-2.5" /> Quản trị
                            viên
                          </span>
                        )}

                        {chatItem.isSubscriber && (
                          <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded text-[10px] flex items-center gap-0.5 border border-purple-500/30">
                            <Crown className="w-2.5 h-2.5" /> Hội viên
                          </span>
                        )}

                        {chatItem.isPinned && (
                          <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[10px] flex items-center gap-0.5 border border-amber-500/30 font-medium">
                            <Pin className="w-2.5 h-2.5" /> Đã ghim
                          </span>
                        )}

                        {isCurrentlySpeaking && (
                          <span className="px-1.5 py-0.2 bg-pink-500 text-white rounded text-[10px] flex items-center gap-1 font-bold animate-pulse">
                            <Volume2 className="w-3 h-3" /> ĐANG ĐỌC
                          </span>
                        )}
                      </div>

                      {/* Comment Body */}
                      <p
                        className={`text-sm mt-1 leading-relaxed break-words ${
                          isQuestion
                            ? "text-cyan-200 font-medium"
                            : "text-slate-100"
                        }`}
                      >
                        {chatItem.comment}
                      </p>

                      {/* Quick action bar */}
                      <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                        <span className="text-[10px] text-slate-400">
                          {new Date(chatItem.timestamp).toLocaleTimeString(
                            "vi-VN",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            },
                          )}
                        </span>

                        <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={() => onSpeakItem(chatItem)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-700 text-pink-300 hover:text-pink-200 transition cursor-pointer"
                            title="Đọc lại bình luận này bằng Chị Google"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>Đọc lại</span>
                          </button>

                          <button
                            onClick={() => onTogglePin(chatItem.id)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-700 transition cursor-pointer ${
                              chatItem.isPinned
                                ? "text-amber-400"
                                : "text-slate-400 hover:text-amber-300"
                            }`}
                            title={
                              chatItem.isPinned ? "Bỏ ghim" : "Ghim bình luận"
                            }
                          >
                            <Pin className="w-3 h-3" />
                            <span>
                              {chatItem.isPinned ? "Bỏ ghim" : "Ghim"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type === "gift") {
              const giftItem = item as TikTokGiftEvent;
              return (
                <div
                  key={giftItem.id}
                  className={`pt-2.5 first:pt-0 rounded-xl p-3 border transition ${
                    isCurrentlySpeaking
                      ? "bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-amber-500/10 border-amber-500/50 shadow-lg"
                      : "bg-gradient-to-r from-amber-500/10 to-pink-500/5 border-amber-500/20 hover:border-amber-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {giftItem.giftPictureUrl ? (
                          <img
                            src={giftItem.giftPictureUrl}
                            alt={giftItem.giftName}
                            className="w-10 h-10 object-contain drop-shadow-md"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold">
                            🎁
                          </div>
                        )}
                        {giftItem.repeatCount > 1 && (
                          <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full border border-slate-900 shadow">
                            x{giftItem.repeatCount}
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-amber-200">
                            {giftItem.nickname}
                          </span>
                          <span className="text-[10px] text-amber-400/80">
                            đã tặng
                          </span>
                          <span className="font-bold text-xs text-white bg-pink-500/30 px-1.5 py-0.2 rounded border border-pink-500/40">
                            {giftItem.giftName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-amber-300/80">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            {giftItem.diamondCount * giftItem.repeatCount} kim
                            cương
                          </span>
                          <span>•</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(giftItem.timestamp).toLocaleTimeString(
                              "vi-VN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onSpeakItem(giftItem)}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer"
                      title="Đọc lời cảm ơn bằng Chị Google"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Đọc cảm ơn</span>
                    </button>
                  </div>
                </div>
              );
            }

            if (item.type === "like") {
              return (
                <div
                  key={item.id}
                  className="pt-2 first:pt-0 px-2 py-1 text-xs text-rose-300 flex items-center gap-2 bg-rose-500/5 rounded-lg border border-rose-500/10"
                >
                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />
                  <span>
                    <b className="text-slate-200">{item.nickname}</b> đã thả tim{" "}
                    {(item as any).likeCount} lần
                  </span>
                </div>
              );
            }

            if (item.type === "social") {
              const socItem = item as any;
              const isShare = socItem.displayType === "share";
              return (
                <div
                  key={item.id}
                  className="pt-2 first:pt-0 px-2 py-1 text-xs text-emerald-300 flex items-center gap-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10"
                >
                  {isShare ? (
                    <Share2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span>
                    <b className="text-slate-200">{socItem.nickname}</b>{" "}
                    {isShare
                      ? "đã chia sẻ buổi Live"
                      : "đã theo dõi kênh của bạn"}
                  </span>
                </div>
              );
            }

            return null;
          })
        )}

        {/* Float Scroll-To-Bottom button */}
        {!autoScroll && newMessagesCount > 0 && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 mx-auto px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-semibold text-xs rounded-full shadow-lg flex items-center gap-1.5 animate-bounce border border-white/20 z-20 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Có {newMessagesCount} tin mới</span>
          </button>
        )}
      </div>
    </div>
  );
};
