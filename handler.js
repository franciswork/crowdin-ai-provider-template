const crowdinModule = require("@crowdin/app-project-module");
const serverless = require("serverless-http");
const axios = require("axios");
const express = crowdinModule.express;

const app = express();
app.use(express.json());

const settingsForm = require("./settings-form").getForm();

// Setup base configuration object
const configuration = {
    baseUrl: process.env?.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.URL,
    name: "Widn AI",
    identifier: "widn-ai",
    description: "Your AI Language Assistant for Crowdin",
    imagePath: "/logo.svg", // Assumes it's in /public/
    ...(process.env.DB_HOST && {
        postgreConfig: {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
        },
    }),
};

// Attach Crowdin routes
const crowdinApp = crowdinModule.addCrowdinEndpoints(app, configuration);

// Add AI provider methods after crowdinApp is available
configuration.aiProvider = {
    settingsUiModule: settingsForm,

    getModelsList: async ({ context }) => {
        const formData = await crowdinApp.getMetadata(
            `form-data-${context.jwtPayload.context.organization_id}`,
        );

        return [
            {
                id: "sugarloaf",
                supportsJsonMode: false,
                supportsFunctionCalling: false,
                supportsStreaming: true,
                supportsVision: false,
                contextWindowLimit: 4096,
            },
            {
                id: "vesuvius",
                supportsJsonMode: false,
                supportsFunctionCalling: false,
                supportsStreaming: true,
                supportsVision: false,
                contextWindowLimit: 4096,
            },
        ];
    },

    chatCompletions: async function* ({ messages, model, action, context }) {
        const formData = await crowdinApp.getMetadata(
            `form-data-${context.jwtPayload.context.organization_id}`,
        );

        try {
            const response = await axios.post(
                "https://api.widn.ai/completions",
                {
                    model,
                    messages,
                    temperature: action?.temperature ?? 0.7,
                    max_tokens: action?.max_tokens ?? 150,
                    top_p: action?.top_p ?? 0.9,
                    min_p: action?.min_p ?? 0.1,
                    stream: true,
                },
                {
                    headers: {
                        Authorization: `Bearer ${formData.key}`,
                        "Content-Type": "application/json",
                    },
                    responseType: "stream",
                },
            );

            const stream = response.data;
            let buffer = "";

            for await (const chunk of stream) {
                buffer += chunk.toString();
                const lines = buffer.split("\n").filter(Boolean);

                for (const line of lines) {
                    if (line === "data: [DONE]") return;

                    try {
                        const json = JSON.parse(line.replace(/^data: /, ""));
                        const delta = json?.delta?.content;
                        if (delta) yield { content: delta };
                    } catch (e) {
                        console.error("Failed to parse stream chunk", e);
                    }
                }
            }
        } catch (err) {
            console.error("Streaming error:", err);
            yield { content: "[Error streaming response]" };
        }
    },
};

// Credentials check and form submission
app.post(
    "/form",
    crowdinModule.postRequestCredentialsMasker(settingsForm),
    async (req, res) => {
        try {
            const { client, context } = await crowdinApp.establishCrowdinConnection(
                req.query.jwtToken,
            );
            const formData = req.body.data;

            // Test request to validate credentials
            const response = await axios.post(
                "https://api.widn.ai/completions",
                {
                    model: "vesuvius",
                    messages: [{ role: "user", content: "Say hello" }],
                    temperature: 0.2,
                    max_tokens: 50,
                    stream: false,
                },
                {
                    headers: {
                        Authorization: `Bearer ${formData.key}`,
                        "Content-Type": "application/json",
                    },
                },
            );

            await crowdinApp.saveMetadata(
                `form-data-${context.jwtPayload.context.organization_id}`,
                formData,
            );

            res.status(200).send({
                message: "Credentials are valid. The integration is ready to use.",
            });
        } catch (e) {
            console.error("Form validation error:", e);
            res.status(400).send({
                message: `Credentials are invalid. Response: ${
                    e.response?.data?.error || e.message || "Invalid credentials"
                }`,
            });
        }
    },
);

// Export for Vercel
module.exports = {
    handler: serverless(app),
};
