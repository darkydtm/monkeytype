import { Collection } from "mongodb";
import * as db from "../init/db";
import MonkeyError from "../utils/error";
import { Race, RaceState } from "@monkeytype/schemas/races";

export type DBRace = Race & {
	_id?: unknown;
	createdAt: number;
	expiresAt: Date;
};

function col(): Collection<DBRace> {
	return db.collection<DBRace>("races");
}

function makeCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let s = "";
	for (let i = 0; i < 6; i++) {
		s += chars[Math.floor(Math.random() * chars.length)];
	}
	return s;
}

export async function createRace(
	uid: string,
	name: string,
	text: string,
): Promise<Race> {
	const race: Race = {
		code: makeCode(),
		text,
		state: "lobby",
		startsAt: null,
		players: [{ uid, name, wpm: 0, acc: 100, progress: 0, done: false }],
	};
	await col().insertOne({
		...race,
		createdAt: Date.now(),
		expiresAt: new Date(Date.now() + 3600_000),
	} as DBRace);
	void col().createIndex({ code: 1 }, { unique: true }).catch(() => undefined);
	void col()
		.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
		.catch(() => undefined);
	return race;
}

export async function getRace(code: string): Promise<Race> {
	const doc = await col().findOne({ code } as any);
	if (doc === null || doc === undefined) {
		throw new MonkeyError(404, "Race not found");
	}
	return {
		code: doc.code,
		text: doc.text,
		state: doc.state as RaceState,
		startsAt: doc.startsAt ?? null,
		players: doc.players,
	};
}

export async function joinRace(
	code: string,
	uid: string,
	name: string,
): Promise<Race> {
	const race = await getRace(code);
	if (race.players.some((p) => p.uid === uid)) {
		return race;
	}
	if (race.players.length >= 2) {
		throw new MonkeyError(409, "Race is full");
	}
	if (race.state !== "lobby") {
		throw new MonkeyError(409, "Race already started");
	}
	await col().updateOne({ code } as any, {
		$push: {
			players: { uid, name, wpm: 0, acc: 100, progress: 0, done: false },
		},
	} as any);
	return getRace(code);
}

export async function startRace(code: string, uid: string): Promise<void> {
	const race = await getRace(code);
	if (race.players[0]?.uid !== uid) {
		throw new MonkeyError(403, "Only host can start");
	}
	if (race.state !== "lobby") {
		throw new MonkeyError(409, "Already started");
	}
	await col().updateOne({ code } as any, {
		$set: { state: "countdown", startsAt: Date.now() + 3000 },
	} as any);
}

export async function updateProgress(
	code: string,
	uid: string,
	p: { wpm: number; acc: number; progress: number; done: boolean },
): Promise<void> {
	const doneAt = p.done ? Date.now() : undefined;
	await col().updateOne({ code, "players.uid": uid } as any, {
		$set: {
			"players.$.wpm": Math.min(300, p.wpm),
			"players.$.acc": p.acc,
			"players.$.progress": p.progress,
			"players.$.done": p.done,
			...(p.done ? { "players.$.finishTimeMs": doneAt } : {}),
		},
	} as any);
	const race = await getRace(code);
	if (
		race.players.length > 0 &&
		race.players.every((x) => x.done) &&
		race.state !== "finished"
	) {
		await col().updateOne({ code } as any, {
			$set: { state: "finished" },
		} as any);
	}
}
