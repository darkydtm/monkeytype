export function opponentProgress(p: number): number {
	return Math.max(0, Math.min(100, p));
}

export function countdownMs(startsAt: number): number {
	return Math.max(0, startsAt - Date.now());
}
