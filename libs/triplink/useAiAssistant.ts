import { useCallback, useEffect, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { AI_CHAT } from '../../apollo/user/ai';
import { tokenIdentity } from '../auth/token';
import { AiChatInput, AiTurn, AI_MESSAGE_LIMIT } from '../types/triplink/ai';

export type AiError = 'rate' | 'unavailable' | 'network' | 'session';
type Pending = { input: AiChatInput; turnId: number };
// Memory only: survive page navigation without writing private chats to storage.
let session: { memberId?: string; token?: string; turns: AiTurn[] } | null = null;

/** Local session state; generation numbers discard responses after clear/logout. */
export function useAiAssistant(memberId?: string, token?: string) {
	const client = useApolloClient();
	const sessionKey = tokenIdentity(token ?? '');
	const [turns, setTurns] = useState<AiTurn[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<AiError | null>(null);
	const history = useRef<AiTurn[]>([]);
	const busy = useRef(false);
	const epoch = useRef(0);
	const counter = useRef(0);
	const pending = useRef<Pending | null>(null);
	const abort = useRef<AbortController | null>(null);
	const identity = useRef({ memberId, token });
	identity.current = { memberId, token };
	const clear = useCallback(() => {
		epoch.current++;
		abort.current?.abort();
		abort.current = null;
		busy.current = false;
		pending.current = null;
		history.current = [];
		session = null;
		setTurns([]);
		setLoading(false);
		setError(null);
	}, []);
	useEffect(() => {
		if (session && session.memberId === memberId && tokenIdentity(session.token ?? '') === sessionKey) {
			history.current = session.turns;
			counter.current = Math.max(0, ...session.turns.map((turn) => turn.id));
			setTurns(session.turns);
		} else clear();
		const cancel = () => {
			epoch.current++;
			abort.current?.abort();
		};
		return cancel;
	}, [memberId, sessionKey, clear]);
	const run = async (request: Pending) => {
		if (busy.current || !memberId || !token) return false;
		busy.current = true;
		pending.current = request;
		setLoading(true);
		setError(null);
		const generation = epoch.current;
		const controller = new AbortController();
		abort.current = controller;
		const timer = setTimeout(() => controller.abort(), 30000);
		const current = () =>
			generation === epoch.current &&
			identity.current.memberId === memberId &&
			tokenIdentity(identity.current.token ?? '') === sessionKey;
		try {
			const response = await client.mutate({
				mutation: AI_CHAT,
				variables: { input: request.input },
				fetchPolicy: 'no-cache',
				context: { fetchOptions: { signal: controller.signal } },
			});
			if (!current()) return false;
			const result = response.data?.result;
			if (!result?.text) throw new Error('Empty AI response');
			history.current = [...history.current, { id: ++counter.current, role: 'assistant' as const, ...result }].slice(
				-100,
			);
			session = { memberId, token, turns: history.current };
			setTurns(history.current);
			pending.current = null;
			return true;
		} catch (failure: unknown) {
			if (!current()) return false;
			const api = failure as { graphQLErrors?: { extensions?: { code?: string } }[]; networkError?: unknown };
			const code = api.graphQLErrors?.[0]?.extensions?.code;
			const problem =
				code === 'UNAUTHENTICATED' || code === 'FORBIDDEN'
					? 'session'
					: code === 'AI_RATE_LIMITED'
					? 'rate'
					: api.networkError || controller.signal.aborted
					? 'network'
					: 'unavailable';
			setError(problem);
			if (problem === 'session') pending.current = null;
			return false;
		} finally {
			clearTimeout(timer);
			if (generation === epoch.current) {
				busy.current = false;
				setLoading(false);
				abort.current = null;
			}
		}
	};
	const send = (text: string, context: Omit<AiChatInput, 'message' | 'history'> = {}) => {
		const message = text.trim();
		if (!message || message.length > AI_MESSAGE_LIMIT || busy.current || !memberId || !token) return false;
		// A failed turn is replaced by a new request, so it cannot masquerade as an answered exchange.
		const previous = pending.current
			? history.current.filter((turn) => turn.id !== pending.current?.turnId)
			: history.current;
		const turnId = ++counter.current;
		const input: AiChatInput = {
			...context,
			message,
			history: previous.slice(-5).map(({ role, text }) => ({ role, text: text.slice(0, AI_MESSAGE_LIMIT) })),
		};
		history.current = [...previous, { id: turnId, role: 'user' as const, text: message }].slice(-100);
		setTurns(history.current);
		void run({ input, turnId });
		return true;
	};
	const retry = () => {
		if (pending.current && !busy.current && error !== 'session') void run(pending.current);
	};
	return { turns, loading, error, send, retry, clear };
}
