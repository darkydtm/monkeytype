import { z } from "zod";

export const RaceStateSchema = z.enum(["lobby", "countdown", "running", "finished"]);
export type RaceState = z.infer<typeof RaceStateSchema>;

export const RacePlayerSchema = z.object({
	uid: z.string().min(1),
	name: z.string().min(1).max(16),
	wpm: z.number().min(0).max(300),
	acc: z.number().min(0).max(100),
	progress: z.number().min(0).max(100),
	done: z.boolean(),
	finishTimeMs: z.number().min(0).nullable().optional(),
});
export type RacePlayer = z.infer<typeof RacePlayerSchema>;

export const RaceSchema = z.object({
	code: z.string().length(6),
	text: z.string().min(1).max(2000),
	state: RaceStateSchema,
	startsAt: z.number().nullable().optional(),
	players: z.array(RacePlayerSchema).min(1).max(2),
});
export type Race = z.infer<typeof RaceSchema>;

export const CreateRaceRequestSchema = z.object({ text: z.string().min(1).max(2000) }).strict();
export type CreateRaceRequest = z.infer<typeof CreateRaceRequestSchema>;

export const UpdateProgressRequestSchema = z
	.object({
		wpm: z.number().min(0).max(300),
		acc: z.number().min(0).max(100),
		progress: z.number().min(0).max(100),
		done: z.boolean(),
	})
	.strict();
export type UpdateProgressRequest = z.infer<typeof UpdateProgressRequestSchema>;

export const RaceCodeParamsSchema = z.object({ code: z.string().length(6) });
export type RaceCodeParams = z.infer<typeof RaceCodeParamsSchema>;

export const RaceResponseSchema = z.object({ message: z.string(), data: RaceSchema });
export type RaceResponse = z.infer<typeof RaceResponseSchema>;
