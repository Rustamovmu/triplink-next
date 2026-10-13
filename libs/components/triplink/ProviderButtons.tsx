import React, { useEffect, useState, useRef } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { FcGoogle } from 'react-icons/fc';
import { FaTelegramPlane } from 'react-icons/fa';
import { SiKakaotalk } from 'react-icons/si';
import { useTranslation } from 'next-i18next';
import { availableProviders, AuthProvider, startProvider } from '../../auth/security';
const names = { GOOGLE: 'Google', TELEGRAM: 'Telegram', KAKAO: 'Kakao' };
export function ProviderIcon({ provider }: { provider: AuthProvider }) {
	return provider === 'GOOGLE' ? (
		<FcGoogle aria-hidden />
	) : provider === 'TELEGRAM' ? (
		<FaTelegramPlane aria-hidden />
	) : (
		<SiKakaotalk aria-hidden />
	);
}
export function ProviderButtons({ returnTo, disabled }: { returnTo: unknown; disabled?: boolean }) {
	const { t } = useTranslation('common');
	const [providers, setProviders] = useState<AuthProvider[]>([]);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const lock = useRef(false);
	const [retry, setRetry] = useState(0);
	useEffect(() => {
		const controller = new AbortController();
		setError('');
		void availableProviders(controller.signal)
			.then(setProviders)
			.catch(() => {
				if (!controller.signal.aborted) setError('Unable to load sign-in providers. Please retry.');
			});
		return () => controller.abort();
	}, [retry]);
	if (!providers.length && !error) return null;
	return (
		<Stack className="triplink-providers" spacing={1.5}>
			{error && (
				<Alert severity="warning" action={<Button onClick={() => setRetry(retry + 1)}>{t('Retry')}</Button>}>
					{t(error)}
				</Alert>
			)}
			{!!providers.length && <p className="triplink-providers__divider">{t('Or continue with')}</p>}
			{providers.map((provider) => (
				<Button
					key={provider}
					className={`triplink-provider triplink-provider--${provider.toLowerCase()}`}
					variant="outlined"
					startIcon={<ProviderIcon provider={provider} />}
					disabled={disabled || busy}
					onClick={() => {
						if (lock.current) return;
						lock.current = true;
						setBusy(true);
						setError('');
						void startProvider(provider, 'LOGIN', returnTo).catch(() => {
							setError('Unable to start provider sign-in. Please retry.');
							setBusy(false);
							lock.current = false;
						});
					}}
				>
					{t('Continue with {{provider}}', { provider: names[provider] })}
				</Button>
			))}
		</Stack>
	);
}
