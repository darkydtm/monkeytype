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

export const GuestIdSchema = z.string().regex(/^guest-[A-Za-z0-9]{8}$/);
export type GuestId = z.infer<typeof GuestIdSchema>;

export const GuestNameSchema = z.string().min(1).max(16);
export type GuestName = z.infer<typeof GuestNameSchema>;

export const GuestIdentitySchema = z.object({
	guestId: GuestIdSchema.optional(),
	name: GuestNameSchema.optional(),
});
export type GuestIdentity = z.infer<typeof GuestIdentitySchema>;

export const CreateRaceRequestSchema = z
	.object({ text: z.string().min(1).max(2000) })
	.extend(GuestIdentitySchema.shape)
	.strict();
export type CreateRaceRequest = z.infer<typeof CreateRaceRequestSchema>;

export const JoinRaceRequestSchema = GuestIdentitySchema.strict();
export type JoinRaceRequest = z.infer<typeof JoinRaceRequestSchema>;

export const StartRaceRequestSchema = GuestIdentitySchema.strict();
export type StartRaceRequest = z.infer<typeof StartRaceRequestSchema>;

export const UpdateProgressRequestSchema = z
	.object({
		wpm: z.number().min(0).max(300),
		acc: z.number().min(0).max(100),
		progress: z.number().min(0).max(100),
		done: z.boolean(),
	})
	.extend({ guestId: GuestIdSchema.optional() })
	.strict();
export type UpdateProgressRequest = z.infer<typeof UpdateProgressRequestSchema>;

export const RaceCodeParamsSchema = z.object({ code: z.string().length(6) });
export type RaceCodeParams = z.infer<typeof RaceCodeParamsSchema>;

export const RaceResponseSchema = z.object({ message: z.string(), data: RaceSchema });
export type RaceResponse = z.infer<typeof RaceResponseSchema>;
