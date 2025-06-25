import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { useAuth } from "react-oidc-context";

const REGION = import.meta.env.VITE_COGNITO_REGION;
const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;

export function createDynamoDBClient(idToken) {
    const credentials = fromCognitoIdentityPool({
        identityPoolId: IDENTITY_POOL_ID,
        clientConfig: { region: REGION },
        logins: {
            [`cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`]: idToken,  // ✅ FIXED format
        },
    });

    return new DynamoDBClient({
        region: REGION,
        credentials,
    });
}
