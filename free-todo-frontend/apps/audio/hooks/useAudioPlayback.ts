"use client";

import { useCallback, useRef, useState } from "react";

export function useAudioPlayback() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);

	const ensureAudio = useCallback((url: string) => {
		if (!audioRef.current) {
			const audio = new Audio(url);
			audio.addEventListener("loadedmetadata", () => {
				setDuration(audio.duration);
			});
			audio.addEventListener("timeupdate", () => {
				setCurrentTime(audio.currentTime);
			});
			audio.addEventListener("ended", () => {
				setIsPlaying(false);
				setCurrentTime(0);
			});
			audio.addEventListener("play", () => setIsPlaying(true));
			audio.addEventListener("pause", () => setIsPlaying(false));
			audioRef.current = audio;
		} else if (audioRef.current.src !== url) {
			audioRef.current.src = url;
			audioRef.current.load();
		}
	}, []);

	const playPause = useCallback((url?: string) => {
		if (url) {
			ensureAudio(url);
		}
		const audio = audioRef.current;
		if (!audio) return;

		if (audio.paused) {
			audio.play().catch((e) => console.error("Failed to play audio:", e));
		} else {
			audio.pause();
		}
	}, [ensureAudio]);

	const seek = useCallback((targetTime: number) => {
		const audio = audioRef.current;
		if (!audio) return;
		try {
			audio.currentTime = Math.max(0, targetTime);
			setCurrentTime(audio.currentTime);
		} catch (e) {
			console.error("Failed to seek audio:", e);
		}
	}, []);

	const seekByRatio = useCallback((ratio: number) => {
		const audio = audioRef.current;
		if (!audio) return;
		const target = Math.max(0, Math.min(1, ratio)) * (audio.duration || 0);
		seek(target);
	}, [seek]);

	return {
		audioRef,
		isPlaying,
		currentTime,
		duration,
		ensureAudio,
		playPause,
		seek,
		seekByRatio,
	};
}
