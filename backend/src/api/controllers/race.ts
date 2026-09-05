import { MonkeyResponse } from "../../utils/monkey-response";
import { MonkeyRequest } from "../types";
import * as RaceDAL from "../../dal/race";
import * as UserDAL from "../../dal/user";
import {
	CreateRaceRequest,
	Race,
	RaceCodeParams,
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
	} catch {
		// fall through to email/uid fallback below
	}
	const prefix = email.split("@")[0];
	if (prefix !== undefined && prefix !== "") {
		return prefix;
	}
	return uid.slice(0, 6);
}

export async function createRace(
	req: MonkeyRequest<undefined, CreateRaceRequest>,
): Promise<MonkeyResponse<{ code: string }>> {
	const { uid, email } = req.ctx.decodedToken;
	const name = await resolveDisplayName(uid, email);
	const race = await RaceDAL.createRace(uid, name, req.body.text);
	return new MonkeyResponse("Race created", { code: race.code });
}

export async function joinRace(
	req: MonkeyRequest<undefined, undefined, RaceCodeParams>,
): Promise<MonkeyResponse<Race>> {
	const { uid, email } = req.ctx.decodedToken;
	const name = await resolveDisplayName(uid, email);
	const race = await RaceDAL.joinRace(req.params.code, uid, name);
	return new MonkeyResponse("Race joined", race);
}

export async function startRace(
	req: MonkeyRequest<undefined, undefined, RaceCodeParams>,
): Promise<MonkeyResponse> {
	await RaceDAL.startRace(req.params.code, req.ctx.decodedToken.uid);
	return new MonkeyResponse("Race started", null);
}

export async function updateProgress(
	req: MonkeyRequest<undefined, UpdateProgressRequest, RaceCodeParams>,
): Promise<MonkeyResponse> {
	await RaceDAL.updateProgress(
		req.params.code,
		req.ctx.decodedToken.uid,
		req.body,
	);
	return new MonkeyResponse("Progress updated", null);
}

export async function getRace(
	req: MonkeyRequest<undefined, undefined, RaceCodeParams>,
): Promise<MonkeyResponse<Race>> {
	const race = await RaceDAL.getRace(req.params.code);
	return new MonkeyResponse("Race retrieved", race);
}
