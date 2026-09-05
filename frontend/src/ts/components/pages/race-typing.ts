import type { RaceStats } from "./race-progress";

export type CharState = "ok" | "bad" | null;

export type TypingState = {
	text: string;
	status: CharState[];
	pos: number;
	correctKeys: number;
	wrongKeys: number;
	startedAt: number | null;
};

export type TypingStats = {
	wpm: number;
	acc: number;
	progress: number;
	done: boolean;
};

export function createTypingState(text: string): TypingState {
	return {
		text,
		status: new Array<CharState>(text.length).fill(null),
		pos: 0,
		correctKeys: 0,
		wrongKeys: 0,
		startedAt: null,
	};
}

export function typeKey(
	state: TypingState,
	key: string,
	now: number,
): TypingState {
	if (state.pos >= state.text.length) return state;
	const status = state.status.slice();
	const ok = key === state.text[state.pos];
	status[state.pos] = ok ? "ok" : "bad";
	return {
		...state,
		status,
		pos: state.pos + 1,
		correctKeys: state.correctKeys + (ok ? 1 : 0),
		wrongKeys: state.wrongKeys + (ok ? 0 : 1),
		startedAt: state.startedAt ?? now,
	};
}

export function eraseKey(state: TypingState): TypingState {
	if (state.pos === 0) return state;
	const status = state.status.slice();
	status[state.pos - 1] = null;
	return { ...state, status, pos: state.pos - 1 };
}

export function typingStats(state: TypingState, now: number): TypingStats {
	const total = state.text.length;
	let ok = 0;
	for (const s of state.status) {
		if (s === "ok") ok++;
	}
	const keys = state.correctKeys + state.wrongKeys;
	const elapsedMin =
		state.startedAt === null
			? 0
			: Math.max(now - state.startedAt, 1000) / 60000;
	return {
		wpm: elapsedMin === 0 ? 0 : Math.round(ok / 5 / elapsedMin),
		acc: keys === 0 ? 100 : Math.round((state.correctKeys / keys) * 100),
		progress: total === 0 ? 0 : Math.round((ok / total) * 100),
		done: total > 0 && ok === total,
	};
}

export function toRaceStats(stats: TypingStats): RaceStats {
	return {
		wpm: Math.max(0, Math.min(300, stats.wpm)),
		acc: Math.max(0, Math.min(100, stats.acc)),
		progress: Math.max(0, Math.min(100, stats.progress)),
		done: stats.done,
	};
}
