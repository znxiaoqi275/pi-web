"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";

// Switching clips stops the previous sentence, including clips in other messages.
let activeAudio: HTMLAudioElement | null = null;

export function InlineAudio({ src, children, onOpenFile }: {
  src: string;
  children?: ReactNode;
  onOpenFile?: () => void;
}) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const [failed, setFailed] = useState(false);
  const label = children || t("chat.audioListen");

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      if (activeAudio === audio) activeAudio = null;
    };
  }, []);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeAudio === audio && status !== "idle") {
      audio.pause();
      setStatus("idle");
      return;
    }
    activeAudio?.pause();
    activeAudio = audio;
    if (failed) audio.load();
    setFailed(false);
    setStatus("loading");
    try {
      await audio.play();
    } catch (error) {
      // Pausing or changing clips while play() is pending cancels that request.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("idle");
      setFailed(true);
    }
  }

  return (
    <span className="inline-audio">
      <button
        type="button"
        className="inline-audio-button"
        aria-pressed={status !== "idle"}
        aria-busy={status === "loading"}
        title={t(status === "loading" ? "chat.audioLoading" : status === "idle" ? "chat.audioPlay" : "chat.audioPause")}
        onClick={toggle}
      >
        <svg className={status === "loading" ? "inline-audio-spinner" : undefined} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {status === "playing" ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
            : status === "loading" ? <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" />
            : <path d="M7 4v16l14-8z" />}
        </svg>
        <span>{label}</span>
        {status === "loading" && <span className="sr-only" role="status">{t("chat.audioLoading")}</span>}
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => {
          if (activeAudio !== audioRef.current) activeAudio?.pause();
          activeAudio = audioRef.current;
        }}
        onPlaying={() => setStatus("playing")}
        onWaiting={() => { if (!audioRef.current?.paused) setStatus("loading"); }}
        onPause={() => setStatus("idle")}
        onEnded={() => setStatus("idle")}
        onError={() => { setStatus("idle"); setFailed(true); }}
      />
      {failed && (
        <span className="inline-audio-error" role="status">
          {t("chat.audioError")}
          {onOpenFile && <button type="button" onClick={onOpenFile}>{t("chat.audioOpenFile")}</button>}
        </span>
      )}
    </span>
  );
}
