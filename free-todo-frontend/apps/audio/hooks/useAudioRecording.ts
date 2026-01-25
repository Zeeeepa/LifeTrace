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
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const maxReconnectAttempts = 5;
	const reconnectDelayMs = 3000; // 3秒后重连
	const shouldReconnectRef = useRef(false); // 标记是否应该重连
	const recordingCallbacksRef = useRef<{
		onTranscription?: (text: string, isFinal: boolean) => void;
		onRealtimeNlp?: (data: {
			optimizedText?: string;
			todos?: Array<{ title: string; description?: string; deadline?: string }>;
			schedules?: Array<{ title: string; time?: string; description?: string }>;
		}) => void;
		onError?: (error: Error) => void;
		is24x7?: boolean;
	} | null>(null);

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
				// 如果已经有连接，先关闭它（防止重复连接）
				if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
					console.warn("检测到已有 WebSocket 连接，先关闭它");
					try {
						wsRef.current.close();
					} catch (e) {
						console.error("关闭已有连接失败:", e);
					}
					wsRef.current = null;
				}

				// 如果已经有音频流，先停止它
				if (mediaStreamRef.current) {
					mediaStreamRef.current.getTracks().forEach((track) => {
						track.stop();
					});
					mediaStreamRef.current = null;
				}

				// 如果已经有音频上下文，先关闭它
				if (audioContextRef.current) {
					try {
						audioContextRef.current.close();
					} catch (e) {
						console.error("关闭音频上下文失败:", e);
					}
					audioContextRef.current = null;
				}

				console.log("请求麦克风权限...");
				// 保存回调函数，用于重连
				recordingCallbacksRef.current = {
					onTranscription,
					onRealtimeNlp,
					onError,
					is24x7,
				};
				shouldReconnectRef.current = is24x7; // 7x24小时模式启用自动重连

				// 如果是重连，重置重连计数
				if (reconnectAttemptsRef.current > 0) {
					reconnectAttemptsRef.current = 0;
					console.log("WebSocket重连成功");
				}

				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				console.log("✅ 麦克风权限已获取");
				mediaStreamRef.current = stream

				// 连接到后端 WebSocket
				// 使用与API相同的URL获取逻辑
				const apiBaseUrl =
					process.env.NEXT_PUBLIC_API_URL ||
					(typeof window !== "undefined" && window.__BACKEND_URL__) ||
					"http://localhost:8100";
				const wsUrl = apiBaseUrl.replace("http://", "ws://").replace("https://", "wss://");
				const wsEndpoint = `${wsUrl}/api/audio/transcribe`;
				const ws = new WebSocket(wsEndpoint);
				ws.binaryType = "arraybuffer";

				ws.onopen = () => {
					console.log("✅ WebSocket连接已建立，发送初始化消息...");
					// 发送初始化消息
					ws.send(JSON.stringify({ is_24x7: is24x7 }));
					console.log("初始化消息已发送，is_24x7:", is24x7);
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
							// 分段保存通知
							if (data.header?.name === "SegmentSaved") {
								// 通知前端分段已保存，需要重置时间戳和文本
								// 通过特殊标记传递给 onTranscription，并传递原因
								const reason = data.payload?.message || "分段保存";
								onTranscription(`__SEGMENT_SAVED__:${reason}`, true);
								console.log("收到分段保存通知:", reason);
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
					// 清理资源
					setIsRecording(false);
					if (onError) {
						onError(new Error(errorMessage));
					}
				};

				ws.onclose = (event) => {
					setIsRecording(false);

					// 正常关闭（用户主动停止或服务器正常关闭）不需要触发错误
					if (event.wasClean) {
						shouldReconnectRef.current = false;
						return;
					}

					// 异常关闭：如果是7x24小时模式，尝试自动重连
					if (is24x7 && shouldReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
						reconnectAttemptsRef.current++;
						console.log(`WebSocket连接断开，${reconnectDelayMs / 1000}秒后尝试重连 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

						reconnectTimeoutRef.current = setTimeout(() => {
							if (recordingCallbacksRef.current && shouldReconnectRef.current) {
								const callbacks = recordingCallbacksRef.current;
								if (callbacks.onTranscription && callbacks.is24x7 !== undefined) {
									console.log("尝试重新连接WebSocket...");
									startRecording(
										callbacks.onTranscription,
										callbacks.onRealtimeNlp,
										callbacks.onError,
										callbacks.is24x7
									).catch((error) => {
										console.error("重连失败:", error);
										if (callbacks.onError) {
											callbacks.onError(error as Error);
										}
									});
								}
							}
						}, reconnectDelayMs);
						return;
					}

					// 异常关闭，提供详细的错误信息
					let errorMessage = "WebSocket连接异常关闭";

					// 根据错误代码提供更具体的错误信息
					switch (event.code) {
						case 1006:
							errorMessage = "WebSocket连接异常断开，可能是网络问题或服务器未响应。请检查：\n1. 后端服务是否正常运行\n2. 网络连接是否正常\n3. 防火墙或代理设置是否正确";
							break;
						case 1000:
							// 正常关闭，不应该到这里
							return;
						case 1001:
							errorMessage = "服务器主动断开连接（端点离开）";
							break;
						case 1002:
							errorMessage = "协议错误导致连接关闭";
							break;
						case 1003:
							errorMessage = "不支持的数据类型导致连接关闭";
							break;
						case 1004:
							errorMessage = "保留的错误代码（未使用）";
							break;
						case 1005:
							errorMessage = "未收到状态码（异常关闭）";
							break;
						case 1007:
							errorMessage = "数据格式错误导致连接关闭";
							break;
						case 1008:
							errorMessage = "策略违规导致连接关闭";
							break;
						case 1009:
							errorMessage = "消息过大导致连接关闭";
							break;
						case 1010:
							errorMessage = "扩展协商失败导致连接关闭";
							break;
						case 1011:
							errorMessage = "服务器内部错误导致连接关闭";
							break;
						case 1012:
							errorMessage = "服务重启导致连接关闭";
							break;
						case 1013:
							errorMessage = "服务过载导致连接关闭";
							break;
						case 1014:
							errorMessage = "TLS握手失败导致连接关闭";
							break;
						case 1015:
							errorMessage = "TLS错误导致连接关闭（无法设置状态码）";
							break;
						default:
							errorMessage = `WebSocket连接异常关闭: ${event.reason || `错误代码 ${event.code}`}`;
					}

					console.error("WebSocket closed abnormally:", {
						code: event.code,
						reason: event.reason,
						wasClean: event.wasClean,
					});

					if (onError) {
						onError(new Error(errorMessage));
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

	const stopRecording = useCallback((segmentTimestamps?: number[]) => {
		// 停止自动重连
		shouldReconnectRef.current = false;
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
		reconnectAttemptsRef.current = 0;
		recordingCallbacksRef.current = null;

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
			// 发送停止消息，包含时间戳数组（如果提供）
			const stopMessage: { type: string; segment_timestamps?: number[] } = { type: "stop" };
			if (segmentTimestamps && segmentTimestamps.length > 0) {
				stopMessage.segment_timestamps = segmentTimestamps;
			}
			try {
				wsRef.current.send(JSON.stringify(stopMessage));
			} catch (e) {
				console.error("Failed to send stop message:", e);
			}
			try {
				wsRef.current.close();
			} catch (e) {
				console.error("Failed to close WebSocket:", e);
			}
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
