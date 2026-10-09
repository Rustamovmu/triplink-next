import { ChatMessage } from '../types/triplink';
export const isChatMessage = (value: unknown): value is ChatMessage =>
	Boolean(
		value &&
			typeof value === 'object' &&
			typeof (value as ChatMessage)._id === 'string' &&
			typeof (value as ChatMessage).text === 'string' &&
			typeof (value as ChatMessage).createdAt === 'string' &&
			typeof (value as ChatMessage).memberData?._id === 'string' &&
			typeof (value as ChatMessage).memberData?.memberNick === 'string',
	);
export function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
	return Array.from(new Map([...previous, ...incoming].map((message) => [message._id, message])).values())
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
		.slice(-5);
}
