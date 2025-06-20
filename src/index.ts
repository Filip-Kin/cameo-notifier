import { Elysia } from "elysia";
import { parseHTML } from "linkedom";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
    throw new Error("Missing DISCORD_WEBHOOK_URL in environment");
}

function extractFieldsFromCameoEmail(html: string): {
    subject: string;
    from: string;
    fields: { name: string; value: string; inline: boolean; }[];
} {
    const { document } = parseHTML(html);

    // Fallbacks
    const subject = document.querySelector("title")?.textContent?.trim() || "No Subject";
    const fromMeta = document.querySelector("meta[name='from']")?.getAttribute("content") || "Cameo";

    const requestDetailsSection = Array.from(document.querySelectorAll("p, div"))
        .find((el) => el.textContent?.includes("Request details"));

    const fields: { name: string; value: string; inline: boolean; }[] = [];

    if (requestDetailsSection) {
        // Traverse siblings after "Request details"
        let node = requestDetailsSection.nextElementSibling;
        while (node && fields.length < 20) {
            const labelMatch = node.innerHTML.match(/<strong>(.*?)<\/strong><br\s*\/?>\s*(.*?)<br\s*\/?>?/i);
            if (labelMatch) {
                const name = labelMatch[1].replace(/:$/, "").trim();
                const value = labelMatch[2].trim();
                if (name && value && value !== "&nbsp;" && value !== "") {
                    fields.push({ name, value, inline: false });
                }
            } else if (node.innerText.includes("Instructions")) {
                const raw = node.innerText.trim().replace(/\s+/g, " ");
                fields.push({
                    name: "Instructions",
                    value: raw.slice(0, 1024),
                    inline: false,
                });
            }

            node = node.nextElementSibling;
        }
    }

    return {
        subject,
        from: fromMeta,
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
