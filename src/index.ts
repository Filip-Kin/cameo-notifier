import { Elysia } from "elysia";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
    throw new Error("Missing DISCORD_WEBHOOK_URL in environment");
}
function extractFieldsFromHtml(html: string): {
    subject: string;
    from: string;
    fields: { name: string; value: string; inline: boolean; }[];
} {
    const text = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?[^>]+>/gi, "") // Remove HTML tags
        .replace(/=E2=80=99/g, "’")
        .replace(/=E2=80=9C/g, "“")
        .replace(/=E2=80=9D/g, "”")
        .replace(/=20/g, " ")
        .replace(/=3D/g, "=")
        .replace(/=\r?\n/g, "")
        .replace(/\r/g, "")
        .trim();

    const subjectMatch = text.match(/Subject:\s*(.+)/i);
    const fromMatch = text.match(/From:\s*(.+)/i);

    const fieldRegex = /(?:^|\n)([^\n:]{1,64}):\n([^\n][\s\S]*?)(?=\n[A-Za-z ]+:\n|$)/g;

    const fields: { name: string; value: string; inline: boolean; }[] = [];

    let match;
    while ((match = fieldRegex.exec(text)) !== null) {
        const name = match[1].trim().replace(/\s+/g, " ");
        const value = match[2].trim();
        if (name && value && name.length <= 256 && value.length <= 1024) {
            fields.push({ name, value, inline: false });
        }
    }

    return {
        subject: subjectMatch?.[1] ?? "No Subject",
        from: fromMatch?.[1] ?? "Unknown",
        fields,
    };
}


const app = new Elysia();

app.post("/mailgun", async ({ body, set }) => {
    const html = (body as Record<string, string>)["body"];

    console.log(body);

    if (!html) {
        set.status = 400;
        return "Missing email body";
    }

    const { subject, from, fields } = extractFieldsFromHtml(html);


    console.log("Parsed email:", { subject, from, fields });

    const embed = {
        title: subject,
        description: "📬 New Cameo request received.",
        color: 0x6a0dad,
        fields: fields.length ? fields : [{ name: "From", value: from, inline: true }],
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
        return "Discord error";
    }

    return "OK";
});

app.listen(3000, () => {
    console.log("Listening on http://localhost:3000");
});
