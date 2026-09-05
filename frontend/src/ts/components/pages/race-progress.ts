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

const GUEST_ID_KEY = "raceGuestId";
const GUEST_NAME_KEY = "raceGuestName";

function randomSuffix(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let s = "";
	for (let i = 0; i < 8; i++) {
		s += chars[Math.floor(Math.random() * chars.length)];
	}
	return s;
}

export function getGuestId(): string {
	let id = localStorage.getItem(GUEST_ID_KEY);
	if (id === null || !/^guest-[A-Za-z0-9]{8}$/.test(id)) {
		id = `guest-${randomSuffix()}`;
		localStorage.setItem(GUEST_ID_KEY, id);
	}
	return id;
}

export function getGuestName(): string {
	return localStorage.getItem(GUEST_NAME_KEY) ?? getGuestId().slice(6);
}

export function setGuestName(name: string): void {
	localStorage.setItem(GUEST_NAME_KEY, name.slice(0, 16));
}

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
			guestId: getGuestId(),
		},
	});
	return true;
}
