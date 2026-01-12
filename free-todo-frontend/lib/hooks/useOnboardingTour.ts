"use client";

import { driver, type Driver } from "driver.js";
import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { useUiStore } from "@/lib/store/ui-store";
import { useOpenSettings } from "./useOpenSettings";

/**
 * Hook for managing the onboarding tour
 * Provides methods to start, skip, and check tour status
 */
export function useOnboardingTour() {
	const { hasCompletedTour, completeTour, setCurrentStep } =
		useOnboardingStore();
	const { setDockDisplayMode } = useUiStore();
	const { openSettings } = useOpenSettings();
	const t = useTranslations("onboarding");
	const driverRef = useRef<Driver | null>(null);

	/**
	 * Start the onboarding tour
	 */
	const startTour = useCallback(() => {
		// If already completed, don't start
		if (hasCompletedTour) return;

		// Ensure dock is visible during tour
		setDockDisplayMode("fixed");

		const driverObj = driver({
			showProgress: true,
			progressText: "{{current}} / {{total}}",
			allowClose: true,
			overlayColor: "#000",
			overlayOpacity: 0.7,
			stagePadding: 10,
			stageRadius: 8,
			animate: true,
			smoothScroll: true,
			allowKeyboardControl: true,

			// Button text
			nextBtnText: t("nextBtn"),
			prevBtnText: t("prevBtn"),
			doneBtnText: t("doneBtn"),

			// Custom popover class for styling
			popoverClass: "onboarding-popover",

			// Lifecycle hooks
			onHighlightStarted: (_element, _step, { state }) => {
				setCurrentStep(state.activeIndex ?? null);
			},
			onDestroyed: () => {
				completeTour();
				setCurrentStep(null);
			},

			steps: [
				// Step 1: Welcome modal
				{
					popover: {
						title: t("welcomeTitle"),
						description: t("welcomeDescription"),
						side: "over" as const,
						align: "center" as const,
					},
				},
				// Step 2: Settings toggle button
				{
					element: '[data-tour="settings-toggle"]',
					popover: {
						title: t("settingsStepTitle"),
						description: t("settingsStepDescription"),
						side: "bottom" as const,
						align: "end" as const,
					},
					onHighlightStarted: () => {
						// Open settings panel when this step starts
						openSettings();
					},
				},
				// Step 3: LLM API Key input
				{
					element: "#llm-api-key",
					popover: {
						title: t("apiKeyStepTitle"),
						description: t("apiKeyStepDescription"),
						side: "bottom" as const,
						align: "start" as const,
					},
					onHighlightStarted: () => {
						// Ensure settings is open and scroll to the element
						const element = document.getElementById("llm-api-key");
						if (element) {
							element.scrollIntoView({ behavior: "smooth", block: "center" });
						}
					},
				},
				// Step 4: Bottom Dock
				{
					element: '[data-tour="bottom-dock"]',
					popover: {
						title: t("dockStepTitle"),
						description: t("dockStepDescription"),
						side: "top" as const,
						align: "center" as const,
					},
					onHighlightStarted: () => {
						// Ensure dock is visible
						setDockDisplayMode("fixed");
					},
				},
				// Step 5: Completion modal
				{
					popover: {
						title: t("completeTitle"),
						description: t("completeDescription"),
						side: "over" as const,
						align: "center" as const,
					},
				},
			],
		});

		driverRef.current = driverObj;
		driverObj.drive();
	}, [
		hasCompletedTour,
		completeTour,
		setCurrentStep,
		setDockDisplayMode,
		openSettings,
		t,
	]);

	/**
	 * Skip the tour without completing it
	 */
	const skipTour = useCallback(() => {
		if (driverRef.current) {
			driverRef.current.destroy();
		}
		completeTour();
	}, [completeTour]);

	/**
	 * Reset the tour to allow re-onboarding
	 */
	const resetTour = useCallback(() => {
		useOnboardingStore.getState().resetTour();
	}, []);

	return {
		startTour,
		skipTour,
		resetTour,
		hasCompletedTour,
	};
}
