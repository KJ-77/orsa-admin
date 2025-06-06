import { Amplify } from "aws-amplify";

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId:
        process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "eu-west-3_hjGfLZ4ek",
      userPoolClientId:
        process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ||
        "28esv8q77dl3r2goi1mskl0ilb",
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: "code" as const,
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;
