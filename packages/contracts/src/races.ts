import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
	CommonResponses,
	meta,
	MonkeyResponseSchema,
	responseWithData,
} from "./util/api";
import {
	CreateRaceRequestSchema,
	RaceCodeParamsSchema,
	RaceSchema,
	UpdateProgressRequestSchema,
} from "@monkeytype/schemas/races";

const c = initContract();

export const racesContract = c.router(
	{
		create: {
			summary: "create race",
			method: "POST",
			path: "",
			body: CreateRaceRequestSchema,
			responses: {
				200: responseWithData(z.object({ code: z.string() })),
			},
			metadata: meta({
				rateLimit: "racesCreate",
			}),
		},
		join: {
			summary: "join race",
			method: "POST",
			path: "/:code/join",
			pathParams: RaceCodeParamsSchema,
			body: c.noBody(),
			responses: {
				200: responseWithData(RaceSchema),
			},
			metadata: meta({
				rateLimit: "racesJoin",
			}),
		},
		start: {
			summary: "start race",
			method: "POST",
			path: "/:code/start",
			pathParams: RaceCodeParamsSchema,
			body: c.noBody(),
			responses: {
				200: MonkeyResponseSchema,
			},
			metadata: meta({
				rateLimit: "racesStart",
			}),
		},
		updateProgress: {
			summary: "update progress",
			method: "PATCH",
			path: "/:code/progress",
			pathParams: RaceCodeParamsSchema,
			body: UpdateProgressRequestSchema.strict(),
			responses: {
				200: MonkeyResponseSchema,
			},
			metadata: meta({
				rateLimit: "racesProgress",
			}),
		},
		get: {
			summary: "get race",
			method: "GET",
			path: "/:code",
			pathParams: RaceCodeParamsSchema,
			responses: {
				200: responseWithData(RaceSchema),
			},
			metadata: meta({
				rateLimit: "racesGet",
			}),
		},
	},
	{
		pathPrefix: "/races",
		strictStatusCodes: true,
		metadata: meta({
			openApiTags: "races",
		}),
		commonResponses: CommonResponses,
	},
);
