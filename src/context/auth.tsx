import { CollectionModel } from 'pocketbase';
import * as React from 'react';
import { createContext } from 'react';
import { useClientContext } from '../hooks/useClientContext';
import { StorageService } from '../service/Storage';

export type AuthProviderInfo = {
  name: string;
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  authUrl: string;
};

export type RegisterWithEmailType = (email: string, password: string) => Promise<void>;
export type SignInWithEmailType = (email: string, password: string) => Promise<void>;
export type SignInWithProviderType = (provider: string) => Promise<void>;
export type SubmitProviderResultType = (url: string) => Promise<void>;
export type SignOutType = () => void;
export type SendPasswordResetEmailType = (email: string) => Promise<void>;
export type SendEmailVerificationType = (email: string) => Promise<void>;
export type UpdateProfileType = (id: string, record: {}) => Promise<void>;
export type UpdateEmailType = (email: string) => Promise<void>;
export type DeleteUserType = (id: string) => Promise<void>;

export interface AuthActions {
  registerWithEmail: RegisterWithEmailType;
  signInWithEmail: SignInWithEmailType;
  signInWithProvider: SignInWithProviderType;
  submitProviderResult: SubmitProviderResultType;
  signOut: SignOutType;
  sendPasswordResetEmail: SendPasswordResetEmailType;
  sendEmailVerification: SendEmailVerificationType;
  updateProfile: UpdateProfileType;
  updateEmail: UpdateEmailType;
  deleteUser: DeleteUserType;
}

export const AuthContext = createContext<AuthActions>({} as AuthActions);

export type AuthProviderProps = {
  children: React.ReactNode;
  webRedirectUrl: string;
  mobileRedirectUrl: string;
  openURL: (url: string) => Promise<void>;
};

export const AuthProvider = (props: AuthProviderProps) => {
  const client = useClientContext();
  const [authProviders, setAuthProviders] = React.useState<AuthProviderInfo[]>();

  const actions: AuthActions = {
    registerWithEmail: async (email, password) => {
      await client?.collection('users').create({
        email: email,
        password: password,
        passwordConfirm: password,
      });
    },
    signInWithEmail: async (email: string, password: string) => {
      await client?.collection('users').authWithPassword(email, password);
    },
    signInWithProvider: async (provider: string) => {
      const authProvider = authProviders?.find((p) => p.name === provider);
      const redirectURL =
        typeof document !== 'undefined' ? props.webRedirectUrl : props.mobileRedirectUrl;
      const url = authProvider?.authUrl + redirectURL;
      await StorageService.set('provider', JSON.stringify(authProviders));
      await props.openURL(url);
    },
    submitProviderResult: async (url: string) => {
      const params = new URLSearchParams(url.split('?')[1]);
      const code = params.get('code');
      const state = params.get('state');
      const providersString = await StorageService.get('provider');
      if (providersString) {
        const providers = JSON.parse(providersString) as AuthProviderInfo[];
        const authProvider = providers?.find((p) => p.state === state);
        if (authProvider && code) {
          await client
            ?.collection('users')
            .authWithOAuth2(
              authProvider.name,
              code,
              authProvider.codeVerifier,
              typeof document !== 'undefined' ? props.webRedirectUrl : props.mobileRedirectUrl
            );
        }
      }
    },
    signOut: () => {
      client?.authStore.clear();
    },
    sendPasswordResetEmail: async (email: string) => {
      await client?.collection('users').requestPasswordReset(email);
    },
    sendEmailVerification: async (email: string) => {
      await client?.collection('users').requestVerification(email);
    },
    updateProfile: async (id: string, record: {}) => {
      await client?.collection('profiles').update(id, record);
    },
    updateEmail: async (email: string) => {
      await client?.collection('users').requestEmailChange(email);
    },
    deleteUser: async (id: string) => {
      await client?.collection('users').delete(id);
    },
  };

  React.useEffect(() => {
    (async () => {
      const methods = await client?.collection('users').listAuthMethods();
      setAuthProviders(methods?.authProviders);
    })();
  }, [props.webRedirectUrl, props.mobileRedirectUrl]);

  return <AuthContext.Provider value={actions}>{props.children}</AuthContext.Provider>;
};
