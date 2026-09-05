import { MonkeyResponse } from "../../utils/monkey-response";
import MonkeyError from "../../utils/error";
import { MonkeyRequest } from "../types";
import * as RaceDAL from "../../dal/race";
import * as UserDAL from "../../dal/user";
import {
	CreateRaceRequest,
	JoinRaceRequest,
	Race,
	RaceCodeParams,
	StartRaceRequest,
	UpdateProgressRequest,
} from "@monkeytype/schemas/races";

async function resolveDisplayName(
	uid: string,
	email: string,
): Promise<string> {
	try {
		const user = await UserDAL.getPartialUser(
			uid,
			"resolve race display name",
			["name"],
		);
		if (user.name !== undefined && user.name !== "") {
			return user.name;
		}
	} catch (error) {
		if (!(error instanceof MonkeyError) || error.status !== 404) {
			throw error;
		}
		// fall through to email/uid fallback below
	}
	const prefix = email.split("@")[0];
	if (prefix !== undefined && prefix !== "") {
		return prefix;
	}
	return uid.slice(0, 6);
}

const GUEST_ID_RE = /^guest-[A-Za-z0-9]{8}$/;

async function resolveIdentity(req: {
	ctx: MonkeyRequest["ctx"];
	body: { guestId?: string; name?: string };
}): Promise<{ uid: string; name: string }> {
	const { type, uid, email } = req.ctx.decodedToken;
	if (type !== "None" && uid !== "") {
		return { uid, name: await resolveDisplayName(uid, email) };
	}
	const { guestId, name } = req.body;
	if (guestId === undefined || !GUEST_ID_RE.test(guestId)) {
		throw new MonkeyError(400, "Missing guestId");
	}
	return {
		uid: guestId,
		name: name ?? guestId.slice("guest-".length),
	};
}

export async function createRace(
	req: MonkeyRequest<undefined, CreateRaceRequest>,
): Promise<MonkeyResponse<{ code: string }>> {
	const { uid, name } = await resolveIdentity(req);
	const race = await RaceDAL.createRace(uid, name, req.body.text);
	return new MonkeyResponse("Race created", { code: race.code });
}

export async function joinRace(
	req: MonkeyRequest<undefined, JoinRaceRequest, RaceCodeParams>,
): Promise<MonkeyResponse<Race>> {
	const { uid, name } = await resolveIdentity(req);
	const race = await RaceDAL.joinRace(req.params.code, uid, name);
	return new MonkeyResponse("Race joined", race);
}

export async function startRace(
	req: MonkeyRequest<undefined, StartRaceRequest, RaceCodeParams>,
): Promise<MonkeyResponse> {
	const { uid } = await resolveIdentity(req);
	await RaceDAL.startRace(req.params.code, uid);
	return new MonkeyResponse("Race started", null);
}

export async function updateProgress(
	req: MonkeyRequest<undefined, UpdateProgressRequest, RaceCodeParams>,
): Promise<MonkeyResponse> {
	const { uid } = await resolveIdentity(req);
	await RaceDAL.updateProgress(req.params.code, uid, req.body);
	return new MonkeyResponse("Progress updated", null);
}

export async function getRace(
	req: MonkeyRequest<undefined, undefined, RaceCodeParams>,
): Promise<MonkeyResponse<Race>> {
	const race = await RaceDAL.getRace(req.params.code);
	return new MonkeyResponse("Race retrieved", race);
}
