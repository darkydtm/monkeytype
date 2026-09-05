import { createSignal } from "solid-js";
import { RaceClient } from "../../ape/races";
import {
	currentLiveStats,
	getActiveWordIndex,
	getResultVisible,
	isTestActive,
} from "../../states/test";
import { words } from "../../test/test-words";
import { opponentProgress } from "./race-math";

export const PUSH_THROTTLE_MS = 250;

export const [getRaceCode, setRaceCode] = createSignal("");

export type RaceStats = {
	wpm: number;
	acc: number;
	progress: number;
	done: boolean;
};

export function readEngineStats(): RaceStats {
	const total = words.length;
	return {
		wpm: Math.max(0, Math.min(300, Math.round(currentLiveStats.wpm ?? 0))),
		acc: Math.max(0, Math.min(100, currentLiveStats.acc ?? 100)),
		progress:
			total === 0
				? 0
				: opponentProgress((getActiveWordIndex() / total) * 100),
		done: !isTestActive() && getResultVisible(),
	};
}

let lastPushAt = 0;

export function resetPushThrottle(): void {
	lastPushAt = 0;
}

export async function pushProgressThrottled(
	code: string,
	getStats: () => RaceStats = readEngineStats,
): Promise<boolean> {
	const now = Date.now();
	if (now - lastPushAt < PUSH_THROTTLE_MS) return false;
	lastPushAt = now;
	const stats = getStats();
	await RaceClient.updateProgress({
		params: { code },
		body: {
			wpm: stats.wpm,
			acc: stats.acc,
			progress: stats.progress,
			done: stats.done,
		},
	});
	return true;
}
