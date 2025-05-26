import { Hono } from "hono";
import { asanaAction } from "./asana/action";

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello! This is the ICSSC Projects integration server.");
});

app.route("/asana/action", asanaAction);

export default app;
