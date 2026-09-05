import { describe, expect, it } from "vitest";
import { buildMirrorWords, escapeHtml, standings } from "../race-mirror";
import type { Race } from "@monkeytype/schemas/races";

describe("race mirror", () => {
	it("escapes html in words", () => {
		expect(escapeHtml("<b>&\"")).toBe("&lt;b&gt;&amp;&quot;");
	});

	it("marks done words correct", () => {
		const html = buildMirrorWords(["hi", "yo"], 1);
		expect(html).toContain(`<div class="word"><letter class="correct">h</letter>`);
		expect(html).toContain(`<letter class="">y</letter>`);
	});

	it("sorts standings by done then progress", () => {
		const race = {
			players: [
				{ uid: "a", name: "slow", wpm: 10, acc: 90, progress: 20, done: false },
				{ uid: "b", name: "fast", wpm: 80, acc: 97, progress: 100, done: true },
			],
		} as Race;
		const html = standings(race);
		expect(html.indexOf("fast")).toBeLessThan(html.indexOf("slow"));
	});
});
