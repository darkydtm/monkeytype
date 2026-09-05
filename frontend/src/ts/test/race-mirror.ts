import type { Race } from "@monkeytype/schemas/races";

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function buildMirrorWords(
	wordList: string[],
	doneWords: number,
): string {
	return wordList
		.map((word, wi) => {
			const cls = wi < doneWords ? "correct" : "";
			const letters = [...word]
				.map((ch) => `<letter class="${cls}">${escapeHtml(ch)}</letter>`)
				.join("");
			return `<div class="word">${letters}</div>`;
		})
		.join(" ");
}

export function standings(race: Race): string {
	const sorted = [...race.players].sort(
		(a, b) =>
			Number(b.done) - Number(a.done) ||
			(a.finishTimeMs ?? Number.MAX_VALUE) -
				(b.finishTimeMs ?? Number.MAX_VALUE) ||
			b.progress - a.progress,
	);
	return sorted
		.map(
			(p, i) =>
				`<div>${i + 1}. ${escapeHtml(p.name)} - ${Math.round(p.wpm)}wpm ${Math.round(p.acc)}%</div>`,
		)
		.join("");
}
