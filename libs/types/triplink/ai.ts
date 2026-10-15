import { TourSearch } from './index';

export const AI_MESSAGE_LIMIT = 1000;
export type AiIntent = 'FIND_TOURS' | 'BEST_RATED' | 'POPULAR_DESTINATIONS' | 'PLAN_TRIP';
export interface AiMessage {
	role: 'user' | 'assistant';
	text: string;
}
export interface AiTourSource {
	tourId: string;
	title: string;
	destination: string;
	price: number;
	durationDays: number;
	rating: number;
	reviewCount: number;
	status: string;
}
export interface AiChatInput {
	message: string;
	locale?: 'en' | 'kr' | 'uz';
	history?: AiMessage[];
	intent?: AiIntent;
	tourId?: string;
	search?: TourSearch;
	detailed?: boolean;
}
export interface AiChatResult {
	text: string;
	sources: AiTourSource[];
}
export interface AiTurn extends AiMessage {
	id: number;
	sources?: AiTourSource[];
}
