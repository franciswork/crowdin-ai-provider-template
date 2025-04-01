// https://crowdin.github.io/app-project-module/user-interface/
// refer to the documentation for more information about the low code UI in Crowdin Apps

exports.getForm = () => {
    return {
        maskPasswords: true,
        environments: ['crowdin-enterprise', 'crowdin'],
        formSchema: {
            title: "AI Integration Setup",
            description: "Configure the AI integration credentials.",
            type: "object",
            required: ["key"],
            properties: {
                key: {
                    type: "string",
                    title: "API Key",
                    description: "Enter your AI API key here.",
                },
            }
        },
        formUiSchema: {
            key: {
                "ui:widget": "password",
            },
        },
        formPostDataUrl: '/form',
    };
};