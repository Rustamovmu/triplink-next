/* One shared network queue is the fallback when Web Locks is unavailable.
 * Access credentials stay in memory. Refresh cookies are never visible to this worker.
 */
let queue = Promise.resolve(),
	token = '',
	version = '',
	credentialVersion = '';
const commits = new Map();
const preparations = new Map();
const fresh = (value) => {
	try {
		return JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000 > Date.now() + 30000;
	} catch {
		return false;
	}
};
onconnect = (event) => {
	const port = event.ports[0];
	port.onmessage = ({ data }) => {
		if (data.kind === 'ready') {
			preparations.get(data.id)?.(data);
			return;
		}
		if (data.kind === 'commit') {
			commits.get(data.id)?.(data.version);
			return;
		}
		queue = queue
			.catch(() => {})
			.then(async () => {
				try {
					if (data.kind === 'refresh' && version === data.version && fresh(token)) {
						port.postMessage({
							id: data.id,
							body: JSON.stringify({ accessToken: token }),
							status: 200,
							headers: {},
							kind: 'refresh',
						});
						return;
					}
					const preparation = await new Promise((resolve) => {
						const timer = setTimeout(() => {
							preparations.delete(data.id);
							resolve(null);
						}, 5000);
						preparations.set(data.id, (ready) => {
							clearTimeout(timer);
							preparations.delete(data.id);
							resolve(ready);
						});
						port.postMessage({ id: data.id, kind: 'prepare' });
					});
					if (!preparation?.active) throw new Error('Authentication request was cancelled. Please retry.');
					if (data.kind !== 'login' && preparation.version !== data.version)
						throw new Error('Authentication changed while refreshing.');
					const controller = new AbortController(),
						timeout = setTimeout(() => controller.abort(), 15000);
					let response;
					try {
						response = await fetch(data.url, { ...data.options, credentials: 'include', signal: controller.signal });
					} finally {
						clearTimeout(timeout);
					}
					const body = await response.text();
					if (response.ok && data.kind === 'refresh') {
						token = JSON.parse(body).accessToken;
						version = data.version;
					}
					if (
						response.ok &&
						(data.kind === 'login' ||
							data.kind === 'logout' ||
							(data.kind === 'session' && data.options.method !== 'GET'))
					) {
						token = '';
						version = '';
					}
					// Login/logout publication completes before the next cookie mutation starts. A crashed tab cannot hold this queue forever.
					let committed;
					if (data.kind === 'login' || data.kind === 'logout')
						committed = new Promise((resolve) => {
							const timer = setTimeout(() => {
								commits.delete(data.id);
								resolve(credentialVersion);
							}, 5000);
							commits.set(data.id, (next) => {
								clearTimeout(timer);
								commits.delete(data.id);
								resolve(next);
							});
						});
					port.postMessage({
						id: data.id,
						body,
						status: response.status,
						headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
						kind: data.kind,
						expectedVersion: preparation.version,
					});
					if (committed) {
						credentialVersion = await committed;
						if (response.ok && data.kind === 'login') {
							try {
								token = JSON.parse(body).data?.result?.accessToken || '';
								version = credentialVersion;
							} catch {}
						}
					}
				} catch (error) {
					port.postMessage({ id: data.id, error: error.message || 'Authentication request failed', kind: data.kind });
				}
			});
	};
	port.start();
};
