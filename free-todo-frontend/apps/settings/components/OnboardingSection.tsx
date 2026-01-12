"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { SettingsSection } from "./SettingsSection";

interface OnboardingSectionProps {
	loading?: boolean;
}

/**
 * 用户引导设置区块组件
 * 提供重新开始引导的功能
 */
export function OnboardingSection({ loading = false }: OnboardingSectionProps) {
	const t = useTranslations("onboarding");
	const { resetTour, hasCompletedTour } = useOnboardingStore();

	const handleRestartTour = () => {
		resetTour();
		// Reload the page to trigger the tour
		window.location.reload();
	};

	return (
		<SettingsSection title={t("restartTour")}>
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">
					{t("restartTourDescription")}
				</p>
				<button
					type="button"
					onClick={handleRestartTour}
					disabled={loading || !hasCompletedTour}
					className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<RotateCcw className="h-4 w-4" />
					{t("restartTour")}
				</button>
				{!hasCompletedTour && (
					<p className="text-xs text-muted-foreground italic">
						引导尚未完成，无需重置
					</p>
				)}
			</div>
		</SettingsSection>
	);
}
