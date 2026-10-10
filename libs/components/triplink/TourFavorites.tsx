import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useApolloClient, useReactiveVar } from '@apollo/client';
import { FAVORITES, FAVORITE_TOGGLE } from '../../../apollo/user/triplink';
import { memberVar, sessionVar } from '../../../apollo/store';
import { totalOf } from '../../types/triplink';
import { errorMessage } from '../../triplink/errors';

type Snapshot = {
	owner: string;
	saved: Set<string>;
	counts: Record<string, number>;
	pending: Set<string>;
	errors: Record<string, string>;
	ready: boolean;
	error: string;
};
const empty = (owner: string): Snapshot => ({
	owner,
	saved: new Set(),
	counts: {},
	pending: new Set(),
	errors: {},
	ready: false,
	error: '',
});
const FavoritesContext = createContext({
	...empty(''),
	eligible: false,
	anonymous: false,
	retry: () => {},
	toggle: async (_id: string, _count: number) => {},
});

// One favorite-list load per session, shared by every card and grid on the page.
export function TourFavoritesProvider({ children }: { children: React.ReactNode }) {
	const client = useApolloClient();
	const member = useReactiveVar(memberVar);
	const session = useReactiveVar(sessionVar);
	const owner = session === 'authenticated' && member && member.memberType !== 'ADMIN' ? member._id : '';
	const activeOwner = useRef(owner);
	activeOwner.current = owner;
	const locks = useRef(new Set<string>());
	const [snapshot, setSnapshot] = useState(() => empty(owner));
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let active = true;
		locks.current = new Set();
		setSnapshot(empty(owner));
		if (!owner) return;
		void (async () => {
			try {
				const saved = new Set<string>();
				let page = 1;
				while (active) {
					const { data } = await client.query({
						query: FAVORITES,
						variables: { input: { page, limit: 100 } },
						fetchPolicy: 'network-only',
					});
					data.result.list.forEach((tour) => saved.add(tour._id));
					if (!data.result.list.length || page * 100 >= totalOf(data.result)) break;
					page++;
				}
				if (active) setSnapshot({ ...empty(owner), saved, ready: true });
			} catch (error) {
				if (active) setSnapshot({ ...empty(owner), error: errorMessage(error) });
			}
		})();
		return () => {
			active = false;
		};
	}, [client, owner, attempt]);
	const current = snapshot.owner === owner ? snapshot : empty(owner);
	const toggle = async (tourId: string, displayedCount: number) => {
		if (!owner || !current.ready || locks.current.has(tourId)) return;
		const wasSaved = current.saved.has(tourId);
		const previousCount = current.counts[tourId] ?? displayedCount;
		const operationLocks = locks.current;
		operationLocks.add(tourId);
		setSnapshot((previous) => {
			const saved = new Set(previous.saved);
			if (wasSaved) saved.delete(tourId);
			else saved.add(tourId);
			return {
				...previous,
				saved,
				counts: { ...previous.counts, [tourId]: Math.max(0, previousCount + (wasSaved ? -1 : 1)) },
				pending: new Set(operationLocks),
				errors: { ...previous.errors, [tourId]: '' },
			};
		});
		try {
			const { data } = await client.mutate({ mutation: FAVORITE_TOGGLE, variables: { tourId } });
			if (!data) throw new Error('Something went wrong!');
			if (activeOwner.current !== owner || locks.current !== operationLocks) return;
			setSnapshot((previous) => {
				const saved = new Set(previous.saved);
				if (data.result.favorited) saved.add(tourId);
				else saved.delete(tourId);
				return { ...previous, saved, counts: { ...previous.counts, [tourId]: data.result.tour.tourFavoriteCount } };
			});
		} catch (error) {
			if (activeOwner.current === owner && locks.current === operationLocks)
				setSnapshot((previous) => {
					const saved = new Set(previous.saved);
					if (wasSaved) saved.add(tourId);
					else saved.delete(tourId);
					return {
						...previous,
						saved,
						counts: { ...previous.counts, [tourId]: previousCount },
						errors: { ...previous.errors, [tourId]: errorMessage(error) },
					};
				});
		} finally {
			operationLocks.delete(tourId);
			if (activeOwner.current === owner && locks.current === operationLocks)
				setSnapshot((previous) => ({ ...previous, pending: new Set(operationLocks) }));
		}
	};
	return (
		<FavoritesContext.Provider
			value={{
				...current,
				eligible: !!owner,
				anonymous: session === 'anonymous',
				retry: () => setAttempt((previous) => previous + 1),
				toggle,
			}}
		>
			{children}
		</FavoritesContext.Provider>
	);
}

export const useTourFavorites = () => useContext(FavoritesContext);
