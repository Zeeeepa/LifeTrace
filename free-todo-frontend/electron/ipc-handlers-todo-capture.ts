/**
 * 待办提取相关的 IPC 处理器
 * 从 ipc-handlers.ts 中提取，以保持文件大小在限制内
 */

import { desktopCapturer, ipcMain, net } from "electron";
import { logger } from "./logger";
import type { WindowManager } from "./window-manager";

/**
 * 发送截图到后端进行待办提取
 */
async function sendToBackend(
	apiUrl: string,
	imageBase64: string,
	createTodos: boolean = true,
): Promise<{
	success: boolean;
	message: string;
	extractedTodos: Array<{
		title: string;
		description?: string;
		time_info?: Record<string, unknown>;
		source_text?: string;
		confidence: number;
	}>;
	createdCount: number;
}> {
	return new Promise((resolve, reject) => {
		const postData = JSON.stringify({
			image_base64: imageBase64,
			create_todos: createTodos, // 自动创建 draft 状态的待办
		});

		const request = net.request({
			method: "POST",
			url: apiUrl,
		});

		request.setHeader("Content-Type", "application/json");

		let responseData = "";

		request.on("response", (response) => {
			response.on("data", (chunk) => {
				responseData += chunk.toString();
			});

			response.on("end", () => {
				try {
					const result = JSON.parse(responseData);
					resolve({
						success: result.success ?? false,
						message: result.message ?? "未知响应",
						extractedTodos:
							result.extracted_todos?.map(
								(todo: {
									title: string;
									description?: string;
									time_info?: Record<string, unknown>;
									source_text?: string;
									confidence: number;
								}) => ({
									title: todo.title,
									description: todo.description,
									time_info: todo.time_info,
									source_text: todo.source_text,
									confidence: todo.confidence ?? 0.5,
								}),
							) ?? [],
						createdCount: result.created_count ?? 0,
					});
				} catch (error) {
					reject(new Error(`解析响应失败: ${error}`));
				}
			});

			response.on("error", (error) => {
				reject(error);
			});
		});

		request.on("error", (error) => {
			reject(error);
		});

		request.write(postData);
		request.end();
	});
}

/**
 * 设置待办提取相关的 IPC 处理器
 */
export function setupTodoCaptureIpcHandlers(
	windowManager: WindowManager,
): void {
	// 截图并提取待办
	ipcMain.handle(
		"capture-and-extract-todos",
		async (): Promise<{
			success: boolean;
			message: string;
			extractedTodos: Array<{
				title: string;
				description?: string;
				time_info?: Record<string, unknown>;
				source_text?: string;
				confidence: number;
			}>;
			createdCount: number;
		}> => {
			try {
				logger.info("Capturing screen for todo extraction...");

				// 隐藏主窗口以避免截图时包含它
				const mainWin = windowManager.getWindow();
				const wasVisible = mainWin?.isVisible() ?? false;
				if (wasVisible && mainWin) {
					mainWin.hide();
				}

				// 等待一小段时间让窗口完全隐藏
				await new Promise((resolve) => setTimeout(resolve, 100));

				// 获取所有屏幕源
				const sources = await desktopCapturer.getSources({
					types: ["screen"],
					thumbnailSize: {
						width: 1920,
						height: 1080,
					},
				});

				// 恢复窗口显示
				if (wasVisible && mainWin) {
					mainWin.show();
				}

				if (sources.length === 0) {
					logger.error("No screen sources found");
					return {
						success: false,
						message: "未找到屏幕源",
						extractedTodos: [],
						createdCount: 0,
					};
				}

				// 使用主屏幕的截图
				const primarySource = sources[0];
				const thumbnail = primarySource.thumbnail;

				// 转换为 base64（移除 data URL 前缀）
				const dataURL = thumbnail.toDataURL();
				const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, "");

				logger.info(
					`Screen captured successfully, size: ${thumbnail.getSize().width}x${thumbnail.getSize().height}`,
				);

				// 获取后端 URL（从 next-server 模块）
				const nextServerModule = await import("./next-server");
				const backendUrl = nextServerModule.getBackendUrl();
				if (!backendUrl) {
					throw new Error("后端 URL 未设置，请等待后端服务器启动");
				}
				const apiUrl = `${backendUrl}/api/floating-capture/extract-todos`;

				// 发送到后端（自动创建 draft 状态的待办）
				const response = await sendToBackend(apiUrl, base64Data, true);

				logger.info(
					`Todo extraction completed: ${response.extractedTodos.length} todos extracted`,
				);

				return response;
			} catch (error) {
				const errorMsg = `Failed to capture and extract todos: ${error instanceof Error ? error.message : String(error)}`;
				logger.error(errorMsg);
				return {
					success: false,
					message: errorMsg,
					extractedTodos: [],
					createdCount: 0,
				};
			}
		},
	);
}
