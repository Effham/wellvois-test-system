import { useRef, useState } from 'react';

// Native streaming hook with per-chunk UI updates
export function useAIChatStream() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamedText, setStreamedText] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const streamChat = async (
        message: string,
        pageContext: any,
        conversationHistory: any[],
    ) => {
        setIsStreaming(true);
        setStreamedText('');
        setError(null);

        abortRef.current = new AbortController();

        try {
            const response = await fetch(route('ai-chat.stream'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/plain',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    message,
                    page_context: pageContext,
                    conversation_history: conversationHistory,
                }),
                signal: abortRef.current.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Force immediate UI updates by appending
                setStreamedText(prev => prev + chunk);
            }
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                setError(e?.message || 'Streaming failed');
            }
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
        }
    };

    const cancelStream = () => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
        setIsStreaming(false);
    };

    const clearStream = () => {
        setStreamedText('');
        setError(null);
    };

    return {
        streamChat,
        isStreaming,
        streamedText,
        error,
        cancelStream,
        clearStream,
    };
}

