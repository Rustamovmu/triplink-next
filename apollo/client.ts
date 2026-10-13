import { useMemo } from 'react';
import {
	ApolloClient,
	ApolloLink,
	InMemoryCache,
	NormalizedCacheObject,
	Observable,
	FetchResult,
} from '@apollo/client';
import createUploadLink from 'apollo-upload-client/public/createUploadLink.js';
import { getJwtToken, tokenFresh, tokenIdentity } from '../libs/auth/token';
import { clearAuthentication, credentialFetch, ensureAccessToken, refreshAccessToken } from '../libs/auth/runtime';
let apolloClient: ApolloClient<NormalizedCacheObject> | undefined;
function createApolloClient() {
	const auth = new ApolloLink(
		(operation, forward) =>
			new Observable((observer) => {
				let cancelled = false;
				let subscription: { unsubscribe(): void } | undefined;
				const entry = ['LOGIN', 'SIGNUP'].includes(operation.operationName);
				const send = async (retried = false): Promise<void> => {
					try {
						const token = !entry && getJwtToken() ? await ensureAccessToken() : '';
						if (cancelled || operation.getContext().fetchOptions?.signal?.aborted) return;
						operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => {
							const { Authorization: _old, authorization: _lower, ...rest } = headers;
							return {
								headers: {
									...rest,
									'Apollo-Require-Preflight': 'true',
									...(token ? { Authorization: `Bearer ${token}` } : {}),
								},
							};
						});
						const expired = (result: FetchResult) =>
							!!result.errors?.length &&
							result.errors.every((error) => error.extensions?.authCode === 'ACCESS_TOKEN_EXPIRED');
						const fail = (result: FetchResult) => {
							if (
								!entry &&
								!!token &&
								tokenIdentity(getJwtToken()) === tokenIdentity(token) &&
								result.errors?.some((error) =>
									[
										'UNAUTHORIZED',
										'SESSION_REVOKED',
										'REFRESH_TOKEN_EXPIRED',
										'SESSION_ABSOLUTE_EXPIRATION',
										'REFRESH_TOKEN_REUSED',
										'ACCOUNT_UNAVAILABLE',
									].includes(String(error.extensions?.authCode)),
								)
							)
								clearAuthentication();
						};
						subscription = forward(operation).subscribe({
							next: (result) => {
								if (
									!entry &&
									!retried &&
									expired(result) &&
									(!result.data || Object.values(result.data).every((value) => value == null))
								) {
									if (tokenIdentity(getJwtToken()) !== tokenIdentity(token)) {
										observer.error(new Error('Authentication changed. Please retry.'));
										return;
									}
									void (
										getJwtToken() !== token && tokenFresh(getJwtToken())
											? Promise.resolve(getJwtToken())
											: refreshAccessToken(true)
									)
										.then(() => {
											if (!cancelled) {
												if (tokenIdentity(getJwtToken()) !== tokenIdentity(token))
													throw new Error('Authentication changed. Please retry.');
												return send(true);
											}
										})
										.catch((error) => {
											if (!cancelled) observer.error(error);
										});
									return;
								}
								fail(result);
								observer.next(result);
								observer.complete();
							},
							error: (error) => observer.error(error),
						});
					} catch (error) {
						if (!cancelled) observer.error(error);
					}
				};
				void send();
				return () => {
					cancelled = true;
					subscription?.unsubscribe();
				};
			}),
	);
	const upload = createUploadLink({
		uri: process.env.REACT_APP_API_GRAPHQL_URL || 'http://localhost:3007/graphql',
		fetch: (url, options) => {
			let name = '';
			try {
				if (typeof options?.body === 'string') name = JSON.parse(options.body).operationName;
			} catch {
				/* Multipart requests keep their existing transport. */
			}
			return ['LOGIN', 'SIGNUP'].includes(name) && typeof window !== 'undefined'
				? credentialFetch(String(url), options ?? {}, 'login')
				: fetch(url, { ...options, credentials: 'omit' });
		},
	});
	return new ApolloClient({
		ssrMode: typeof window === 'undefined',
		link: auth.concat(upload),
		cache: new InMemoryCache({ typePolicies: { Member: { keyFields: ['_id'] }, Tour: { keyFields: ['_id'] } } }),
	});
}
export function initializeApollo(initialState: NormalizedCacheObject | null = null) {
	const client = apolloClient ?? createApolloClient();
	if (initialState) client.cache.restore(initialState);
	if (typeof window !== 'undefined') apolloClient = client;
	return client;
}
export function useApollo(initialState: NormalizedCacheObject | null) {
	return useMemo(() => initializeApollo(initialState), [initialState]);
}
