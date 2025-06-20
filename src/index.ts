import { Elysia } from "elysia";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
    throw new Error("Missing DISCORD_WEBHOOK_URL in environment");
}

const app = new Elysia();

app.post("/mailgun", async ({ body, set }) => {
    const {
        subject,
        from,
        recipient,
        "body-plain": bodyPlain,
        "stripped-text": strippedText,
    } = body as Record<string, string>;

    const embed = {
        title: subject || "No Subject",
        description: (strippedText || bodyPlain || "No content").slice(0, 2048),
        color: 0x6a0dad,
        fields: [
            { name: "From", value: from || "Unknown", inline: true },
            { name: "To", value: recipient || "Unknown", inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Pit Podcast Email Bot" },
    };

    const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: "Cameo",
            avatar_url: "https://play-lh.googleusercontent.com/_FPZW0siOqA6du-OLwA3Mz_i6y-KT5cNpZBVcccQNHJ4iMgaeLKraPBYl87qXjz3984",
            embeds: [embed],
        }),
    });

    if (!res.ok) {
        console.error("Discord webhook failed:", res.statusText);
        set.status = 500;
        return "Error sending to Discord";
    }

    return "OK";
});

app.listen(PORT, () => {
    console.log("Listening on http://localhost:" + PORT);
});
