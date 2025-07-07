require("dotenv").config(); // Load env variables from .env
const crowdinModule = require("@crowdin/app-project-module");
const serverless = require("serverless-http");
const axios = require("axios");
const express = crowdinModule.express;
const readline = require('readline');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.get('/manifest.json', (req, res) => {
    console.log("Serving manifest...");
    res.sendFile(__dirname + '/manifest.json');
  });
const settingsForm = require("./settings-form").getForm();

// Import RateLimitError for Crowdin AI Provider rate limit handling
let RateLimitError;
try {
  RateLimitError = require('@crowdin/app-project-module/out/modules/ai-provider/util').RateLimitError;
} catch (e) {
  // fallback if not available
  RateLimitError = null;
}

// Helper to detect rate limit errors
function isRateLimitError(err) {
  return (
    err?.response?.status === 429 ||
    err?.status === 429 ||
    err?.code === 429
  );
}

const configuration = {
  // baseUrl logic: Uses REPLIT_DEV_DOMAIN if set, otherwise falls back to process.env.URL or localhost.
  // This supports both local and cloud environments. Adjust as needed for new environments.
  baseUrl: process.env?.REPLIT_DEV_DOMAIN || "http://localhost:3000"
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.URL || "http://localhost:3000",
  clientId: process.env.CROWDIN_CLIENT_ID,
  clientSecret: process.env.CROWDIN_CLIENT_SECRET,
  name: "Widn AI",
  identifier: "widn-ai",
  description: "Your AI Language Assistant for Crowdin",
  imagePath: __dirname + "/"+ "favicon-48x48.png",
  ...(process.env.DB_HOST && {
    postgreConfig: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    },
  }),
  aiProvider: {
    
    settingsUiModule: settingsForm,
     uiPath: __dirname + '/' + 'public',

    getModelsList: async ({ context }) => {
      try {
        const formData = await crowdinApp.getMetadata(
          `form-data-${context.jwtPayload.context.organization_id}`
        );
        return [
          {
            id: "sugarloaf",
            supportsStreaming: true,
            supportsJsonMode: false,
            supportsFunctionCalling: false,
            supportsVision: false,
            contextWindowLimit: 8192,
          },
          {
            id: "vesuvius",
            supportsStreaming: true,
            supportsJsonMode: false,
            supportsFunctionCalling: false,
            supportsVision: false,
            contextWindowLimit: 4096,
          },
        ];
      } catch (err) {
        if (isRateLimitError(err)) {
          if (RateLimitError) {
            throw new RateLimitError({ error: err, message: 'You have reached the rate limit.' });
          } else {
            throw { status: 429, message: 'You have reached the rate limit.' };
          }
        }
        console.error("❌ getModelsList error:", err.response?.data || err.message);
        // Return empty array if error, to avoid Crowdin issues
        return [];
      }
    },
    chatCompletions: async ({
      messages,
      model,
      action,
      responseFormat,
      client,
      context,
      req,
      isStream,
      sendEvent
    }) => {
      try {
        const formData = await crowdinApp.getMetadata(
          `form-data-${context.jwtPayload.context.organization_id}`,
        );

        if (isStream && sendEvent) {
          // Use axios to stream from Widn.ai
          const response = await axios.post(
            "https://api.widn.ai/v1/chat/completions",
            { model, messages, stream: true },
            {
              headers: {
                "X-API-KEY": formData.key,
                "Content-Type": "application/json",
              },
              responseType: 'stream',
            }
          );

          // Use readline to process each line (JSON object) from the stream
          const rl = readline.createInterface({
            input: response.data,
            crlfDelay: Infinity,
          });

          for await (let line of rl) {
            line = line.trim();
            if (!line) continue;
            // Remove 'data:' prefix if present
            if (line.startsWith('data:')) line = line.replace(/^data:\s*/, '');
            if (line === '[DONE]') break;
            console.log('Widn.ai stream line:', line); // Debug
            try {
              const parsed = JSON.parse(line);
              // Widn.ai streams deltas in choices[0].delta.content or choices[0].message.content
              const content =
                parsed?.choices?.[0]?.delta?.content ||
                parsed?.choices?.[0]?.message?.content ||
                '';
              if (content) {
                await sendEvent({ content, role: 'assistant' });
              }
            } catch (e) {
              // Ignore lines that are not valid JSON
            }
          }
          return;
        }

        // Non-streaming (regular) response
        const response = await axios.post(
          "https://api.widn.ai/v1/chat/completions",
          { model, messages },
          {
            headers: {
              "X-API-KEY": formData.key,
              "Content-Type": "application/json",
            },
          }
        );

        return [
          {
            content: response?.data?.choices?.[0]?.message?.content || "",
          },
        ];
      } catch (err) {
        if (isRateLimitError(err)) {
          if (RateLimitError) {
            throw new RateLimitError({ error: err, message: 'You have reached the rate limit.' });
          } else {
            throw { status: 429, message: 'You have reached the rate limit.' };
          }
        }
        console.error("❌ chatCompletions error:", err.response?.data || err.message);
        return [
          {
            content: "[Error generating response from AI provider.]",
          },
        ];
      }
    }
     
  }
};

  
const crowdinApp = crowdinModule.addCrowdinEndpoints(app, configuration);

// Helper for consistent error responses in Express routes.
// Use this in all new routes for DRY and maintainable error handling.
function handleError(res, err, userMessage = "Internal server error.", status = 500) {
  console.error(err.response?.data || err.message || err);
  res.status(status).json({ error: userMessage });
}

// Credential validation
app.post(
  "/form",
  crowdinModule.postRequestCredentialsMasker(settingsForm),
  async (req, res) => {
    try {
      const { client, context } =
        await crowdinApp.establishCrowdinConnection(req.query.jwtToken);
      const formData = req.body.data;

      const response = await axios.post(
        "https://api.widn.ai/v1/chat/completions",
        {
          model: "vesuvius",
          messages: [{ role: "user", content: "Say hello" }],
          temperature: 0.2,
          max_tokens: 50,
          stream: false,
        },
        {
          headers: {
            "X-API-KEY": `${formData.key}`,
            "Content-Type": "application/json",
          },
        }
      );

      await crowdinApp.saveMetadata(
        `form-data-${context.jwtPayload.context.organization_id}`,
        formData
      );
      console.log("🔑 Using API key:", formData.key);

      res.status(200).send({
        message: "Credentials are valid. The integration is ready to use.",
      });
    } catch (e) {
      handleError(res, e, `Credentials are invalid. Response: ${e.response?.data?.error || e.message || "Invalid credentials"}`, 400);
    }
  }
);

// Serverless & Local
module.exports = {
  handler: serverless(app),
};
app.get('/', (req, res) => {
    res.send('✅ Crowdin AI Integration is running locally.');
  });

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () =>
    console.log(`🚀 Local server running at http://localhost:${PORT}`)
  );
  
}

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

