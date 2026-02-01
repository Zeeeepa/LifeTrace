"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { isElectronEnvironment } from "@/lib/utils/electron";

interface BackendReadyGateProps {
	children: ReactNode;
}

function getBackendHealthUrl(): string {
	const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
	return `${baseUrl}/health`;
}

export function BackendReadyGate({ children }: BackendReadyGateProps) {
	const [ready, setReady] = useState(false);
	const [visible, setVisible] = useState(true);
	const [phase, setPhase] = useState<"boot" | "backend">("boot");

	useEffect(() => {
		if (!isElectronEnvironment()) {
			setReady(true);
			setVisible(false);
			return;
		}

		let cancelled = false;
		const healthUrl = getBackendHealthUrl();
		setPhase("backend");

		const checkHealth = async () => {
			try {
				const response = await fetch(healthUrl, { cache: "no-store" });
				if (response.ok && !cancelled) {
					setReady(true);
					setVisible(false);
				}
			} catch {
				// Ignore until backend is ready
			}
		};

		const interval = setInterval(checkHealth, 500);
		checkHealth();

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, []);

	return (
		<>
			{children}
			{!ready && visible && (
				<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-950/90 text-white backdrop-blur">
					<div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/80 px-6 py-5 shadow-lg">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
						<div className="text-sm font-medium tracking-wide">
							{phase === "boot" ? "正在启动前端界面" : "正在连接后端服务"}
						</div>
						<div className="text-xs text-white/60">首次启动可能需要几秒钟…</div>
					</div>
				</div>
			)}
		</>
	);
}
