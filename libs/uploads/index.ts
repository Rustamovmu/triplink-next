import { getJwtToken, tokenIdentity } from '../auth/token';
import { ensureAccessToken, refreshAccessToken, clearAuthentication } from '../auth/runtime';
export async function uploadImages(files: File[], target: 'member' | 'tour' | 'article'): Promise<string[]> {
	if (!files.length || files.length > 10) throw new Error('Select 1–10 images.');
	if (
		files.some(
			(file) =>
				file.size > 15000000 || !/\.(jpe?g|png)$/i.test(file.name) || !['image/jpeg', 'image/png'].includes(file.type),
		)
	)
		throw new Error('Use JPEG/PNG images up to 15,000,000 bytes each.');
	let token = await ensureAccessToken();
	if (!token) throw new Error('Please login first.');
	const form = new FormData();
	form.append(
		'operations',
		JSON.stringify({
			query:
				'mutation UploadImages($files: [Upload!]!, $target: String!) { imagesUploader(files: $files, target: $target) }',
			variables: { files: files.map(() => null), target },
		}),
	);
	form.append(
		'map',
		JSON.stringify(Object.fromEntries(files.map((_, index) => [String(index), [`variables.files.${index}`]]))),
	);
	files.forEach((file, index) => form.append(String(index), file));
	const send = () =>
		fetch(process.env.REACT_APP_API_GRAPHQL_URL || 'http://localhost:3007/graphql', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Apollo-Require-Preflight': 'true' },
			body: form,
		});
	let response = await send();
	let result: {
		data?: { imagesUploader: string[] };
		errors?: { message: string; extensions?: { code?: string; authCode?: string } }[];
	} = await response.json();
	if (result.errors?.length && result.errors.every((error) => error.extensions?.authCode === 'ACCESS_TOKEN_EXPIRED')) {
		if (tokenIdentity(getJwtToken()) !== tokenIdentity(token)) throw new Error('Authentication changed. Please retry.');
		token = getJwtToken() !== token ? getJwtToken() : await refreshAccessToken(true);
		response = await send();
		result = await response.json();
	}
	if (
		tokenIdentity(token) === tokenIdentity(getJwtToken()) &&
		result.errors?.some(
			(error) => error.extensions?.code === 'UNAUTHENTICATED' && error.extensions?.authCode !== 'ACCESS_TOKEN_EXPIRED',
		)
	)
		clearAuthentication();
	if (!response.ok || result.errors?.length || !result.data)
		throw new Error(result.errors?.[0]?.message ?? 'Upload failed');
	return result.data.imagesUploader;
}
