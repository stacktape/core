/**
 * #### A resource for managing user authentication and authorization.
 *
 * ---
 *
 * A user pool is a fully managed identity provider that handles user sign-up, sign-in, and access control.
 * It provides a secure and scalable way to manage user identities for your applications.
 */
interface UserAuthPool {
  type: 'user-auth-pool';
  properties?: UserAuthPoolProps;
  overrides?: ResourceOverrides;
}

interface UserAuthPoolProps {
  /**
   * #### Restricts account creation to administrators only.
   *
   * ---
   *
   * If `true`, users cannot sign up themselves. New accounts must be created through an admin flow.
   */
  allowOnlyAdminsToCreateAccount?: boolean;
  /**
   * #### The number of days an unused account will be preserved before being marked as expired.
   */
  unusedAccountValidityDays?: number;
  /**
   * #### Requires users to verify their email address before they can sign in.
   */
  requireEmailVerification?: boolean;
  /**
   * #### Requires users to verify their phone number before they can sign in.
   */
  requirePhoneNumberVerification?: boolean;
  /**
   * #### Enables the Cognito Hosted UI for this user pool.
   *
   * ---
   *
   * The Hosted UI provides a pre-built, customizable sign-up and sign-in experience for your users.
   *
   * @default false
   */
  enableHostedUi?: boolean;
  /**
   * #### The domain prefix for the Hosted UI.
   *
   * ---
   *
   * This will be part of the URL for your Hosted UI. For example, `https://<your-prefix>.auth.<region>.amazoncognito.com`.
   */
  hostedUiDomainPrefix?: string;
  /**
   * #### Custom CSS to apply to the Hosted UI.
   *
   * ---
   *
   * This allows you to style the Hosted UI to match your application's branding.
   */
  hostedUiCSS?: string;
  /**
   * #### A set of Lambda functions that are triggered by user pool events.
   *
   * ---
   *
   * Hooks allow you to customize the authentication flow. For example, you can run custom logic before a user signs up, after they authenticate, or to define custom authentication challenges.
   * For more details, see the [AWS documentation on Lambda triggers for Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html).
   */
  hooks?: UserPoolHooks;
  /**
   * #### Configures the email settings for messages sent by the user pool.
   */
  emailConfiguration?: EmailConfiguration;
  /**
   * #### Configures the invitation message for new users created by an administrator.
   */
  inviteMessageConfig?: InviteMessageConfig;
  /**
   * #### The method for verifying a user's identity.
   *
   * ---
   *
   * - `none`: No verification is required.
   * - `email-link`: The user receives an email with a verification link.
   * - `email-code`: The user receives an email with a verification code.
   * - `sms`: The user receives an SMS with a verification code.
   */
  userVerificationType?: UserVerificationType;
  /**
   * #### Configures the message for user verification.
   */
  userVerificationMessageConfig?: UserVerificationMessageConfig;
  /**
   * #### Configures Multi-Factor Authentication (MFA) for the user pool.
   */
  mfaConfiguration?: MfaConfiguration;
  /**
   * #### Defines the password requirements for users.
   *
   * ---
   *
   * This applies to users who sign up directly with the user pool.
   */
  passwordPolicy?: PasswordPolicy;
  schema?: AttributeSchema[];
  /**
   * #### Allows users to sign in using their phone number as their username.
   *
   * @default true
   */
  allowPhoneNumberAsUserName?: boolean;
  /**
   * #### Allows users to sign in using their email address as their username.
   *
   * @default true
   */
  allowEmailAsUserName?: boolean;
  /**
   * #### The duration (in seconds) until an access token expires.
   *
   * ---
   *
   * For more details on Cognito tokens, see the [AWS documentation on user pool tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html).
   */
  accessTokenValiditySeconds?: number;
  /**
   * #### The duration (in seconds) until an identity token expires.
   *
   * ---
   *
   * For more details on Cognito tokens, see the [AWS documentation on user pool tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html).
   */
  idTokenValiditySeconds?: number;
  /**
   * #### The duration (in days) until a refresh token expires.
   *
   * ---
   *
   * For more details on Cognito tokens, see the [AWS documentation on user pool tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html).
   */
  refreshTokenValidityDays?: number;
  /**
   * #### The OAuth 2.0 flows allowed for this user pool.
   *
   * ---
   *
   * For an overview of OAuth flows, see this [AWS blog post](https://aws.amazon.com/blogs/mobile/understanding-amazon-cognito-user-pool-oauth-2-0-grants/).
   */
  allowedOAuthFlows?: AllowedOauthFlow[];
  /**
   * #### The OAuth 2.0 scopes allowed for this user pool.
   */
  allowedOAuthScopes?: string[];
  /**
   * #### The callback URL(s) where users are redirected after successful authentication.
   */
  callbackURLs?: string[];
  /**
   * #### The URL(s) where users are redirected after logging out.
   */
  logoutURLs?: string[];
  /**
   * #### Configures integration with external identity providers (e.g., Google, Facebook, SAML).
   */
  identityProviders?: IdentityProvider[];
  /**
   * #### The name of a `web-app-firewall` to protect the user pool.
   *
   * ---
   *
   * A web application firewall (WAF) can help protect your user pool from common web-based attacks.
   * For more information, see the [Stacktape documentation on web application firewalls](https://docs.stacktape.com/security-resources/web-app-firewalls/).
   */
  useFirewall?: string;
  /**
   * #### Generates a secret for the user pool's app client.
   *
   * ---
   *
   * This adds an extra layer of security for server-to-server interactions, where the secret can be stored securely.
   *
   * @default false
   */
  generateClientSecret?: boolean;
  /**
   * #### Requires users to authenticate exclusively through external identity providers.
   *
   * ---
   *
   * If `true`, the user pool's built-in sign-up and sign-in mechanisms are disabled. Users must authenticate through a configured external provider like Google, Facebook, or SAML.
   *
   * @default false
   */
  allowOnlyExternalIdentityProviders?: boolean;
}

type AllowedOauthFlow = 'code' | 'implicit' | 'client_credentials';

type UserVerificationType = 'email-link' | 'email-code' | 'sms' | 'none';

interface UserPoolHooks {
  customMessage?: string;
  postAuthentication?: string;
  postConfirmation?: string;
  preAuthentication?: string;
  preSignUp?: string;
  preTokenGeneration?: string;
  userMigration?: string;
  createAuthChallenge?: string;
  defineAuthChallenge?: string;
  verifyAuthChallengeResponse?: string;
}

interface EmailConfiguration {
  sesAddressArn?: string;
  from?: string;
  replyToEmailAddress?: string;
}

interface InviteMessageConfig {
  emailMessage?: string;
  emailSubject?: string;
  smsMessage?: string;
}

interface UserVerificationMessageConfig {
  emailMessageUsingCode?: string;
  emailMessageUsingLink?: string;
  emailSubjectUsingCode?: string;
  emailSubjectUsingLink?: string;
  smsMessage?: string;
}

interface AttributeSchema {
  name?: string;
  attributeDataType?: string;
  developerOnlyAttribute?: boolean;
  mutable?: boolean;
  required?: boolean;
  numberMaxValue?: number;
  numberMinValue?: number;
  stringMaxLength?: number;
  stringMinLength?: number;
}

interface PasswordPolicy {
  minimumLength?: number;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSymbols?: boolean;
  requireUppercase?: boolean;
  temporaryPasswordValidityDays?: number;
}

interface MfaConfiguration {
  status?: 'ON' | 'OFF' | 'OPTIONAL';
  enabledTypes?: ('SMS' | 'SOFTWARE_TOKEN')[];
}

interface IdentityProvider {
  type: 'Facebook' | 'Google' | 'LoginWithAmazon' | 'OIDC' | 'SAML' | 'SignInWithApple';
  clientId: string;
  clientSecret: string;
  attributeMapping?: { [awsAttributeName: string]: string };
  authorizeScopes?: string[];
  providerDetails?: Record<string, any>;
}

type StpUserAuthPool = UserAuthPool['properties'] & {
  name: string;
  type: UserAuthPool['type'];
  configParentResourceType: UserAuthPool['type'];
  nameChain: string[];
};

interface CognitoAuthorizerProperties {
  userPoolName: string;
  identitySources?: string[];
}

interface CognitoAuthorizer {
  type: 'cognito';
  properties: CognitoAuthorizerProperties;
}

interface LambdaAuthorizerProperties {
  functionName: string;
  iamResponse?: boolean;
  identitySources?: string[];
  cacheResultSeconds?: number;
}

interface LambdaAuthorizer {
  type: 'lambda';
  properties: LambdaAuthorizerProperties;
}

type StpAuthorizer = CognitoAuthorizer | LambdaAuthorizer;

type UserPoolReferencableParam = 'id' | 'clientId' | 'arn' | 'domain' | 'clientSecret' | 'providerUrl';
