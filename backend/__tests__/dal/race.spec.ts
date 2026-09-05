import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/init/db", () => ({ collection: vi.fn() }));

import { collection } from "../../src/init/db";
import * as RaceDAL from "../../src/dal/race";
import MonkeyError from "../../src/utils/error";

function mockRacesCollection(methods: Record<string, unknown>): void {
	(collection as any).mockReturnValue({
		insertOne: vi.fn().mockResolvedValue({ insertedId: "x" }),
		findOne: vi.fn(),
		updateOne: vi.fn().mockResolvedValue({}),
		createIndex: vi.fn().mockResolvedValue(undefined),
		...methods,
	});
}

describe("RaceDAL.createRace", () => {
	it("creates lobby with host player", async () => {
		const insertOne = vi.fn().mockResolvedValue({ insertedId: "x" });
		mockRacesCollection({ insertOne });
		const race = await RaceDAL.createRace("uid1", "Bob", "hello world");
		expect(race.code).toHaveLength(6);
		expect(race.state).toBe("lobby");
		expect(race.players).toHaveLength(1);
		expect(race.players[0]).toMatchObject({ uid: "uid1", name: "Bob" });
		expect(insertOne).toHaveBeenCalledOnce();
	});
});

describe("RaceDAL.getRace", () => {
	it("throws 404 when race is missing", async () => {
		mockRacesCollection({ findOne: vi.fn().mockResolvedValue(null) });
		const error = await RaceDAL.getRace("AAAAAA").catch((e) => e);
		expect(error).toBeInstanceOf(MonkeyError);
		expect((error as MonkeyError).status).toBe(404);
	});
});

describe("RaceDAL.joinRace", () => {
	it("rejects join when race is full", async () => {
		mockRacesCollection({
			findOne: vi.fn().mockResolvedValue({
				code: "AAAAAA",
				text: "hi",
				state: "lobby",
				startsAt: null,
				players: [
					{ uid: "u1", name: "A", wpm: 0, acc: 100, progress: 0, done: false },
					{ uid: "u2", name: "B", wpm: 0, acc: 100, progress: 0, done: false },
				],
			}),
		});
		const error = await RaceDAL.joinRace("AAAAAA", "u3", "C").catch(
			(e) => e,
		);
		expect(error).toBeInstanceOf(MonkeyError);
		expect((error as MonkeyError).status).toBe(409);
	});
});

describe("RaceDAL.startRace", () => {
	it("rejects start by non-host", async () => {
		mockRacesCollection({
			findOne: vi.fn().mockResolvedValue({
				code: "AAAAAA",
				text: "hi",
				state: "lobby",
				startsAt: null,
				players: [
					{ uid: "u1", name: "A", wpm: 0, acc: 100, progress: 0, done: false },
				],
			}),
		});
		const error = await RaceDAL.startRace("AAAAAA", "u2").catch((e) => e);
		expect(error).toBeInstanceOf(MonkeyError);
		expect((error as MonkeyError).status).toBe(403);
	});
});

describe("RaceDAL.getRace countdown->running transition", () => {
	it("writes running once startsAt passes", async () => {
		const updateOne = vi.fn().mockResolvedValue({});
		mockRacesCollection({
			updateOne,
			findOne: vi.fn().mockResolvedValue({
				code: "AAAAAA",
				text: "hi",
				state: "countdown",
				startsAt: Date.now() - 1000,
				players: [
					{ uid: "u1", name: "A", wpm: 0, acc: 100, progress: 0, done: false },
				],
			}),
		});
		const race = await RaceDAL.getRace("AAAAAA");
		expect(race.state).toBe("running");
		expect(updateOne).toHaveBeenCalledOnce();
		expect(updateOne).toHaveBeenCalledWith(
			{ code: "AAAAAA" },
			{ $set: { state: "running" } },
		);
	});

	it("keeps countdown while startsAt is in the future", async () => {
		const updateOne = vi.fn().mockResolvedValue({});
		mockRacesCollection({
			updateOne,
			findOne: vi.fn().mockResolvedValue({
				code: "AAAAAA",
				text: "hi",
				state: "countdown",
				startsAt: Date.now() + 60_000,
				players: [
					{ uid: "u1", name: "A", wpm: 0, acc: 100, progress: 0, done: false },
				],
			}),
		});
		const race = await RaceDAL.getRace("AAAAAA");
		expect(race.state).toBe("countdown");
		expect(updateOne).not.toHaveBeenCalled();
	});
});

describe("RaceDAL.updateProgress", () => {
	it("marks race finished when all players are done", async () => {
		const updateOne = vi.fn().mockResolvedValue({});
		mockRacesCollection({
			updateOne,
			findOne: vi.fn().mockResolvedValue({
				code: "AAAAAA",
				text: "hi",
				state: "running",
				startsAt: Date.now() - 5000,
				players: [
					{ uid: "u1", name: "A", wpm: 10, acc: 100, progress: 100, done: true },
				],
			}),
		});
		await RaceDAL.updateProgress("AAAAAA", "u1", {
			wpm: 10,
			acc: 100,
			progress: 100,
			done: true,
		});
		expect(updateOne).toHaveBeenCalledTimes(2);
	});

	it("rejects progress from non-member with 403", async () => {
		const updateOne = vi.fn().mockResolvedValue({});
		mockRacesCollection({
			updateOne,
			findOne: vi.fn().mockResolvedValue({
				code: "AAAAAA",
				text: "hi",
				state: "running",
				startsAt: Date.now() - 5000,
				players: [
					{ uid: "u1", name: "A", wpm: 0, acc: 100, progress: 0, done: false },
				],
			}),
		});
		const error = await RaceDAL.updateProgress("AAAAAA", "u2", {
			wpm: 10,
			acc: 100,
			progress: 10,
			done: false,
		}).catch((e) => e);
		expect(error).toBeInstanceOf(MonkeyError);
		expect((error as MonkeyError).status).toBe(403);
		expect(updateOne).not.toHaveBeenCalled();
	});

	it("rejects progress on finished race with 409", async () => {
		const updateOne = vi.fn().mockResolvedValue({});
		mockRacesCollection({
			updateOne,
			findOne: vi.fn().mockResolvedValue({
				code: "AAAAAA",
				text: "hi",
				state: "finished",
				startsAt: Date.now() - 5000,
				players: [
					{ uid: "u1", name: "A", wpm: 10, acc: 100, progress: 100, done: true },
				],
			}),
		});
		const error = await RaceDAL.updateProgress("AAAAAA", "u1", {
			wpm: 10,
			acc: 100,
			progress: 100,
			done: true,
		}).catch((e) => e);
		expect(error).toBeInstanceOf(MonkeyError);
		expect((error as MonkeyError).status).toBe(409);
		expect(updateOne).not.toHaveBeenCalled();
	});
});
