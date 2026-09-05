import { describe, expect, it } from "vitest";
import { countdownMs, opponentProgress } from "../race-math";

describe("race-math", () => {
	it("clamps progress", () => {
		expect(opponentProgress(140)).toBe(100);
		expect(opponentProgress(-5)).toBe(0);
		expect(opponentProgress(42)).toBe(42);
	});
	it("countdown never negative", () => {
		expect(countdownMs(Date.now() + 5000)).toBeGreaterThan(0);
		expect(countdownMs(Date.now() - 5000)).toBe(0);
	});
});
