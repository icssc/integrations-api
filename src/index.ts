import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello! This is the ICSSC Projects integration server.");
});

export default app;
