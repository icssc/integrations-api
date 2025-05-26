import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { stringToJSON } from "zod_utilz";

const asana = new Hono<{ Bindings: Cloudflare.Env }>();

asana.use(
	"*",
	cors({
		origin: "https://app.asana.com",
	}),
);

asana.get(
	"/action/feedback/metadata",
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

asana.post(
	"/action/feedback/onsubmit",
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
		return c.text("");
	},
);

export { asana };
