import { racesContract } from "@monkeytype/contracts/races";
import { initServer } from "@ts-rest/express";
import * as RaceController from "../controllers/race";
import { callController } from "../ts-rest-adapter";

const s = initServer();
export default s.router(racesContract, {
	create: {
		handler: async (r) => callController(RaceController.createRace)(r),
	},
	join: {
		handler: async (r) => callController(RaceController.joinRace)(r),
	},
	start: {
		handler: async (r) => callController(RaceController.startRace)(r),
	},
	updateProgress: {
		handler: async (r) => callController(RaceController.updateProgress)(r),
	},
	get: {
		handler: async (r) => callController(RaceController.getRace)(r),
	},
});
