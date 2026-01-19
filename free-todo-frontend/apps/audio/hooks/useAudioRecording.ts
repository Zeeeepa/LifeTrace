"use client";

import { useCallback, useRef, useState } from "react";

declare global {
	interface Window {
		__BACKEND_URL__?: string;
	}
}

export function useAudioRecording() {
	const [isRecording, setIsRecording] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const processorRef = useRef<ScriptProcessorNode | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);

	const startRecording = useCallback(
		async (
			onTranscription: (text: string, isFinal: boolean) => void,
			onRealtimeNlp?: (data: {
				optimizedText?: string;
				todos?: Array<{ title: string; description?: string; deadline?: string }>;
				schedules?: Array<{ title: string; time?: string; description?: string }>;
			}) => void,
			onError?: (error: Error) => void,
			is24x7: boolean = false
		) => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				mediaStreamRef.current = stream

				// 连接到后端 WebSocket
				// 使用与API相同的URL获取逻辑
				const apiBaseUrl =
					process.env.NEXT_PUBLIC_API_URL ||
					(typeof window !== "undefined" && window.__BACKEND_URL__) ||
					"http://localhost:8100";
				const wsUrl = apiBaseUrl.replace("http://", "ws://").replace("https://", "wss://");
				const wsEndpoint = `${wsUrl}/api/audio/transcribe`;
				console.log("[useAudioRecording] Connecting to WebSocket:", wsEndpoint);
				const ws = new WebSocket(wsEndpoint);
				ws.binaryType = "arraybuffer";

				ws.onopen = () => {
					// 发送初始化消息
					ws.send(JSON.stringify({ is_24x7: is24x7 }));
					// 使用 WebAudio 直接发送 PCM16(16k) 到后端，保证 ASR 可识别
					type AudioContextCtor = typeof AudioContext & {
						webkitAudioContext?: typeof AudioContext;
					};
					const AudioCtx =
						(window.AudioContext ||
							((window as unknown as { webkitAudioContext?: typeof AudioContext })
								.webkitAudioContext)) as AudioContextCtor;
					const audioContext = new AudioCtx({ sampleRate: 16000 });
					audioContextRef.current = audioContext;

					const source = audioContext.createMediaStreamSource(stream);
					// ScriptProcessor 兼容性更好；未来可换 AudioWorklet
					const processor = audioContext.createScriptProcessor(4096, 1, 1);
					processorRef.current = processor;

					processor.onaudioprocess = (e) => {
						if (ws.readyState !== WebSocket.OPEN) return;
						const input = e.inputBuffer.getChannelData(0); // Float32 [-1, 1]
						// 转 Int16 little-endian
						const buffer = new ArrayBuffer(input.length * 2);
						const view = new DataView(buffer);
						for (let i = 0; i < input.length; i++) {
							const s = Math.max(-1, Math.min(1, input[i]));
							view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
						}
						ws.send(buffer);
					};

					source.connect(processor);
					processor.connect(audioContext.destination);
					setIsRecording(true);
				};

				ws.onmessage = (event) => {
					try {
						// 处理文本消息（JSON）
						if (typeof event.data === "string") {
							const data = JSON.parse(event.data);
							if (data.header?.name === "TranscriptionResultChanged") {
								const text = data.payload?.result;
								const isFinal = data.payload?.is_final || false;
								if (text) {
									onTranscription(text, isFinal);
								}
								return;
							}
							// 录制中实时优化/提取推送
							if (data.header?.name === "OptimizedTextChanged") {
								const text = data.payload?.text;
								if (onRealtimeNlp && typeof text === "string") {
									onRealtimeNlp({ optimizedText: text });
								}
								return;
							}
							if (data.header?.name === "ExtractionChanged") {
								const todos = data.payload?.todos;
								const schedules = data.payload?.schedules;
								if (onRealtimeNlp) {
									onRealtimeNlp({
										todos: Array.isArray(todos) ? todos : [],
										schedules: Array.isArray(schedules) ? schedules : [],
									});
								}
								return;
							}
						}
						// 二进制消息由后端处理，前端不需要处理
					} catch (error) {
						console.error("Failed to parse transcription data:", error);
					}
				};

				ws.onerror = (error) => {
					const errorMessage =
						error instanceof Error
							? error.message
							: "WebSocket连接错误，请检查后端服务是否运行";
					console.error("WebSocket error:", errorMessage, error);
					if (onError) {
						onError(new Error(errorMessage));
					}
				};

				ws.onclose = (event) => {
					console.log("[useAudioRecording] WebSocket closed", {
						code: event.code,
						reason: event.reason,
						wasClean: event.wasClean,
					});
					setIsRecording(false);
					// 如果不是正常关闭，触发错误回调
					if (!event.wasClean && onError) {
						onError(
							new Error(
								`WebSocket连接异常关闭: ${event.reason || `代码 ${event.code}`}`
							)
						);
					}
				};

				wsRef.current = ws;
			} catch (error) {
				console.error("Failed to start recording:", error);
				if (onError) {
					onError(error as Error);
				}
			}
		},
		[]
	);

	const stopRecording = useCallback(() => {
		// 停止 WebAudio
		if (processorRef.current) {
			try {
				processorRef.current.disconnect();
			} catch {}
			processorRef.current.onaudioprocess = null;
			processorRef.current = null;
		}
		if (audioContextRef.current) {
			try {
				audioContextRef.current.close();
			} catch {}
			audioContextRef.current = null;
		}
		if (mediaStreamRef.current) {
			for (const track of mediaStreamRef.current.getTracks()) {
				track.stop();
			}
			mediaStreamRef.current = null;
		}
		if (wsRef.current) {
			wsRef.current.send(JSON.stringify({ type: "stop" }));
			wsRef.current.close();
			wsRef.current = null;
		}
		setIsRecording(false);
	}, []);

	return {
		isRecording,
		startRecording,
		stopRecording,
	};
}
