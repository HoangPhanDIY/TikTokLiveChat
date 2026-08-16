import { QueueItem, TtsSettings } from "../types";

class AudioManager {
  private queue: QueueItem[] = [];
  private isSpeaking = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioCtx: AudioContext | null = null;
  private onQueueChangeCallback?: (queue: QueueItem[], currentItem: QueueItem | null) => void;
  private currentItem: QueueItem | null = null;
  private isPaused = false;

  constructor() {
    // Web Speech API voice loading handler
    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = () => {};
      }
      // Auto unlock audio context on any first user interaction
      const unlock = () => {
        this.autoUnlock();
        window.removeEventListener("click", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
      };
      window.addEventListener("click", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
      window.addEventListener("touchstart", unlock, { once: true });
    }
  }

  public setQueueCallback(cb: (queue: QueueItem[], currentItem: QueueItem | null) => void) {
    this.onQueueChangeCallback = cb;
  }

  private notifyQueueChange() {
    if (this.onQueueChangeCallback) {
      this.onQueueChangeCallback([...this.queue], this.currentItem);
    }
  }

  public getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Automatically unlocks audio playback without requiring clicks (for OBS & TikTok Live Studio Browser Source)
  public autoUnlock() {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      // ignore
    }
  }

  // Synthesized Sound Effects
  public playSound(type: "comment" | "gift" | "follow" | "connect" | "alert") {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      if (type === "comment") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === "gift") {
        const freqs = [523.25, 659.25, 783.99, 1046.5];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.2, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.36);
        });
      } else if (type === "follow") {
        const freqs = [587.33, 880];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.15, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.26);
        });
      } else if (type === "connect") {
        const chord = [440, 554.37, 659.25];
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.42);
        });
      } else if (type === "alert") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
      }
    } catch (e) {
      console.warn("Could not play sound fx:", e);
    }
  }

  // Clean & preprocess text for natural Vietnamese TTS
  public cleanTextForSpeech(text: string, settings?: Partial<TtsSettings>): string {
    if (!text || typeof text !== "string") return "";

    let cleaned = text.trim();
    if (!cleaned) return "";

    // 1. Remove URLs
    cleaned = cleaned.replace(/https?:\/\/\S+/gi, "đường dẫn liên kết");

    // 2. Strip / simplify repeated letters (e.g., 'heeeelloooo' -> 'hello')
    if (settings?.simplifyRepeatedChars) {
      cleaned = cleaned.replace(/(.)\1{3,}/gi, "$1$1");
    }

    // 3. Strip excessive emojis / special symbols if enabled
    if (settings?.stripEmojis) {
      cleaned = cleaned.replace(
        /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
        ""
      );
    }

    // 4. Blacklist filter
    const blacklist = Array.isArray(settings?.blacklistWords) ? settings.blacklistWords : [];
    for (const badWord of blacklist) {
      if (!badWord || typeof badWord !== "string" || !badWord.trim()) continue;
      const regex = new RegExp(`\\b${badWord.trim()}\\b|${badWord.trim()}`, "gi");
      cleaned = cleaned.replace(regex, "bíp");
    }

    // 5. Replace common Vietnamese abbreviations with full pronunciation
    const abbreviations: Record<string, string> = {
      k: "không",
      ko: "không",
      kh: "không",
      khong: "không",
      dc: "được",
      đc: "được",
      duoc: "được",
      ng: "người",
      mn: "mọi người",
      ntn: "như thế nào",
      j: "gì",
      sao: "sao",
      thui: "thôi",
      ib: "nhắn tin",
      inbox: "nhắn tin",
      vs: "với",
      bh: "bây giờ",
      tl: "trả lời",
      rep: "trả lời",
      tks: "cảm ơn",
      tkss: "cảm ơn",
      cmon: "cảm ơn",
      "cam on": "cảm ơn",
      camon: "cảm ơn",
      shop: "shop",
      e: "em",
      a: "anh",
      c: "chị",
      b: "bạn",
    };

    const words = cleaned.split(/\s+/);
    const convertedWords = words.map((w) => {
      if (!w) return "";
      const lower = w.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, "");
      if (abbreviations[lower]) {
        return abbreviations[lower];
      }
      return w;
    });

    cleaned = convertedWords.filter(Boolean).join(" ").trim();

    // 6. Max char limit
    const maxChars = settings?.maxCharLength || 120;
    if (cleaned.length > maxChars) {
      cleaned = cleaned.substring(0, maxChars) + "...";
    }

    return cleaned;
  }

  // Format the phrase for speech
  public formatSpeechText(
    sender?: string,
    commentText?: string,
    type: "chat" | "gift" | "social" = "chat",
    settings?: TtsSettings,
    extraData?: { giftName?: string; count?: number; displayType?: string }
  ): string | null {
    if (!settings || !settings.enabled) return null;

    const safeSender = typeof sender === "string" ? sender : "Người xem";
    const safeComment = typeof commentText === "string" ? commentText : "";

    if (type === "chat") {
      const minLength = settings.minCharLength ?? 1;
      if (safeComment.length < minLength) return null;

      const blockPrefixes = Array.isArray(settings.blockPrefixes) ? settings.blockPrefixes : [];
      if (blockPrefixes.some((prefix) => prefix && safeComment.startsWith(prefix))) {
        return null;
      }

      if (
        settings.onlyReadQuestions &&
        !safeComment.includes("?") &&
        !safeComment.includes("không") &&
        !safeComment.includes("sao") &&
        !safeComment.includes("hả")
      ) {
        return null;
      }

      const cleanSender = this.cleanTextForSpeech(safeSender, settings).slice(0, 20);
      const cleanComment = this.cleanTextForSpeech(safeComment, settings);

      if (!cleanComment) return null;

      if (settings.readSenderName && cleanSender) {
        return `${cleanSender} ${settings.nameCommentSeparator || "nói:"} ${cleanComment}`;
      } else {
        return cleanComment;
      }
    } else if (type === "gift") {
      if (!settings.readGifts) return null;
      const cleanSender = this.cleanTextForSpeech(safeSender, settings).slice(0, 20);
      const giftName = extraData?.giftName || "quà";
      const count = extraData?.count || 1;

      let template = settings.giftTemplate || "Cảm ơn {name} đã tặng {count} {gift}";
      template = template
        .replace(/{name}/g, cleanSender)
        .replace(/{count}/g, count > 1 ? `${count}` : "")
        .replace(/{gift}/g, giftName);

      return template;
    } else if (type === "social") {
      if (!settings.readFollows) return null;
      const cleanSender = this.cleanTextForSpeech(safeSender, settings).slice(0, 20);
      if (extraData?.displayType === "share") {
        return `Cảm ơn ${cleanSender} đã chia sẻ buổi Live`;
      }
      return `Cảm ơn ${cleanSender} đã theo dõi kênh`;
    }

    return null;
  }

  // Add message to speech queue
  public enqueue(
    item: {
      sender: string;
      originalText: string;
      type: "chat" | "gift" | "social";
      extraData?: { giftName?: string; count?: number; displayType?: string };
    },
    settings: TtsSettings
  ) {
    if (!settings.enabled) return;

    const textToSpeak = this.formatSpeechText(
      item.sender,
      item.originalText,
      item.type,
      settings,
      item.extraData
    );

    if (!textToSpeak) return;

    if (this.queue.length >= 30) {
      this.queue.shift();
    }

    const queueItem: QueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      textToSpeak,
      sender: item.sender,
      originalText: item.originalText,
      type: item.type,
      addedAt: Date.now(),
    };

    this.queue.push(queueItem);
    this.notifyQueueChange();

    if (!this.isSpeaking && !this.isPaused) {
      this.processNext(settings);
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return [];
    }
    return window.speechSynthesis.getVoices();
  }

  public getVietnameseVoices(): SpeechSynthesisVoice[] {
    const all = this.getAvailableVoices();
    return all.filter(
      (v) =>
        v.lang.toLowerCase().includes("vi") ||
        v.name.toLowerCase().includes("vietnam") ||
        v.name.toLowerCase().includes("tiếng việt")
    );
  }

  public clearQueue() {
    this.queue = [];
    this.stopCurrentSpeech();
    this.currentItem = null;
    this.notifyQueueChange();
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  // Speak a single item directly with completion callback (used by OBS Overlay runner)
  public speakDirectly(
    text: string,
    settings: TtsSettings,
    onFinish?: () => void
  ) {
    this.stopCurrentSpeech();
    this.isSpeaking = true;

    let hasFinished = false;
    const safeFinish = () => {
      if (hasFinished) return;
      hasFinished = true;
      this.isSpeaking = false;
      if (onFinish) {
        onFinish();
      }
    };

    if (settings.engine === "google_authentic") {
      this.speakGoogleAuthentic(text, settings, safeFinish);
    } else {
      this.speakWebSpeech(text, settings, safeFinish);
    }
  }

  public stopCurrentSpeech() {
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
      } catch {}
      this.currentSourceNode = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = "";
      this.currentAudio = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentItem = null;
    this.notifyQueueChange();
  }

  public skipCurrent(settings: TtsSettings) {
    this.stopCurrentSpeech();
    this.processNext(settings);
  }

  public togglePause(settings: TtsSettings) {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.stopCurrentSpeech();
    } else {
      this.processNext(settings);
    }
    return this.isPaused;
  }

  public getQueue(): QueueItem[] {
    return [...this.queue];
  }

  public getCurrentItem(): QueueItem | null {
    return this.currentItem;
  }

  private processNext(settings: TtsSettings) {
    if (this.isPaused || this.isSpeaking || this.queue.length === 0) {
      return;
    }

    const nextItem = this.queue.shift();
    if (!nextItem) return;

    this.currentItem = nextItem;
    this.isSpeaking = true;
    this.notifyQueueChange();

    const onFinish = () => {
      this.isSpeaking = false;
      this.currentItem = null;
      this.notifyQueueChange();

      const delayMs = (settings.delayBetweenMessages || 0.3) * 1000;
      setTimeout(() => {
        if (!this.isPaused) {
          this.processNext(settings);
        }
      }, delayMs);
    };

    if (settings.engine === "google_authentic") {
      this.speakGoogleAuthentic(nextItem.textToSpeak, settings, onFinish);
    } else {
      this.speakWebSpeech(nextItem.textToSpeak, settings, onFinish);
    }
  }

  // 1. Authentic "Chị Google" voice with Web Audio API + HTML5 Audio fallback
  private async speakGoogleAuthentic(text: string, settings: TtsSettings, onFinish: () => void) {
    let finished = false;
    const triggerFinish = () => {
      if (finished) return;
      finished = true;
      onFinish();
    };

    try {
      const speedParam = settings.rate > 1.2 ? "0.5" : "1";
      const audioUrl = `/api/tts/google?text=${encodeURIComponent(text)}&lang=vi&speed=${speedParam}`;

      // METHOD A: Web Audio API (Best for OBS Studio & TikTok Live Studio Browser Source)
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const res = await fetch(audioUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = Math.max(0.5, Math.min(2.0, settings.rate));

          const gainNode = ctx.createGain();
          gainNode.gain.value = Math.max(0, Math.min(1.0, settings.volume));

          source.connect(gainNode);
          gainNode.connect(ctx.destination);

          this.currentSourceNode = source;

          source.onended = () => {
            this.currentSourceNode = null;
            triggerFinish();
          };

          source.start(0);
          return;
        }
      } catch (webAudioErr) {
        // Fall back to Method B
      }

      // METHOD B: Standard HTML5 Audio Element
      const audio = new Audio(audioUrl);
      audio.volume = Math.max(0, Math.min(1, settings.volume));
      audio.playbackRate = Math.max(0.5, Math.min(2.0, settings.rate));

      this.currentAudio = audio;

      audio.onended = () => {
        this.currentAudio = null;
        triggerFinish();
      };

      audio.onerror = () => {
        this.currentAudio = null;
        this.speakWebSpeech(text, settings, triggerFinish);
      };

      await audio.play();
    } catch (e) {
      // METHOD C: Fallback to Web Speech API
      this.speakWebSpeech(text, settings, triggerFinish);
    }
  }

  // 2. Web Speech API (HTML5 SpeechSynthesis)
  private speakWebSpeech(text: string, settings: TtsSettings, onFinish: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      // Fallback estimated duration so comment is not immediately hidden
      const estimatedMs = Math.max(2000, Math.min(8000, text.length * 90));
      setTimeout(onFinish, estimatedMs);
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;
      utterance.lang = "vi-VN";

      const voices = window.speechSynthesis.getVoices();
      let selectedVoice = voices.find((v) => v.name === settings.voiceName);

      if (!selectedVoice) {
        selectedVoice =
          voices.find(
            (v) =>
              (v.name.includes("Google") && v.lang.includes("vi")) ||
              v.name.toLowerCase().includes("tiếng việt") ||
              v.name.toLowerCase().includes("vietnamese")
          ) || voices.find((v) => v.lang.startsWith("vi"));
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        this.currentUtterance = null;
        onFinish();
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        const estimatedMs = Math.max(2000, Math.min(8000, text.length * 90));
        setTimeout(onFinish, estimatedMs);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      const estimatedMs = Math.max(2000, Math.min(8000, text.length * 90));
      setTimeout(onFinish, estimatedMs);
    }
  }

  // Test Voice Functionality
  public testSpeech(sampleText: string, settings: TtsSettings) {
    this.enqueue(
      {
        sender: "Chị Google",
        originalText: sampleText || "Xin chào! Chị Google đã sẵn sàng đọc bình luận Live TikTok của bạn.",
        type: "chat",
      },
      { ...settings, enabled: true, readSenderName: false }
    );
  }
}

export const audioManager = new AudioManager();
