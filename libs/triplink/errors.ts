type APIError = {
	graphQLErrors?: { message: string; extensions?: { code?: string } }[];
	networkError?: unknown;
	message?: string;
};
export function errorMessage(error: unknown): string {
	if (!error || typeof error !== 'object') return 'Something went wrong!';
	const api = error as APIError;
	const graphql = api.graphQLErrors?.[0];
	if (graphql) {
		switch (graphql.extensions?.code) {
			case 'UNAUTHENTICATED':
				return 'Please login again.';
			case 'FORBIDDEN':
				return 'You do not have permission for this action.';
			case 'NOT_FOUND':
				return 'This record is unavailable.';
			case 'CONFLICT':
				return 'This record changed. Refresh and try again.';
			case 'INTERNAL_SERVER_ERROR':
				return 'Something went wrong!';
			default:
				return graphql.message;
		}
	}
	if (api.networkError) return 'Unable to reach the server. Please retry.';
	return api.message || 'Something went wrong!';
}
