import { envConfig } from "virtual:env-config";
import { racesContract } from "@monkeytype/contracts/races";
import { buildClient } from "./adapters/ts-rest-adapter";

export const RaceClient = buildClient(racesContract, envConfig.backendUrl);
