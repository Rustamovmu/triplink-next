import { useMemo } from 'react';
import { ApolloClient, ApolloLink, InMemoryCache, NormalizedCacheObject, from } from '@apollo/client';
import createUploadLink from 'apollo-upload-client/public/createUploadLink.js';
import { onError } from '@apollo/client/link/error';
import { getJwtToken } from '../libs/auth/token';
let apolloClient: ApolloClient<NormalizedCacheObject> | undefined;
function createApolloClient() {
	const auth = new ApolloLink((operation, forward) => {
		const token = getJwtToken();
		operation.setContext(({ headers = {} }) => ({
			headers: {
				...headers,
				'Apollo-Require-Preflight': 'true',
				...(token && !['LOGIN', 'SIGNUP'].includes(operation.operationName)
					? { Authorization: `Bearer ${token}` }
					: {}),
			},
		}));
		return forward(operation);
	});
	const errors = onError(({ graphQLErrors, operation }) => {
		if (
			typeof window !== 'undefined' &&
			!['LOGIN', 'SIGNUP'].includes(operation.operationName) &&
			graphQLErrors?.some((error) => error.extensions?.code === 'UNAUTHENTICATED')
		) {
			window.dispatchEvent(new Event('triplink:session-invalid'));
		}
	});
	const upload = createUploadLink({ uri: process.env.REACT_APP_API_GRAPHQL_URL || 'http://localhost:3007/graphql' });
	return new ApolloClient({
		ssrMode: typeof window === 'undefined',
		link: from([errors, auth, upload]),
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
