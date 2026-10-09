import { makeVar } from '@apollo/client';
import { Member } from '../libs/types/triplink';
export const themeVar = makeVar({});
export const sessionVar = makeVar<'loading' | 'authenticated' | 'anonymous' | 'error'>('loading');
export const sessionErrorVar = makeVar('');
export const memberVar = makeVar<Member | null>(null);
export const socketVar = makeVar<WebSocket | undefined>(undefined);
