import { createApp } from "./app.js";
import { dbConnect } from "./lib/db.js";
const port = Number(process.env.PORT || 3001);
const app = createApp();
async function start() {
    await dbConnect();
    app.listen(port, () => {
        console.log(`Backend listening on port ${port}`);
    });
}
start().catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
});
