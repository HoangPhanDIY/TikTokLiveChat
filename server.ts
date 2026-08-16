import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// Clean TikTok username helper
function cleanTikTokUniqueId(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let clean = raw.trim();
  if (clean.includes("tiktok.com/")) {
    const match = clean.match(/@([a-zA-Z0-9_.-]+)/);
    if (match) {
      clean = match[1];
    } else {
      try {
        const parsed = new URL(clean.startsWith("http") ? clean : `https://${clean}`);
        const parts = parsed.pathname.split("/").filter(Boolean);
        const userPart = parts.find((p) => p.startsWith("@")) || parts[0];
        if (userPart) clean = userPart.replace(/^@/, "");
      } catch {}
    }
  }
  clean = clean.replace(/^@+/, "");
  clean = clean.split("?")[0].split("#")[0].split("/")[0].trim();
  return clean;
}

// Dynamic loader for tiktok-live-connector (TikTokLiveConnection)
let TikTokConnectorClass: any = null;
async function getTikTokConnector() {
  if (!TikTokConnectorClass) {
    try {
      const module: any = await import("tiktok-live-connector");
      TikTokConnectorClass =
        module.TikTokLiveConnection ||
        module.WebcastPushConnection ||
        module.default?.TikTokLiveConnection ||
        module.default?.WebcastPushConnection ||
        module.default;
      console.log("Loaded TikTokConnectorClass:", typeof TikTokConnectorClass);
    } catch (err) {
      console.error("Failed to import tiktok-live-connector:", err);
    }
  }
  return TikTokConnectorClass;
}

// Live Session State
interface LiveClientSession {
  uniqueId: string;
  savedUniqueId: string;
  tiktokLiveConnection: any;
  isConnected: boolean;
  isSimulated: boolean;
  ttsSettings?: any;
  roomInfo: {
    title: string;
    ownerName: string;
    ownerAvatar: string;
    viewerCount: number;
    likeCount: number;
    giftCount: number;
    startedAt: number;
  };
}

let activeSession: LiveClientSession = {
  uniqueId: "",
  savedUniqueId: "",
  tiktokLiveConnection: null,
  isConnected: false,
  isSimulated: false,
  ttsSettings: null,
  roomInfo: {
    title: "Chưa kết nối phòng Live",
    ownerName: "",
    ownerAvatar: "",
    viewerCount: 0,
    likeCount: 0,
    giftCount: 0,
    startedAt: Date.now(),
  },
};

// SSE Client subscribers
interface SSEClient {
  id: string;
  res: express.Response;
}
let sseClients: SSEClient[] = [];

function broadcastEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch (err) {
      // client disconnected
    }
  });
}

// Keepalive heartbeat for SSE every 15s
setInterval(() => {
  sseClients.forEach((client) => {
    try {
      client.res.write(": keepalive\n\n");
    } catch {
      // ignore
    }
  });
}, 15000);

// In-Memory Avatar Cache (1 hour TTL)
interface CachedImage {
  buffer: Buffer;
  contentType: string;
  timestamp: number;
}
const avatarCache = new Map<string, CachedImage>();

// In-Memory TTS Audio Cache
const ttsAudioCache = new Map<string, Buffer>();

function generateFallbackSvg(name: string): string {
  const cleanName = (name || "U").trim();
  const initial = cleanName.charAt(0).toUpperCase() || "U";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FE2C55" />
        <stop offset="50%" stop-color="#7928CA" />
        <stop offset="100%" stop-color="#25F4EE" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="50" fill="url(#g)" />
    <text x="50" y="63" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle">${initial}</text>
  </svg>`;
}

// Deep recursive scanner to find avatar URLs in TikTok Protobuf / JSON objects
function findAvatarDeep(obj: any, depth = 0): string {
  if (!obj || depth > 5) return "";
  
  if (typeof obj === "string") {
    if (obj.startsWith("http") && (obj.includes("tiktokcdn.com") || obj.includes("byteoversea.com") || obj.includes("ibytedtos.com") || obj.includes("tos-") || obj.includes("avt-"))) {
      return obj;
    }
    if (obj.startsWith("tos-") || obj.startsWith("musically-maliva-obj/")) {
      return `https://p16-sign-va.tiktokcdn.com/${obj}~c5_100x100.jpeg`;
    }
    return "";
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findAvatarDeep(item, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (typeof obj === "object") {
    // Check known high-priority avatar properties first
    const directKeys = [
      "profilePictureUrl", "profile_picture_url",
      "avatarThumb", "avatarMedium", "avatarLarge",
      "avatar_thumb", "avatar_medium", "avatar_large",
      "avatar_100x100", "avatar_300x300",
      "urlList", "url_list", "profilePictureUrls", "profile_picture_urls"
    ];

    for (const key of directKeys) {
      if (obj[key]) {
        const found = findAvatarDeep(obj[key], depth + 1);
        if (found) return found;
      }
    }

    if (typeof obj.uri === "string" && (obj.uri.startsWith("tos-") || obj.uri.startsWith("musically-"))) {
      return `https://p16-sign-va.tiktokcdn.com/${obj.uri}~c5_100x100.jpeg`;
    }

    // Check nested objects
    const subObjs = [obj.user, obj.userDetails, obj.author, obj.senderUser, obj.extra?.author, obj.user_details];
    for (const sub of subObjs) {
      if (sub) {
        const found = findAvatarDeep(sub, depth + 1);
        if (found) return found;
      }
    }
  }

  return "";
}

// Scrape TikTok Profile for real avatar URL when Webcast packet does not contain it
async function scrapeTikTokUserAvatarUrl(uniqueId: string): Promise<string> {
  if (!uniqueId || uniqueId === "user" || uniqueId === "demo_live") return "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const cleanUid = uniqueId.replace(/^@/, "").trim();
    const url = `https://www.tiktok.com/@${encodeURIComponent(cleanUid)}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
        Referer: "https://www.tiktok.com/",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return "";

    const html = await res.text();

    // 1. Try og:image meta tag
    const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
    if (ogMatch && ogMatch[1] && ogMatch[1].startsWith("http")) {
      return ogMatch[1].replace(/&amp;/g, "&");
    }

    // 2. Try JSON hydration data for avatarLarger / avatarMedium / avatarThumb
    const avatarMatch = html.match(/"avatarLarger":"([^"]+)"/) ||
                        html.match(/"avatarMedium":"([^"]+)"/) ||
                        html.match(/"avatarThumb":"([^"]+)"/);
    if (avatarMatch && avatarMatch[1]) {
      let raw = avatarMatch[1].replace(/\\u002F/g, "/").replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
      if (raw.startsWith("http")) return raw;
    }

    // 3. Try twitter:image
    const twMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    if (twMatch && twMatch[1] && twMatch[1].startsWith("http")) {
      return twMatch[1].replace(/&amp;/g, "&");
    }
  } catch (err) {
    // Scrape timed out or blocked
  }

  return "";
}

function getProxiedAvatarUrl(data: any, fallbackUniqueId = "", fallbackNickname = ""): string {
  const rawUrl = findAvatarDeep(data);
  const uid = data?.uniqueId || data?.user?.uniqueId || fallbackUniqueId || "user";
  const name = data?.nickname || data?.user?.nickname || fallbackNickname || uid;
  
  if (rawUrl && rawUrl.startsWith("http")) {
    return `/api/avatar?url=${encodeURIComponent(rawUrl)}&uniqueId=${encodeURIComponent(uid)}&name=${encodeURIComponent(name)}`;
  }
  if (uid && uid !== "user") {
    return `/api/avatar?uniqueId=${encodeURIComponent(uid)}&name=${encodeURIComponent(name)}`;
  }
  return `/api/avatar?name=${encodeURIComponent(name)}`;
}

// 100% Guaranteed Avatar Endpoint: Retrieves actual TikTok profile picture or falls back gracefully
app.get(["/api/avatar", "/api/proxy-image"], async (req, res) => {
  let targetUrl = (req.query.url as string) || "";
  const uniqueId = (req.query.uniqueId as string) || "";
  const name = (req.query.name as string) || uniqueId || "TikTok";

  const cacheKey = targetUrl ? targetUrl : (uniqueId ? `user_${uniqueId}` : `name_${name}`);

  // 1. Check in-memory RAM cache (1-hour TTL)
  if (avatarCache.has(cacheKey)) {
    const cached = avatarCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < 3600000) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      return res.send(cached.buffer);
    }
  }

  // 2. If no direct targetUrl but uniqueId is given, attempt to scrape TikTok profile for the real avatar URL
  if ((!targetUrl || !targetUrl.startsWith("http")) && uniqueId && uniqueId !== "user" && uniqueId !== "demo_live") {
    const scrapedUrl = await scrapeTikTokUserAvatarUrl(uniqueId);
    if (scrapedUrl) {
      targetUrl = scrapedUrl;
    }
  }

  // 3. Fetch image from TikTok CDN URL with browser headers
  if (targetUrl && targetUrl.startsWith("http")) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: "https://www.tiktok.com/",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > 100) {
          avatarCache.set(cacheKey, {
            buffer,
            contentType,
            timestamp: Date.now(),
          });

          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.send(buffer);
        }
      }
    } catch (err) {
      // CDN fetch failed
    }
  }

  // 4. Try unavatar.io service if uniqueId is available
  if (uniqueId && uniqueId !== "user" && uniqueId !== "demo_live") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const unavatarRes = await fetch(`https://unavatar.io/tiktok/${encodeURIComponent(uniqueId)}`, {
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);

      if (unavatarRes.ok) {
        const contentType = unavatarRes.headers.get("content-type") || "image/jpeg";
        const arrayBuffer = await unavatarRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > 300) {
          avatarCache.set(cacheKey, {
            buffer,
            contentType,
            timestamp: Date.now(),
          });

          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.send(buffer);
        }
      }
    } catch (e) {
      // Fall through to SVG
    }
  }

  // 5. High-quality vector SVG avatar fallback
  const svg = generateFallbackSvg(name);
  const svgBuffer = Buffer.from(svg, "utf-8");

  avatarCache.set(cacheKey, {
    buffer: svgBuffer,
    contentType: "image/svg+xml",
    timestamp: Date.now(),
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.send(svgBuffer);
});

// API Endpoints: Session & Status
app.get("/api/tiktok/status", (req, res) => {
  res.json({
    uniqueId: activeSession.uniqueId,
    savedUniqueId: activeSession.savedUniqueId,
    isConnected: activeSession.isConnected,
    isSimulated: activeSession.isSimulated,
    roomInfo: activeSession.roomInfo,
  });
});

app.get("/api/tiktok/session", (req, res) => {
  res.json({ savedUniqueId: activeSession.savedUniqueId, uniqueId: activeSession.uniqueId });
});

app.post("/api/tiktok/session", (req, res) => {
  const { savedUniqueId } = req.body;
  if (typeof savedUniqueId === "string") {
    activeSession.savedUniqueId = savedUniqueId.trim();
  }
  res.json({ success: true, savedUniqueId: activeSession.savedUniqueId });
});

// TTS Settings sync for OBS Browser Source
app.get("/api/tts/settings", (req, res) => {
  res.json(activeSession.ttsSettings || {});
});

app.post("/api/tts/settings", (req, res) => {
  activeSession.ttsSettings = req.body;
  broadcastEvent("tts_settings", req.body);
  res.json({ success: true });
});

app.post("/api/tiktok/disconnect", (req, res) => {
  if (activeSession.tiktokLiveConnection) {
    try {
      activeSession.tiktokLiveConnection.disconnect();
    } catch (e) {
      console.error("Error disconnecting TikTok live:", e);
    }
    activeSession.tiktokLiveConnection = null;
  }
  activeSession.isConnected = false;
  activeSession.isSimulated = false;
  activeSession.uniqueId = "";
  
  broadcastEvent("disconnected", { message: "Đã ngắt kết nối với TikTok Live" });
  res.json({ success: true, message: "Disconnected" });
});

app.post("/api/tiktok/connect", async (req, res) => {
  let { uniqueId, sessionId } = req.body;
  const cleanId = cleanTikTokUniqueId(uniqueId);
  if (!cleanId) {
    return res.status(400).json({ error: "TikTok ID không được để trống hoặc không hợp lệ" });
  }

  // Save session ID for future reloads
  activeSession.savedUniqueId = cleanId;

  // If already connected to the same ID, return success immediately
  if (activeSession.isConnected && activeSession.uniqueId === cleanId && activeSession.tiktokLiveConnection) {
    return res.json({
      success: true,
      message: `Đã kết nối sẵn tới @${cleanId}`,
      savedUniqueId: activeSession.savedUniqueId,
      roomInfo: activeSession.roomInfo,
      alreadyConnected: true,
    });
  }

  // If already connected to another live, disconnect previous
  if (activeSession.tiktokLiveConnection) {
    try {
      activeSession.tiktokLiveConnection.disconnect();
    } catch (e) {
      // ignore
    }
    activeSession.tiktokLiveConnection = null;
  }

  activeSession.uniqueId = cleanId;
  activeSession.isSimulated = false;
  activeSession.isConnected = false;

  broadcastEvent("status_change", {
    status: "connecting",
    message: `Đang kết nối tới TikTok Live của @${cleanId}...`,
  });

  try {
    const ConnectorClass = await getTikTokConnector();
    if (!ConnectorClass) {
      throw new Error("Không thể khởi tạo thư viện kết nối TikTok Live");
    }

    const connectorOptions: any = {
      processInitialData: false,
      fetchRoomInfoOnConnect: false,
      enableExtendedGiftInfo: false,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 1000,
      clientParams: {
        app_language: "vi-VN",
        device_platform: "web",
      },
    };

    if (sessionId && typeof sessionId === "string" && sessionId.trim().length > 0) {
      connectorOptions.session = {
        cookie: {
          sessionid: sessionId.trim(),
        },
      };
    }

    const tiktokLive = new ConnectorClass(cleanId, connectorOptions);

    tiktokLive.on("connected", (state: any) => {
      activeSession.isConnected = true;
      activeSession.roomInfo = {
        title: state?.roomInfo?.title || `TikTok Live @${cleanId}`,
        ownerName: state?.roomInfo?.owner?.nickname || cleanId,
        ownerAvatar: getProxiedAvatarUrl(state?.roomInfo?.owner, cleanId, state?.roomInfo?.owner?.nickname),
        viewerCount: state?.roomInfo?.user_count || 0,
        likeCount: state?.roomInfo?.like_count || 0,
        giftCount: 0,
        startedAt: Date.now(),
      };

      broadcastEvent("connected", {
        uniqueId: cleanId,
        savedUniqueId: activeSession.savedUniqueId,
        roomInfo: activeSession.roomInfo,
        state,
      });
    });

    tiktokLive.on("chat", (data: any) => {
      if (!data) return;
      const commentText = data.comment || data.content || "";
      const senderNick = data.nickname || data.user?.nickname || cleanId || "Người xem";
      const senderUid = data.uniqueId || data.user?.uniqueId || "user";
      const avatar = getProxiedAvatarUrl(data, senderUid, senderNick);

      const commentEvent = {
        id: data.msgId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: "chat",
        uniqueId: senderUid,
        nickname: senderNick,
        comment: commentText,
        userId: data.userId || data.user?.id || "",
        profilePictureUrl: avatar,
        userBadges: Array.isArray(data.userBadges) ? data.userBadges : [],
        timestamp: Date.now(),
        isModerator: !!data.isModerator,
        isSubscriber: !!data.isSubscriber,
        followRole: data.followRole || 0,
      };
      broadcastEvent("chat", commentEvent);
    });

    tiktokLive.on("gift", (data: any) => {
      if (!data) return;
      if (data.giftType === 1 && !data.repeatEnd && data.comboCount < (data.repeatCount || 1)) {
        return;
      }
      const giftName = data.giftName || data.extendedGiftInfo?.name || "Hộp Quà";
      const diamondCount = Number(data.diamondCount || data.extendedGiftInfo?.diamondCount || 1);
      const repeatCount = Number(data.repeatCount || data.comboCount || 1);
      const senderNick = data.nickname || data.user?.nickname || cleanId || "Người xem";
      const senderUid = data.uniqueId || data.user?.uniqueId || "user";
      const avatar = getProxiedAvatarUrl(data, senderUid, senderNick);

      const giftEvent = {
        id: `gift_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: "gift",
        uniqueId: senderUid,
        nickname: senderNick,
        giftId: data.giftId,
        giftName,
        diamondCount,
        repeatCount,
        profilePictureUrl: avatar,
        giftPictureUrl: data.giftPictureUrl || data.extendedGiftInfo?.image?.urlList?.[0] || "",
        timestamp: Date.now(),
      };
      broadcastEvent("gift", giftEvent);
    });

    tiktokLive.on("like", (data: any) => {
      if (!data) return;
      const senderNick = data.nickname || "Người xem";
      const senderUid = data.uniqueId || "user";
      broadcastEvent("like", {
        id: `like_${Date.now()}`,
        type: "like",
        uniqueId: senderUid,
        nickname: senderNick,
        likeCount: data.likeCount || 1,
        totalLikeCount: data.totalLikeCount || 0,
        profilePictureUrl: getProxiedAvatarUrl(data, senderUid, senderNick),
        timestamp: Date.now(),
      });
    });

    tiktokLive.on("social", (data: any) => {
      if (!data) return;
      const senderNick = data.nickname || "Người xem";
      const senderUid = data.uniqueId || "user";
      broadcastEvent("social", {
        id: `social_${Date.now()}`,
        type: "social",
        uniqueId: senderUid,
        nickname: senderNick,
        displayType: data.displayType || "follow",
        label: data.label || "Theo dõi",
        profilePictureUrl: getProxiedAvatarUrl(data, senderUid, senderNick),
        timestamp: Date.now(),
      });
    });

    tiktokLive.on("follow", (data: any) => {
      if (!data) return;
      const senderNick = data.nickname || "Người xem";
      const senderUid = data.uniqueId || "user";
      broadcastEvent("social", {
        id: `follow_${Date.now()}`,
        type: "social",
        uniqueId: senderUid,
        nickname: senderNick,
        displayType: "follow",
        label: "Theo dõi",
        profilePictureUrl: getProxiedAvatarUrl(data, senderUid, senderNick),
        timestamp: Date.now(),
      });
    });

    tiktokLive.on("roomUser", (data: any) => {
      if (data?.viewerCount) {
        activeSession.roomInfo.viewerCount = data.viewerCount;
        broadcastEvent("viewer_update", { viewerCount: data.viewerCount });
      }
    });

    tiktokLive.on("streamEnd", () => {
      activeSession.isConnected = false;
      broadcastEvent("stream_end", { message: "Buổi phát trực tiếp đã kết thúc" });
    });

    tiktokLive.on("disconnected", () => {
      activeSession.isConnected = false;
      broadcastEvent("disconnected", { message: "Đã ngắt kết nối từ TikTok" });
    });

    tiktokLive.on("error", (err: any) => {
      console.warn("TikTok Live Connector warning/error:", err);
      const errMsg = err?.message || err?.info || String(err || "");
      if (
        errMsg.includes("fetchRoomGifts") ||
        errMsg.includes("fetchRoomGiftGallery") ||
        errMsg.includes("euler") ||
        errMsg.includes("Business plan") ||
        errMsg.includes("getTopViewerAttributes")
      ) {
        return;
      }
      broadcastEvent("error", {
        message: errMsg || "Lỗi kết nối TikTok Live. Hãy chắc chắn tài khoản đang Live!",
      });
    });

    // Connect to room
    const state = await tiktokLive.connect();
    activeSession.tiktokLiveConnection = tiktokLive;
    activeSession.isConnected = true;

    return res.json({
      success: true,
      message: `Đã kết nối thành công tới @${cleanId}`,
      savedUniqueId: activeSession.savedUniqueId,
      roomId: state?.roomId || state?.roomInfo?.id,
    });
  } catch (err: any) {
    console.error("Failed to connect TikTok Live:", err);
    activeSession.isConnected = false;
    const msg = err?.message || String(err || "");
    let userMsg = "Không thể kết nối. Tài khoản có thể đang Offline hoặc ID chưa đúng.";
    if (msg.includes("LIVE has ended") || msg.includes("offline")) {
      userMsg = `Tài khoản @${cleanId} hiện đang KHÔNG phát trực tiếp (Offline).`;
    } else if (msg.includes("User not found") || msg.includes("not found")) {
      userMsg = `Không tìm thấy tài khoản TikTok @${cleanId}. Vui lòng kiểm tra lại TikTok ID.`;
    }
    return res.status(400).json({
      success: false,
      error: userMsg,
      rawError: msg,
    });
  }
});

// Simulate live events
app.post("/api/tiktok/simulate", (req, res) => {
  const { eventType, data } = req.body;
  if (!eventType) {
    return res.status(400).json({ error: "Missing eventType" });
  }

  activeSession.isSimulated = true;
  activeSession.isConnected = true;
  if (!activeSession.uniqueId) {
    activeSession.uniqueId = "demo_live";
    activeSession.roomInfo = {
      title: "Phòng Live Demo Trải Nghiệm",
      ownerName: "Streamer Demo",
      ownerAvatar: "/api/avatar?name=Streamer+Demo",
      viewerCount: 245,
      likeCount: 5320,
      giftCount: 15,
      startedAt: Date.now(),
    };
  }

  broadcastEvent(eventType, data);
  res.json({ success: true });
});

// SSE endpoint for clients to listen to live events
app.get("/api/tiktok/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial connected state + savedUniqueId + ttsSettings
  res.write(
    `event: init\ndata: ${JSON.stringify({
      clientId,
      uniqueId: activeSession.uniqueId,
      savedUniqueId: activeSession.savedUniqueId,
      isConnected: activeSession.isConnected,
      isSimulated: activeSession.isSimulated,
      ttsSettings: activeSession.ttsSettings,
      roomInfo: activeSession.roomInfo,
    })}\n\n`
  );

  req.on("close", () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Multi-provider Google Translate TTS Proxy with caching & automatic fallbacks
app.get("/api/tts/google", async (req, res) => {
  try {
    const text = (req.query.text as string) || "Xin chào bạn";
    const lang = (req.query.lang as string) || "vi";
    const speed = (req.query.speed as string) || "1";

    const cleanText = text.slice(0, 200).trim();
    const cacheKey = `${lang}_${speed}_${cleanText}`;

    // Return from RAM cache if exists
    if (ttsAudioCache.has(cacheKey)) {
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      return res.send(ttsAudioCache.get(cacheKey)!);
    }

    // List of reliable TTS endpoints to try in sequence
    const ttsEndpoints = [
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&total=1&idx=0&textlen=${cleanText.length}&client=gtx&prev=input&ttsspeed=${speed}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&total=1&idx=0&textlen=${cleanText.length}&client=tw-ob&prev=input&ttsspeed=${speed}`,
      `https://translate.google.com.vn/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&total=1&idx=0&textlen=${cleanText.length}&client=dict-chrome-ex&prev=input&ttsspeed=${speed}`,
      `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText)}&type=1&le=vi`,
    ];

    for (const url of ttsEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const fetchRes = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Referer: "https://translate.google.com/",
            Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
          },
        });
        clearTimeout(timeoutId);

        if (fetchRes.ok) {
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.length > 500) {
            ttsAudioCache.set(cacheKey, buffer);
            res.setHeader("Content-Type", "audio/mpeg");
            res.setHeader("Cache-Control", "public, max-age=86400");
            return res.send(buffer);
          }
        }
      } catch (err) {
        // Try next endpoint
      }
    }

    return res.status(502).json({ error: "TTS provider unavailable" });
  } catch (error) {
    res.status(500).json({ error: "TTS audio error" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`TikTok Live Reader Server running on http://localhost:${PORT}`);
  });
}

startServer();
