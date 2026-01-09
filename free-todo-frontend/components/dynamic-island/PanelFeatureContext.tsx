"use client";

import type React from "react";
import { createContext, useState } from "react";
import type { PanelFeature } from "@/lib/config/panel-config";

// Context用于在PanelContent和PanelTitleBar之间共享当前功能
export const PanelFeatureContext = createContext<{
	currentFeature: PanelFeature;
	setCurrentFeature: (feature: PanelFeature) => void;
} | null>(null);

// Panel功能Provider组件
export function PanelFeatureProvider({ children }: { children: React.ReactNode }) {
	const [currentFeature, setCurrentFeature] = useState<PanelFeature>("chat");
	return (
		<PanelFeatureContext.Provider value={{ currentFeature, setCurrentFeature }}>
			{children}
		</PanelFeatureContext.Provider>
	);
}
