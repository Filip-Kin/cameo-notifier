import { Elysia } from "elysia";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
    throw new Error("Missing DISCORD_WEBHOOK_URL in environment");
}

function extractFieldsFromHtml(input: string): { name: string; value: string; inline: boolean; }[] {
    const stripped = input
        .replace(/<br\s*\/?>/gi, "\n") // Convert <br> to newline
        .replace(/<\/?[^>]+(>|$)/g, "") // Remove remaining HTML tags
        .replace(/=E2=80=99/g, "’") // decode ’
        .replace(/=E2=80=9D/g, "”") // decode ”
        .replace(/=E2=80=9C/g, "“") // decode “
        .replace(/=20/g, " ") // decode space
        .replace(/=3D/g, "="); // decode =

    // Match blocks like: **Field name:**\nvalue
    const regex = /(?:\*\*|^)(.+?):\*\*?\s*\n([\s\S]*?)(?=\n{2,}|\n\*\*|$)/g;

    const fields: { name: string; value: string; inline: boolean; }[] = [];
    let match;
    while ((match = regex.exec(stripped)) !== null) {
        const name = match[1].trim();
        const value = match[2].trim();
        if (name && value) {
            fields.push({ name, value, inline: false });
        }
    }

    return fields;
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
    const htmlBody = (body as Record<string, string>)["body-html"] ?? "";
    const plainBody = (body as Record<string, string>)["body-plain"] ?? "";
    const fields = extractFieldsFromHtml(htmlBody || plainBody);

    console.log(plainBody);
    console.log(fields);


    const embed = {
        title: subject || "No Subject",
        description: "📬 New Cameo request received.",
        color: 0x6a0dad,
        fields,
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
