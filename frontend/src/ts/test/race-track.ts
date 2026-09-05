import * as CustomText from "./custom-text";
import { setConfig, toggleFunbox } from "../config/setters";
import { Config } from "../config/store";
import { getActiveFunboxes } from "./funbox/list";
import * as TestLogic from "./test-logic";
import { words } from "./test-words";
import {
	currentLiveStats,
	getActiveWordIndex,
	getResultVisible,
} from "../states/test";
import { RaceClient } from "../ape/races";
import { getGuestId } from "../components/pages/race-progress";
import {
	showNoticeNotification,
	showSuccessNotification,
} from "../states/notifications";
import type { Race } from "@monkeytype/schemas/races";
import { buildMirrorWords, standings } from "./race-mirror";

const TRACK_KEY = "raceTrackCode";
const POLL_MS = 500;
const PUSH_MS = 250;

export function setTrackCode(code: string): void {
	localStorage.setItem(TRACK_KEY, code);
}

export function clearTrackCode(): void {
	localStorage.removeItem(TRACK_KEY);
}

export function getTrackCode(): string {
	return localStorage.getItem(TRACK_KEY) ?? "";
}

type ActiveRace = {
	code: string;
	race: Race;
	pollTimer: number | undefined;
	pushTimer: number | undefined;
	countdownTimer: number | undefined;
	donePushed: boolean;
	savedFunboxes: string[];
	savedPunctuation: boolean;
	savedNumbers: boolean;
};

let active: ActiveRace | null = null;

export function isRaceActive(): boolean {
	return active !== null;
}

export async function maybeEnterRaceTrack(): Promise<void> {
	const code = getTrackCode();
	if (code === "" || active !== null) return;
	await enterRaceTrack(code);
}

function mirrorEl(): HTMLElement | null {
	return document.querySelector<HTMLElement>("#raceMirror");
}

function renderMirror(): void {
	const el = mirrorEl();
	if (el === null || active === null) return;
	const race = active.race;
	const wordList = words.get().map((w) => w.text);
	const rows = race.players
		.map((p) => {
			const doneWords = Math.round((p.progress / 100) * wordList.length);
			const bar = Math.max(0, Math.min(100, Math.round(p.progress)));
			return `<div class="flex gap-2 items-center${
				p.done ? " opacity-60" : ""
			}"><span>${escapeHtml(p.name)} ${Math.round(p.wpm)}wpm</span><div class="h-2 flex-1 rounded bg-sub"><div class="h-full rounded bg-main" style="width: ${bar}%"></div></div></div><div class="words full-width" style="font-size: 1.2em">${buildMirrorWords(
				wordList,
				doneWords,
			)}</div>`;
		})
		.join("");
	const desync =
		wordList.length > 0 && !race.text.startsWith(wordList[0] ?? "")
			? `<div class="text-error">words changed - leave the race or rejoin</div>`
			: "";
	const table =
		race.state === "finished" ? `<div>${standings(race)}</div>` : "";
	el.innerHTML = `${desync}${rows}${table}<button id="raceLeave" class="text-sub">leave race</button>`;
	el.querySelector("#raceLeave")?.addEventListener("click", () => {
		void exitRaceTrack();
	});
}

async function poll(): Promise<void> {
	if (active === null) return;
	try {
		const res = await RaceClient.get({ params: { code: active.code } });
		if (res.status !== 200) {
			showNoticeNotification("Race not found");
			void exitRaceTrack();
			return;
		}
		active.race = res.body.data;
		if (active.race.state === "finished") {
			stopLoops();
			renderMirror();
			showSuccessNotification("Race finished");
			return;
		}
		if (getResultVisible() && !active.donePushed) {
			active.donePushed = true;
			await pushStats(true);
		}
		renderMirror();
	} catch (e) {
		console.error("race poll failed", e);
		showNoticeNotification("Failed to load race");
	}
}

async function pushStats(done: boolean): Promise<void> {
	if (active === null) return;
	const total = words.length;
	await RaceClient.updateProgress({
		params: { code: active.code },
		body: {
			wpm: Math.max(0, Math.min(300, Math.round(currentLiveStats.wpm ?? 0))),
			acc: Math.max(0, Math.min(100, Math.round(currentLiveStats.acc ?? 100))),
			progress:
				total === 0
					? 0
					: Math.max(
							0,
							Math.min(100, Math.round((getActiveWordIndex() / total) * 100)),
						),
			done,
			guestId: getGuestId(),
		},
	});
}

function stopLoops(): void {
	if (active === null) return;
	if (active.pollTimer !== undefined) window.clearInterval(active.pollTimer);
	if (active.pushTimer !== undefined) window.clearInterval(active.pushTimer);
	if (active.countdownTimer !== undefined)
		window.clearTimeout(active.countdownTimer);
	active.pollTimer = undefined;
	active.pushTimer = undefined;
	active.countdownTimer = undefined;
}

function beginLoops(): void {
	if (active === null) return;
	stopLoops();
	active.pollTimer = window.setInterval(() => {
		void poll();
	}, POLL_MS);
	active.pushTimer = window.setInterval(() => {
		if (active === null || active.race.state !== "running") return;
		void pushStats(getResultVisible());
	}, PUSH_MS);
}

function startRacing(): void {
	if (active === null) return;
	void TestLogic.restart();
	beginLoops();
	renderMirror();
}

export async function enterRaceTrack(code: string): Promise<void> {
	if (active !== null) return;
	try {
		const res = await RaceClient.get({ params: { code } });
		if (res.status !== 200) {
			showNoticeNotification("Race not found");
			clearTrackCode();
			return;
		}
		const race = res.body.data;
		const savedFunboxes = getActiveFunboxes().map((fb) => fb.name);
		for (const name of savedFunboxes) {
			toggleFunbox(name);
		}
		active = {
			code,
			race,
			pollTimer: undefined,
			pushTimer: undefined,
			countdownTimer: undefined,
			donePushed: false,
			savedFunboxes,
			savedPunctuation: Config.punctuation,
			savedNumbers: Config.numbers,
		};
		const wordCount = race.text.split(" ").length;
		CustomText.setText(race.text.split(" "));
		CustomText.setLimitMode(race.rules.mode === "time" ? "time" : "word");
		CustomText.setLimitValue(
			race.rules.mode === "time" ? race.rules.value : wordCount,
		);
		setConfig("mode", "custom");
		setConfig("language", race.rules.language);
		setConfig("punctuation", false);
		setConfig("numbers", false);
		mirrorEl()?.classList.remove("hidden");
		if (
			race.startsAt !== null &&
			race.startsAt !== undefined &&
			Date.now() < race.startsAt
		) {
			renderMirror();
			const wait = race.startsAt - Date.now();
			showNoticeNotification("Race starts soon, get ready");
			active.countdownTimer = window.setTimeout(startRacing, wait);
			beginLoops();
		} else {
			startRacing();
		}
	} catch (e) {
		console.error("enterRaceTrack failed", e);
		showNoticeNotification("Failed to load race");
		active = null;
	}
}

export async function exitRaceTrack(): Promise<void> {
	if (active !== null) {
		for (const name of active.savedFunboxes) {
			toggleFunbox(name as Parameters<typeof toggleFunbox>[0]);
		}
		setConfig("punctuation", active.savedPunctuation);
		setConfig("numbers", active.savedNumbers);
	}
	stopLoops();
	active = null;
	clearTrackCode();
	mirrorEl()?.classList.add("hidden");
	const el = mirrorEl();
	if (el !== null) el.innerHTML = "";
}
