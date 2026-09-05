import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushProgressThrottled, resetPushThrottle } from "../race-progress";
import { RaceClient } from "../../ape/races";

vi.mock("../../ape/races", () => ({
	RaceClient: {
		updateProgress: vi.fn(async () => ({ status: 200, body: {} })),
	},
}));

const sender = RaceClient.updateProgress as unknown as {
	mock: { calls: unknown[][] };
};

describe("pushProgressThrottled", () => {
	beforeEach(() => {
		resetPushThrottle();
		sender.mock.calls.length = 0;
	});
	it("sends at most one request per 250ms", async () => {
		const stats = () => ({ wpm: 80, acc: 97, progress: 10, done: false });
		const first = await pushProgressThrottled("ABCDEF", stats);
		const second = await pushProgressThrottled("ABCDEF", stats);
		expect(first).toBe(true);
		expect(second).toBe(false);
		expect(sender.mock.calls.length).toBe(1);
	});
});
