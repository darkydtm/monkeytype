import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { Race, RaceRules } from "@monkeytype/schemas/races";
import { Button } from "../common/Button";
import { Page } from "../common/Page";
import { cn } from "../../utils/cn";
import { RaceClient } from "../../ape/races";
import { countdownMs, opponentProgress } from "./race-math";
import { navigationEvent } from "../../events/navigation";
import { showNoticeNotification } from "../../states/notifications";
import { Config } from "../../config/store";
import { words } from "../../test/test-words";
import {
	getGuestId,
	getGuestName,
	getRaceCode,
	setGuestName,
	setRaceCode,
} from "./race-progress";
import { setTrackCode } from "../../test/race-track";

const POLL_MS = 500;

const FALLBACK_TEXT = "the quick brown fox jumps over the lazy dog ".repeat(5).trim();

function captureRaceSource(): { text: string; rules: RaceRules } {
	const list = words
		.get()
		.map((w) => w.text)
		.slice(0, 100);
	const text =
		list.length > 0 ? list.join(" ").slice(0, 2000) : FALLBACK_TEXT;
	const hostMode = Config.mode;
	const mode =
		hostMode === "time" || hostMode === "words" || hostMode === "quote"
			? hostMode
			: "custom";
	const value =
		hostMode === "time"
			? Config.time
			: hostMode === "words"
				? Config.words
				: list.length;
	return {
		text,
		rules: { mode, value, language: Config.language },
	};
}

export function RacePage() {
	const [code, setCode] = createSignal(getRaceCode());
	const [tried, setTried] = createSignal("");
	const [name, setName] = createSignal(getGuestName());
	const [race, setRace] = createSignal<Race | null>(null);
	const [now, setNow] = createSignal(Date.now());
	let timer: number | undefined;

	const playerName = (): string =>
		name() === "" ? getGuestId().slice(6) : name();

	const goToTrack = (raceCode: string): void => {
		setTrackCode(raceCode);
		navigationEvent.dispatch({ url: "/", options: {} });
	};

	const poll = async (): Promise<void> => {
		if (code() === "") return;
		try {
			const res = await RaceClient.get({ params: { code: code() } });
			if (res.status !== 200) {
				showNoticeNotification("Race not found");
				stopPoll();
				return;
			}
			setRace(res.body.data);
			setNow(Date.now());
			const state = res.body.data.state;
			if (state === "countdown" || state === "running") {
				stopPoll();
				goToTrack(code());
				return;
			}
			if (state === "finished") {
				stopPoll();
			}
		} catch {
			showNoticeNotification("Failed to load race");
		}
	};

	const startPoll = (): void => {
		stopPoll();
		void poll();
		timer = window.setInterval(() => {
			void poll();
		}, POLL_MS);
	};
	const stopPoll = (): void => {
		if (timer !== undefined) window.clearInterval(timer);
		timer = undefined;
	};
	onCleanup(stopPoll);

	createEffect(() => {
		const fromUrl = getRaceCode();
		if (fromUrl === "") return;
		if (fromUrl !== code()) setCode(fromUrl);
		if (race() === null && tried() !== fromUrl) {
			setTried(fromUrl);
			void join();
		}
	});

	const goToLobby = (raceCode: string): void => {
		navigationEvent.dispatch({ url: `/race/${raceCode}`, options: {} });
	};

	const create = async (): Promise<void> => {
		try {
			const source = captureRaceSource();
			const res = await RaceClient.create({
				body: {
					text: source.text,
					rules: source.rules,
					guestId: getGuestId(),
					name: playerName(),
				},
			});
			if (res.status === 200) {
				setCode(res.body.data.code);
				setRaceCode(res.body.data.code);
				startPoll();
				goToLobby(res.body.data.code);
			} else {
				showNoticeNotification("Failed to create race");
			}
		} catch {
			showNoticeNotification("Failed to create race");
		}
	};

	const join = async (): Promise<void> => {
		if (code() === "") return;
		try {
			const res = await RaceClient.join({
				params: { code: code() },
				body: { guestId: getGuestId(), name: playerName() },
			});
			if (res.status !== 200) {
				showNoticeNotification("Failed to join race");
				return;
			}
			setRaceCode(code());
			setRace(res.body.data);
			startPoll();
			goToLobby(code());
		} catch {
			showNoticeNotification("Failed to join race");
		}
	};

	const start = async (): Promise<void> => {
		if (code() === "") return;
		try {
			const res = await RaceClient.start({
				params: { code: code() },
				body: { guestId: getGuestId() },
			});
			if (res.status !== 200) {
				showNoticeNotification("Only the host can start the race");
				return;
			}
			await poll();
		} catch {
			showNoticeNotification("Failed to start race");
		}
	};

	const countdown = (): number => {
		now();
		return race()?.startsAt == null
			? 0
			: countdownMs(race()?.startsAt as number);
	};

	return (
		<Page id="race">
			<div class="flex flex-col gap-4">
				<div class="flex gap-2">
					<input
						class="bg-transparent border rounded px-2"
						placeholder="name"
						value={name()}
						onInput={(e) => {
							setName(e.currentTarget.value.slice(0, 16));
							setGuestName(e.currentTarget.value);
						}}
					/>
					<Button text="Create race" onClick={() => void create()} />
					<input
						class="bg-transparent border rounded px-2"
						placeholder="CODE"
						value={code()}
						onInput={(e) => {
							setCode(e.currentTarget.value.toUpperCase());
							setRaceCode("");
						}}
					/>
					<Button text="Join" onClick={() => void join()} />
					<Show when={race()?.state === "lobby"}>
						<Button text="Start" onClick={() => void start()} />
					</Show>
				</div>
				<Show when={code() !== ""}>
					<div class="text-2xl">Code: {code()}</div>
				</Show>
				<Show when={race() !== null}>
					<div class="text-sub">
						{race()?.rules.mode} {race()?.rules.value} {race()?.rules.language}
					</div>
					<div class="text-sub">
						State: {race()?.state}
						<Show when={race()?.state === "countdown"}>
							{" "}
							- starts in {Math.ceil(countdown() / 1000)}s, moving to track
						</Show>
						<Show when={race()?.state === "finished"}> - finished</Show>
					</div>
					<For each={race()?.players ?? []}>
						{(p) => (
							<div class={cn("flex gap-2 items-center", p.done && "opacity-60")}>
								<span>
									{p.name} {Math.round(p.wpm)}wpm
								</span>
								<div class="h-2 flex-1 rounded bg-sub">
									<div
										class="h-full rounded bg-main"
										style={{ width: `${opponentProgress(p.progress)}%` }}
									/>
								</div>
							</div>
						)}
					</For>
				</Show>
			</div>
		</Page>
	);
}
