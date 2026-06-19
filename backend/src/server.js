import { createApp } from "./app.js";
import { dbConnect } from "./lib/db.js";
const port = Number(process.env.PORT || 3001);
const app = createApp();
let server = null;
async function shutdown(signal) {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
        server = null;
    }
    process.exit(signal === "SIGINT" ? 130 : 0);
}
async function start() {
    await dbConnect();
    server = app.listen(port, () => {
        console.log(`Backend listening on port ${port}`);
    });
}
start().catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
});
process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
    void shutdown("SIGINT");
});
