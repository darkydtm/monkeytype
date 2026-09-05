import { navigate } from "../../controllers/route-controller";
import {
	showNoticeNotification,
	showSuccessNotification,
} from "../../states/notifications";
import { RaceClient } from "../../ape/races";
import {
	captureRaceSource,
	getGuestId,
	getGuestName,
	setRaceCode,
} from "../../components/pages/race-progress";
import { Command } from "../types";

async function createRaceFromCurrentTest(): Promise<void> {
	const source = captureRaceSource();
	const name =
		getGuestName() === "" ? getGuestId().slice(6) : getGuestName();
	try {
		const res = await RaceClient.create({
			body: {
				text: source.text,
				rules: source.rules,
				guestId: getGuestId(),
				name,
			},
		});
		if (res.status !== 200) {
			showNoticeNotification("Failed to create race");
			return;
		}
		const code = res.body.data.code;
		setRaceCode(code);
		showSuccessNotification(`Race lobby created: ${code}`);
		await navigate(`/race/${code}`);
	} catch {
		showNoticeNotification("Failed to create race");
	}
}

const commands: Command[] = [
	{
		id: "createRaceFromTest",
		display: "Create race from current test",
		alias: "race multiplayer klavogonki invite",
		icon: "fa-flag-checkered",
		exec: (): void => {
			void createRaceFromCurrentTest();
		},
	},
	{
		id: "viewRacePage",
		display: "View race page",
		alias: "race multiplayer navigate go to",
		icon: "fa-flag-checkered",
		exec: (): void => {
			void navigate("/race");
		},
	},
];

export default commands;
