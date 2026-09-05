import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { Race } from "@monkeytype/schemas/races";
import { Button } from "../common/Button";
import { Page } from "../common/Page";
import { cn } from "../../utils/cn";
import { RaceClient } from "../../ape/races";
import { countdownMs, opponentProgress } from "./race-math";
import { navigationEvent } from "../../events/navigation";
import { showNoticeNotification } from "../../states/notifications";
import {
	getGuestId,
	getGuestName,
	getRaceCode,
	pushProgressThrottled,
	resetPushThrottle,
	setGuestName,
	setRaceCode,
} from "./race-progress";
import {
	createTypingState,
	eraseKey,
	toRaceStats,
	typeKey,
	typingStats,
} from "./race-typing";

const POLL_MS = 500;
const PUSH_MS = 250;

export function RacePage() {
	const [code, setCode] = createSignal(getRaceCode());
	const [tried, setTried] = createSignal("");
	const [name, setName] = createSignal(getGuestName());
	const [typing, setTyping] = createSignal(createTypingState(""));
	let area: HTMLDivElement | undefined;
	const playerName = (): string =>
		name() === "" ? getGuestId().slice(6) : name();
	const myStats = (): ReturnType<typeof toRaceStats> =>
		toRaceStats(typingStats(typing(), Date.now()));
	const [race, setRace] = createSignal<Race | null>(null);
	const [now, setNow] = createSignal(Date.now());
	let timer: number | undefined;
	let pushTimer: number | undefined;

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
			if (res.body.data.state === "finished") {
				stopPoll();
				stopPush();
				return;
			}
			syncPushTimer();
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
	const stopPush = (): void => {
		if (pushTimer !== undefined) window.clearInterval(pushTimer);
		pushTimer = undefined;
	};
	const syncPushTimer = (): void => {
		const running = race()?.state === "running" && code() !== "";
		if (running && pushTimer === undefined) {
			pushTimer = window.setInterval(() => {
				void pushProgressThrottled(code(), myStats);
			}, PUSH_MS);
		} else if (!running && pushTimer !== undefined) {
			stopPush();
		}
	};
	onCleanup(() => {
		stopPoll();
		stopPush();
	});

	createEffect(() => {
		const fromUrl = getRaceCode();
		if (fromUrl === "") return;
		if (fromUrl !== code()) setCode(fromUrl);
		if (race() === null && tried() !== fromUrl) {
			setTried(fromUrl);
			void join();
		}
	});

	createEffect(() => {
		const text = race()?.text ?? "";
		setTyping((prev) => (prev.text === text ? prev : createTypingState(text)));
	});

	createEffect(() => {
		if (race()?.state === "running") area?.focus();
	});

	createEffect(() => {
		if (myStats().done && race()?.state === "running" && code() !== "") {
			resetPushThrottle();
			void pushProgressThrottled(code(), myStats);
		}
	});

	const onTypeKey = (e: KeyboardEvent): void => {
		if (race()?.state !== "running") return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === "Backspace") {
			e.preventDefault();
			setTyping((s) => eraseKey(s));
			return;
		}
		if (e.key.length !== 1) return;
		e.preventDefault();
		const now = Date.now();
		setTyping((s) => typeKey(s, e.key, now));
	};

	const wordsWithOffsets = (): { word: string; start: number }[] => {
		const text = typing().text;
		if (text === "") return [];
		let offset = 0;
		return text.split(" ").map((word) => {
			const start = offset;
			offset += word.length + 1;
			return { word, start };
		});
	};

	const standings = (): { name: string; wpm: number; acc: number }[] =>
		[...(race()?.players ?? [])]
			.sort(
				(a, b) =>
					Number(b.done) - Number(a.done) ||
					(a.finishTimeMs ?? Number.MAX_VALUE) -
						(b.finishTimeMs ?? Number.MAX_VALUE) ||
					b.progress - a.progress,
			)
			.map((p) => ({ name: p.name, wpm: Math.round(p.wpm), acc: Math.round(p.acc) }));

	const goToRace = (raceCode: string): void => {
		navigationEvent.dispatch({ url: `/race/${raceCode}`, options: {} });
	};

	const create = async (): Promise<void> => {
		try {
			const res = await RaceClient.create({
				body: {
					text: "the quick brown fox jumps over the lazy dog ".repeat(5),
					guestId: getGuestId(),
					name: playerName(),
				},
			});
			if (res.status === 200) {
				setCode(res.body.data.code);
				setRaceCode(res.body.data.code);
				startPoll();
				goToRace(res.body.data.code);
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
			startPoll();
			goToRace(code());
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
				<Show when={race()?.text !== undefined && race()?.text !== ""}>
						<div
							ref={(el) => {
								area = el;
							}}
							tabIndex={0}
							onKeyDown={onTypeKey}
							onClick={(e) => e.currentTarget.focus()}
							class="outline-none cursor-text text-2xl leading-relaxed"
						>
							<For each={wordsWithOffsets()}>
								{({ word, start }) => (
									<span class="inline-block mr-[0.5ch]">
										<For each={word.split("")}>
											{(ch, i) => {
												const index = start + i();
												const st = typing().status[index];
												return (
													<span
														class={cn(
															st === "ok" && "text-text",
															st === "bad" && "text-error",
															st === null && "text-sub",
															index === typing().pos &&
																"border-b-2 border-caret",
														)}
													>
														{ch}
													</span>
												);
											}}
										</For>
									</span>
								)}
							</For>
						</div>
						<Show when={race()?.state === "running"}>
							<div class="text-sub">
								{myStats().wpm}wpm {myStats().acc}%{" "}
								{typing().pos === 0 && "click the text and type"}
							</div>
						</Show>
					</Show>
					<Show when={race()?.state === "finished"}>
						<div class="flex flex-col gap-1">
							<For each={standings()}>
								{(p, i) => (
									<div>
										{i() + 1}. {p.name} - {p.wpm}wpm {p.acc}%
									</div>
								)}
							</For>
						</div>
					</Show>
				<Show when={race() !== null}>
					<div class="text-sub">
						State: {race()?.state}
						<Show when={race()?.state === "countdown"}>
							{" "}
							- starts in {Math.ceil(countdown() / 1000)}s
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
