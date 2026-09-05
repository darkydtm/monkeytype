import { describe, expect, it } from "vitest";
import { RaceSchema } from "../src/races";
describe("RaceSchema", () => {
	it("rejects progress > 100", () => {
		const r = RaceSchema.safeParse({ code: "ABC123", text: "hi", state: "running", players: [{ uid: "u1", name: "a", wpm: 0, acc: 100, progress: 101, done: false }] });
		expect(r.success).toBe(false);
	});
});
