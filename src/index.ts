import { Elysia } from "elysia";
import { parseHTML } from "linkedom";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
    throw new Error("Missing DISCORD_WEBHOOK_URL in environment");
}

export function extractFieldsFromCameoEmail(html: string): {
    subject: string;
    from: string;
    fields: { name: string; value: string; inline: boolean; }[];
} {
    const { document } = parseHTML(html);
    const subject = document.querySelector("title")?.textContent?.trim() || "Cameo";
    const from = "Cameo <cameo@m.cameo.com>";

    const fields: { name: string; value: string; inline: boolean; }[] = [];

    // Step 1: Find the <p> that follows "Request details"
    const allPs = Array.from(document.querySelectorAll("p"));
    const detailsIdx = allPs.findIndex((p) =>
        p.textContent?.toLowerCase().includes("request details")
    );

    if (detailsIdx === -1 || detailsIdx + 1 >= allPs.length) {
        return { subject, from, fields }; // bail early
    }

    const detailsParagraph = allPs[detailsIdx + 1];

    // Step 2: Read HTML from that <p>, clean & parse blocks
    const content = detailsParagraph.innerHTML
        .replace(/&nbsp;/g, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\r?\n/g, "\n")
        .trim();

    // Step 3: Match <strong>Label:</strong> Value chunks
    const fieldRegex = /<strong>([^<:]+):<\/strong>\s*\n([^<]+(?:\n(?!<strong>).+)*)/gi;

    let match: RegExpExecArray | null;
    while ((match = fieldRegex.exec(content))) {
        const rawName = match[1].trim();
        const rawValue = match[2]
            .replace(/<[^>]+>/g, "") // remove all HTML tags
            .replace(/\s+/g, " ")    // normalize whitespace
            .replace(/\\n/g, "")
            .trim();


        if (rawName && rawValue) {
            fields.push({
                name: rawName,
                value: rawValue.slice(0, 1024),
                inline: false,
            });
        }
    }

    // Step 4: Handle "Instructions" block separately
    const instructionsMatch = content.match(
        /<strong>Instructions:<\/strong>\s*\n([\s\S]*?)<strong>Privacy:/i
    );

    if (instructionsMatch) {
        const instructionsRaw = instructionsMatch[1]
            .replace(/<[^>]+>/g, "") // remove HTML tags
            .replace(/\s+/g, " ")    // normalize whitespace
            .replace(/\\n/g, "")
            .trim();

        if (instructionsRaw) {
            fields.push({
                name: "Instructions",
                value: instructionsRaw.slice(0, 1024),
                inline: false,
            });
        }
    }

    return { subject, from, fields };
}



const app = new Elysia();

app.post("/mailgun", async ({ body, set }) => {
    const html = (body as Record<string, string>)["body"];

    console.log(body);

    if (!html) {
        set.status = 400;
        return "Missing email body";
    }

    const { subject, from, fields } = extractFieldsFromCameoEmail(html);



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
