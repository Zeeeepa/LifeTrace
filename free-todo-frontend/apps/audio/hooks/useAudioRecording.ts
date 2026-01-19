"use client";

import { useCallback, useRef, useState } from "react";

export function useAudioRecording() {
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	const startRecording = useCallback(
		async (
			onTranscription: (text: string, isFinal: boolean) => void,
			onError?: (error: Error) => void,
			is24x7: boolean = false
		) => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const mediaRecorder = new MediaRecorder(stream, {
					mimeType: "audio/webm",
				});

				// 连接到后端 WebSocket
				// 使用与API相同的URL获取逻辑
				const apiBaseUrl =
					process.env.NEXT_PUBLIC_API_URL ||
					(typeof window !== "undefined" && (window as any).__BACKEND_URL__) ||
					"http://localhost:8100";
				const wsUrl = apiBaseUrl.replace("http://", "ws://").replace("https://", "wss://");
				const wsEndpoint = `${wsUrl}/api/audio/transcribe`;
				console.log("[useAudioRecording] Connecting to WebSocket:", wsEndpoint);
				const ws = new WebSocket(wsEndpoint);

				ws.onopen = () => {
					// 发送初始化消息
					ws.send(JSON.stringify({ is_24x7: is24x7 }));
					mediaRecorder.start(100); // 每100ms发送一次数据
					setIsRecording(true);
				};

				mediaRecorder.ondataavailable = async (event) => {
					if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
						audioChunksRef.current.push(event.data);
						// 将Blob转换为ArrayBuffer再发送
						const arrayBuffer = await event.data.arrayBuffer();
						ws.send(arrayBuffer);
					}
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

				mediaRecorderRef.current = mediaRecorder;
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
		if (mediaRecorderRef.current) {
			mediaRecorderRef.current.stop();
			mediaRecorderRef.current.stream.getTracks().forEach((track) => {
				track.stop();
			});
			mediaRecorderRef.current = null;
		}
		if (wsRef.current) {
			wsRef.current.send(JSON.stringify({ type: "stop" }));
			wsRef.current.close();
			wsRef.current = null;
		}
		setIsRecording(false);
		return audioChunksRef.current;
	}, []);

	return {
		isRecording,
		startRecording,
		stopRecording,
	};
}
