import { gql, TypedDocumentNode } from '@apollo/client';
import { AiChatInput, AiChatResult } from '../../libs/types/triplink/ai';

export const AI_CHAT: TypedDocumentNode<{ result: AiChatResult }, { input: AiChatInput }> = gql`
	mutation AI_CHAT($input: AiChatInput!) {
		result: aiChat(input: $input) {
			text
			sources {
				tourId
				title
				destination
				price
				durationDays
				rating
				reviewCount
				status
			}
		}
	}
`;
