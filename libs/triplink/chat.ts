import { ChatMember, ChatMessage, ChatPresence } from '../types/triplink';
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_MESSAGE_LIMIT = 1000;
const record = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
export const isChatMember = (value: unknown): value is ChatMember =>
	record(value) &&
	typeof value._id === 'string' &&
	Boolean(value._id) &&
	typeof value.memberNick === 'string' &&
	Boolean(value.memberNick) &&
	['USER', 'AGENT', 'ADMIN'].includes(value.memberType as string) &&
	(value.memberImage === undefined || typeof value.memberImage === 'string');
export const isChatPresence = (value: unknown): value is ChatPresence =>
	record(value) &&
	Array.isArray(value.list) &&
	value.list.every(isChatMember) &&
	new Set(value.list.map((member) => member._id)).size === value.list.length &&
	value.totalMembers === value.list.length &&
	Number.isInteger(value.totalClients) &&
	(value.totalClients as number) >= value.list.length;
export const isChatMessage = (value: unknown): value is ChatMessage =>
	Boolean(
		value &&
			typeof value === 'object' &&
			typeof (value as ChatMessage)._id === 'string' &&
			typeof (value as ChatMessage).text === 'string' &&
			(value as ChatMessage).text.length <= CHAT_MESSAGE_LIMIT &&
			typeof (value as ChatMessage).createdAt === 'string' &&
			Number.isFinite(Date.parse((value as ChatMessage).createdAt)) &&
			isChatMember((value as ChatMessage).memberData),
	);
export function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
	return Array.from(new Map([...previous, ...incoming].map((message) => [message._id, message])).values())
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
		.slice(-CHAT_HISTORY_LIMIT);
}
export const chatRole = (role: ChatMember['memberType']) =>
	({ USER: 'Traveler', AGENT: 'Agent', ADMIN: 'Admin' }[role]);
export const chatInitials = (nick: string) => Array.from(nick.trim()).slice(0, 2).join('').toLocaleUpperCase();
export function chatImageUrl(image?: string) {
	const path = image?.trim();
	if (!path || /^\/\/|\\/.test(path)) return undefined;
	if (/^https?:\/\//i.test(path)) return path;
	if (/^[a-z][a-z\d+.-]*:/i.test(path)) return undefined;
	if (path.startsWith('/') && !path.startsWith('/uploads/')) return path;
	return `${(process.env.REACT_APP_API_URL || 'http://localhost:3007').replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
export const chatProfile = (member: ChatMember) =>
	member.memberType === 'ADMIN'
		? null
		: member.memberType === 'AGENT'
		? `/agent/detail?agentId=${encodeURIComponent(member._id)}`
		: `/member?memberId=${encodeURIComponent(member._id)}`;
