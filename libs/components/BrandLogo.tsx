import React, { useId } from 'react';

export default function BrandLogo() {
	const id = useId().replace(/:/g, '');
	const tealId = `triplink-teal-${id}`;
	const coralId = `triplink-coral-${id}`;
	const shadowId = `triplink-shadow-${id}`;

	return (
		<span className="triplink-brand" role="img" aria-label="TripLink">
			<span className="triplink-brand__artwork">
				<img src="/img/logo/triplink.png" alt="" aria-hidden="true" width={920} height={256} />
				<svg viewBox="0 0 920 256" fill="none" aria-hidden="true" focusable="false">
					<defs>
						<linearGradient id={tealId} x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stopColor="#0F766E" />
							<stop offset="100%" stopColor="#044E46" />
						</linearGradient>
						<linearGradient id={coralId} x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stopColor="#F28B70" />
							<stop offset="100%" stopColor="#DC5E3E" />
						</linearGradient>
						<filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
							<feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#044E46" floodOpacity="0.08" />
						</filter>
					</defs>
					<g transform="translate(50 47) scale(2.04545)" filter={`url(#${shadowId})`}>
						<rect width="88" height="88" rx="28" fill="#FFFFFF" stroke="#E6ECE9" strokeWidth="1.2" />
						<g className="triplink-brand__compass">
							<circle cx="44" cy="44" r="34" stroke="#0F766E" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="2 3" />
							<line x1="44" y1="14" x2="44" y2="18" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" />
							<line x1="44" y1="70" x2="44" y2="74" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" />
							<line x1="14" y1="44" x2="18" y2="44" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" />
							<line x1="70" y1="44" x2="74" y2="44" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" />
							<ellipse cx="44" cy="44" rx="27" ry="14" stroke="#F28B70" strokeWidth="1.2" strokeOpacity="0.45" transform="rotate(-30 44 44)" />
							<ellipse cx="44" cy="44" rx="27" ry="14" stroke="#0F766E" strokeWidth="1.2" strokeOpacity="0.35" transform="rotate(45 44 44)" />
							<path d="M44 20 L51 44 L44 41 Z" fill={`url(#${coralId})`} />
							<path d="M44 20 L37 44 L44 41 Z" fill="#F8A791" />
							<path d="M44 68 L37 44 L44 47 Z" fill={`url(#${tealId})`} />
							<path d="M44 68 L51 44 L44 47 Z" fill="#149A90" />
							<path d="M64 44 L44 48 L46 44 Z" fill="#0F766E" fillOpacity="0.6" />
							<path d="M24 44 L44 40 L42 44 Z" fill="#0F766E" fillOpacity="0.6" />
							<circle cx="44" cy="44" r="5" fill="#FFFFFF" stroke="#0F766E" strokeWidth="2" />
							<circle cx="44" cy="44" r="2" fill="#DC5E3E" />
						</g>
					</g>
				</svg>
			</span>
		</span>
	);
}
