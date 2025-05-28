import { REST } from "discord.js";

export const getRestClient = (token: string) => {
	const rest = new REST({ version: "10" }).setToken(token);
	return rest;
};
