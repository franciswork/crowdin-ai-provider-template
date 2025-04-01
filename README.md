# Crowdin AI Provider Template

A template project to quickly get started with custom AI providers development for Crowdin.

## Features

- Ready-to-use template for AI provider integration
- Built on top of Crowdin App Project Module
- In this example, implements the OpenAI API
- Includes settings low code UI for configuration
- Supports both local development and production deployment

## Prerequisites

- Node.js 20 or higher
- npm or yarn
- Crowdin.com or Crowdin Enterprise account

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/crowdin/crowdin-ai-provider-template.git
   cd crowdin-ai-provider-template
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Configuration

The template uses environment variables for configuration. Create a `.env` file with the following variables:

```env
PORT=3000
URL=https://your-url.ngrok.io
CROWDIN_CLIENT_ID=XXX
CROWDIN_CLIENT_SECRET=XXX
```

## Development

### Project Structure

```
├── handler.js           # Main application entry point
├── settings-form.js     # Settings UI configuration
├── db/                  # Used locally
├── logo.svg             # App logo
└── package.json         # Project dependencies and scripts
```

## Deployment

The template supports both local development and production deployment. The application can be deployed to Kubernetes or AWS Lambda.

- Local: Uses SQLite for development
- Production: Uses PostgreSQL (configure via environment variables)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please:
1. Check the [documentation](https://crowdin.github.io/app-project-module/)
2. Open an issue in this repository
3. Contact Crowdin support