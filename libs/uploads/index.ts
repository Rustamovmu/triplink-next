import { getJwtToken } from '../auth/token';
export async function uploadImages(files: File[], target: 'member' | 'tour' | 'article'): Promise<string[]> {
	if (!files.length || files.length > 10) throw new Error('Select 1–10 images.');
	if (
		files.some(
			(file) =>
				file.size > 15000000 || !/\.(jpe?g|png)$/i.test(file.name) || !['image/jpeg', 'image/png'].includes(file.type),
		)
	)
		throw new Error('Use JPEG/PNG images up to 15,000,000 bytes each.');
	const token = getJwtToken();
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
	const response = await fetch(process.env.REACT_APP_API_GRAPHQL_URL || 'http://localhost:3007/graphql', {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Apollo-Require-Preflight': 'true' },
		body: form,
	});
	const result: {
		data?: { imagesUploader: string[] };
		errors?: { message: string; extensions?: { code?: string } }[];
	} = await response.json();
	if (result.errors?.some((error) => error.extensions?.code === 'UNAUTHENTICATED'))
		window.dispatchEvent(new Event('triplink:session-invalid'));
	if (!response.ok || result.errors?.length || !result.data)
		throw new Error(result.errors?.[0]?.message ?? 'Upload failed');
	return result.data.imagesUploader;
}
