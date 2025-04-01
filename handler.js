const crowdinModule = require("@crowdin/app-project-module"); // Crowdin App development framework
const serverless = require("serverless-http"); // this is to make the code work with AWS Lambda
const OpenAI = require("openai");

const express = crowdinModule.express; // The Express instance provided by the Crowdin framework implements some API for best application performance

const app = express();
app.use(express.json());

const configuration = {
    baseUrl: process.env?.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.URL,
    // Required properties (baseUrl, port, clientId, clientSecret) are automatically loaded from .env file (can also be defined here in the code)
    // For more details about configuration options, refer to the Crowdin App development framework documentation:
    // https://crowdin.github.io/app-project-module/introduction/#basic-configuration
    name: "Generic AI Integration",
    identifier: "generic-ai",
    description: "An AI integration for Crowdin",
    imagePath: __dirname + "/logo.svg", // app's logo
    // sqlite would be used locally, postgres would be used in production
    ...(process.env.DB_HOST && {
        postgreConfig: {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
        },
    }),
    // this sample app implements Crowdin AI Provider interface
    // https://crowdin.github.io/app-project-module/tools/ai-provider/
    // it could provide UI and should provide the following methods two methods: getModelsList and chatCompletions
    aiProvider: {
        settingsUiModule: require("./settings-form").getForm(), // low code UI for the integration settings
        getModelsList: async ({ client, context }) => {
            // get app's settings
            // https://crowdin.github.io/app-project-module/storage/#app-metadata
            const formData = await crowdinApp.getMetadata(
                `form-data-${context.jwtPayload.context.organization_id}`,
            );

            const aiClient = new OpenAI({ apiKey: formData.key });

            // fetch the list of models
            const modelsResponse = await aiClient.models.list();
            return (modelsResponse?.data || [])
                .filter((model) => model.id)
                .map((model) => ({
                    //TODO: parse from model if available
                    id: model.id.trim(),
                    supportsJsonMode: true,
                    supportsFunctionCalling: true,
                    supportsStreaming: true,
                    supportsVision: true,
                    contextWindowLimit: 4096,
                }));
        },
        chatCompletions: async ({
            messages,
            model,
            action,
            responseFormat,
            client,
            context,
            req,
        }) => {
            const formData = await crowdinApp.getMetadata(
                `form-data-${context.jwtPayload.context.organization_id}`,
            );

            const aiClient = new OpenAI({ apiKey: formData.key });

            const response = await aiClient.chat.completions.create({
                model,
                messages,
            });

            // learn how to stream the response https://crowdin.github.io/app-project-module/tools/ai-provider/#response-streaming
            return [
                {
                    content: response?.choices?.[0]?.message?.content || "",
                },
            ];
        },
    },
};

// This is optional, as we want to validate the credentials before saving them.
// If you don't need to validate the credentials, you can remove this endpoint, the low code UI would save the credentials on form submission.
app.post(
    "/form",
    crowdinModule.postRequestCredentialsMasker(
        require("./settings-form").getForm(),
    ), // mask the credentials
    async (req, res) => {
        const { client, context } = await crowdinApp.establishCrowdinConnection(
            req.query.jwtToken,
        );
        const formData = req.body.data;

        try {
            const aiClient = new OpenAI({ apiKey: formData.key });

            // Quick check to see if the credentials are valid
            await aiClient.chat.completions.create({
                model: "gpt-3.5-turbo", // any valid model name
                messages: [{ role: "user", content: "Say hello" }],
            });

            // Store app's configuration if successful
            await crowdinApp.saveMetadata(
                `form-data-${context.jwtPayload.context.organization_id}`,
                formData,
            );
            res.status(200).send({
                message:
                    "Credentials are valid. The integration is ready to use.",
            });
        } catch (e) {
            console.error(e);
            res.status(400).send({
                message: `Credentials are invalid. Response: ${e.response?.data?.error?.message || e.message || "Invalid credentials"}`,
            });
        }
    },
);

// Attach Crowdin app endpoints
const crowdinApp = crowdinModule.addCrowdinEndpoints(app, configuration);

// Export for serverless or run express locally
if (process.env.DB_HOST) {
    module.exports.handler = serverless(app);
} else {
    app.listen(process.env.PORT || 3000, () =>
        console.info(
            `Crowdin app listening on port ${process.env.PORT || 3000}`,
        ),
    );
}
