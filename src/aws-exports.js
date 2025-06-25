// src/aws-exports.js
const awsExports = {
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
            userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
            loginWith: {
                oauth: {
                    domain: import.meta.env.VITE_COGNITO_DOMAIN,
                    scopes: ['openid', 'email', 'phone', 'profile'],
                    redirectSignIn: [import.meta.env.VITE_REDIRECT_URI],
                    redirectSignOut: [import.meta.env.VITE_LOGOUT_URI],
                    responseType: 'code',
                }
            }
        }
    }
};
export default awsExports;
