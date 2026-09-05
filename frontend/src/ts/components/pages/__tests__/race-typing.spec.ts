import { describe, expect, it } from "vitest";
import {
	createTypingState,
	eraseKey,
	typeKey,
	typingStats,
} from "../race-typing";

describe("race typing", () => {
	it("tracks correct and wrong keys", () => {
		let s = createTypingState("ab");
		s = typeKey(s, "a", 1000);
		s = typeKey(s, "x", 2000);
		expect(s.pos).toBe(2);
		expect(s.status).toEqual(["ok", "bad"]);
		const stats = typingStats(s, 7000);
		expect(stats.acc).toBe(50);
		expect(stats.progress).toBe(50);
		expect(stats.done).toBe(false);
	});

	it("backspace clears last char", () => {
		let s = createTypingState("ab");
		s = typeKey(s, "x", 1000);
		s = eraseKey(s);
		expect(s.pos).toBe(0);
		expect(s.status).toEqual([null, null]);
		s = typeKey(s, "a", 2000);
		s = typeKey(s, "b", 3000);
		expect(typingStats(s, 4000).done).toBe(true);
	});

	it("ignores input when complete", () => {
		let s = createTypingState("a");
		s = typeKey(s, "a", 1000);
		const done = s;
		s = typeKey(s, "b", 2000);
		expect(s).toBe(done);
	});

	it("computes wpm from correct chars over minutes", () => {
		let s = createTypingState("hello");
		const t0 = 10000;
		for (const ch of "hello") {
			s = typeKey(s, ch, t0);
		}
		// 5 chars = 1 word in 60s -> 1wpm
		expect(typingStats(s, t0 + 60000).wpm).toBe(1);
		expect(typingStats(s, t0 + 60000).progress).toBe(100);
	});
});
