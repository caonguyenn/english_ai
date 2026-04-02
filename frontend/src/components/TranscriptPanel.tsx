import { useEffect, useRef } from 'react';
import type { Message } from '../types';
import { MessageBubble } from './MessageBubble';

export function TranscriptPanel({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-600 text-sm select-none">
          Start speaking to begin a conversation
        </div>
      ) : (
        messages.map((m) => <MessageBubble key={m.id} message={m} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
}
