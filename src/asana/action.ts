import { getRestClient } from "@/lib/discord/getRestClient";
import { zValidator } from "@hono/zod-validator";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Routes,
} from "discord.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { stringToJSON } from "zod_utilz";

const asanaAction = new Hono<{ Bindings: Cloudflare.Env }>();

asanaAction.use(
	"*",
	cors({
		origin: "https://app.asana.com",
	}),
);

asanaAction.get(
	"/feedback/metadata",
	zValidator(
		"query",
		z.object({
			action: z.string().optional(),
			action_type: z.string(),
			project: z.string(),
			workspace: z.string(),
			user: z.string(),
			expires_at: z.coerce.date(),
		}),
	),
	async (c) => {
		const action = c.req.valid("query").action;

		return c.json({
			template: "form_metadata_v0",
			metadata: {
				title: "Send Feedback to Discord",
				on_submit_callback: new URL(
					"/asana/action/feedback/onsubmit",
					c.env.BASE_URL,
				),
				fields: [
					{
						id: "discord_channel_id",
						is_required: true,
						name: "Discord Channel ID",
						placeholder: "810330382993457192",
						type: "single_line_text",
						value: action
							? await c.env.ASANA_DISCORD_CHANNEL_MAP.get(action)
							: "",
						width: "full",
					},
				],
			},
		});
	},
);

asanaAction.post(
	"/feedback/onsubmit",
	zValidator(
		"json",
		z.object({
			data: stringToJSON().pipe(
				z.object({
					expires_at: z.coerce.date().optional(),
					user: z.number().optional(),
					workspace: z.number().optional(),
					values: z.object({
						discord_channel_id: z.string(),
					}),
					task: z.string().optional(),
					rule_name: z.string().optional(),
					action: z.string(),
					action_type: z.string().optional(),
					project: z.number().optional(),
				}),
			),
		}),
	),
	async (c) => {
		const data = c.req.valid("json").data;
		await c.env.ASANA_DISCORD_CHANNEL_MAP.put(
			data.action,
			data.values.discord_channel_id,
		);
		return c.body(null);
	},
);

asanaAction.post(
	"/feedback/run",
	zValidator(
		"json",
		z.object({
			data: stringToJSON().pipe(
				z.object({
					expires_at: z.coerce.date().optional(),
					user: z.number().optional(),
					workspace: z.number().optional(),
					project: z.number().optional(),
					target_object: z.number().optional(),
					action: z.string(),
					action_type: z.string().optional(),
					idempotency_key: z.string(),
				}),
			),
		}),
	),
	async (c) => {
		const action = c.req.valid("json").data.action;

		const taskId = c.req.valid("json").data.target_object;
		const channelId = await c.env.ASANA_DISCORD_CHANNEL_MAP.get(action);

		const client = getRestClient(c.env.DISCORD_TOKEN);

		if (!channelId) {
			return c.json(
				{
					error: "Could not retrieve Discord Channel ID.",
				},
				500,
			);
		}

		const messageResponse = await fetch(
			`https://app.asana.com/api/1.0/tasks/${taskId}`,
			{
				headers: {
					Authorization: `Bearer ${c.env.ASANA_BEARER}`,
				},
			},
		);

		if (!messageResponse.ok) {
			return c.json(
				{
					error: `Could not retrieve Asana task details: ${taskId} (${messageResponse.status})`,
				},
				500,
			);
		}

		const MessageSchema = z.object({
			data: z.object({
				notes: z.string(),
				permalink_url: z.string(),
			}),
		});

		const message = MessageSchema.safeParse(await messageResponse.json());

		if (message.error) {
			return c.json(
				{
					error: "Could not parse Asana task details.",
				},
				500,
			);
		}

		const messageNoFormLink =
			message.data.data.notes.split("———————————————")[0];

		try {
			const discordButton = new ButtonBuilder()
				.setLabel("Asana Task")
				.setURL(message.data.data.permalink_url)
				.setStyle(ButtonStyle.Link);
			const discordActionRow = new ActionRowBuilder().addComponents(
				discordButton,
			);
			await client.post(Routes.channelMessages(channelId), {
				body: {
					content: messageNoFormLink,
					components: [discordActionRow.toJSON()],
				},
			});
		} catch (e) {
			console.error(e);
			return c.json(
				{
					error: "Failed to send Discord message with error.",
				},
				500,
			);
		}

		return c.json({
			action_result: "ok",
		});
	},
);

export { asanaAction };
