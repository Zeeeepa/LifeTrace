import type { JournalRefreshMode } from "@/lib/store/journal-store";

const pad = (value: number) => value.toString().padStart(2, "0");

export const formatDateTimeLocal = (value: Date) => {
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

export const parseDateTimeLocal = (value: string) => {
	return new Date(value);
};

const parseTimeString = (value: string) => {
	const [hours = "0", minutes = "0"] = value.split(":");
	return {
		hours: Number(hours),
		minutes: Number(minutes),
	};
};

export const resolveBucketRange = (
	reference: Date,
	mode: JournalRefreshMode,
	fixedTime: string,
	workHoursEnd: string,
	customTime: string,
) => {
	const timeSource =
		mode === "workHours"
			? workHoursEnd
			: mode === "custom"
				? customTime
				: fixedTime;
	const { hours, minutes } = parseTimeString(timeSource);

	const bucketStart = new Date(reference);
	bucketStart.setHours(hours, minutes, 0, 0);
	if (reference < bucketStart) {
		bucketStart.setDate(bucketStart.getDate() - 1);
	}

	const bucketEnd = new Date(bucketStart);
	bucketEnd.setDate(bucketEnd.getDate() + 1);

	return { bucketStart, bucketEnd, bucketTime: timeSource };
};
