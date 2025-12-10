"use client";

import { motion } from "framer-motion";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
	onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
	isDragging: boolean;
}

export function ResizeHandle({ onPointerDown, isDragging }: ResizeHandleProps) {
	const [isHovered, setIsHovered] = useState(false);

	return (
		<motion.div
			role="separator"
			aria-orientation="vertical"
			onPointerDown={onPointerDown}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			initial={{ opacity: 0, scaleX: 0 }}
			animate={{ opacity: 1, scaleX: 1 }}
			exit={{ opacity: 0, scaleX: 0 }}
			transition={{ type: "spring", stiffness: 300, damping: 30 }}
			className={cn(
				"flex items-stretch justify-center cursor-col-resize",
				isDragging ? "w-2 px-1" : isHovered ? "w-2 px-1" : "w-1 px-0.5",
			)}
		>
			<div
				className={cn(
					"h-full rounded-full transition-all duration-200",
					isDragging
						? "w-1 bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
						: isHovered
							? "w-1 bg-primary/60 shadow-[0_0_4px_hsl(var(--primary))]"
							: "w-px bg-border",
				)}
			/>
		</motion.div>
	);
}
