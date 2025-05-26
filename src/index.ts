import { Hono } from "hono";
import { asana } from "./asana";

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello! This is the ICSSC Projects integration server.");
});

app.route("/asana", asana);

export default app;
