import React from 'react';
import Chat from './Chat';
import AiAssistant from './AiAssistant';

export default function ChatTools() {
	return (
		<div className="triplink-chat-tools">
			<Chat />
			<AiAssistant />
		</div>
	);
}
