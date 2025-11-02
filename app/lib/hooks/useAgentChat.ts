import { useState } from 'react';

export const useAgentChat = ({
  files,
  promptId,
  contextOptimization,
  apiKeys,
  providerSettings,
  env,
}) => {
  const [messages, setMessages] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  let writer: WritableStreamDefaultWriter;

  const stream = new ReadableStream({
    start(controller) {
      writer = new WritableStreamDefaultWriter(
        new WritableStream({
          write(chunk) {
            controller.enqueue(chunk);
          },
          close() {
            controller.close();
          },
        }),
      );
    },
  });

  const append = async (message) => {
    setIsLoading(true);
    const newMessage = { role: 'assistant', content: '' };
    setMessages((messages) => [...messages, message, newMessage]);
    setLastMessage(newMessage);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [...messages, message],
        files,
        promptId,
        contextOptimization,
        apiKeys,
        providerSettings,
        env,
      }),
    });

    const { jobId } = await response.json();

    const eventSource = new EventSource(`/agent/stream?jobId=${jobId}`);

    eventSource.onmessage = (event) => {
      const { message } = JSON.parse(event.data);
      if (lastMessage) {
        lastMessage.content += message;
        setMessages((messages) => [...messages]);
      }
    };

    eventSource.onerror = () => {
      setIsLoading(false);
      eventSource.close();
      setLastMessage(null);
    };
  };

  return { messages, isLoading, append, stream };
};
