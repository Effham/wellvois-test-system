import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, Copy, Check, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAIChatStream } from '@/hooks/useAIChatStream';
import { extractPageContext, getQuickActions } from '@/utils/pageContextExtractor';
import { Link } from '@inertiajs/react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface LinkifyProps {
    text: string;
}

// Component to detect and convert URLs to clickable Inertia links
function Linkify({ text }: LinkifyProps) {
    // Regex to detect URLs - matches /path/to/page or full URLs
    const urlPattern = /(\bhttps?:\/\/[^\s]+|\/[a-zA-Z0-9\-_\/]+)/g;
    
    const parts = text.split(urlPattern);
    
    return (
        <>
            {parts.map((part, index) => {
                // Check if this part is a URL
                if (part.match(urlPattern)) {
                    // For internal paths (starting with /), use Inertia Link
                    if (part.startsWith('/') && !part.startsWith('http')) {
                        return (
                            <Link
                                key={index}
                                href={part}
                                className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
                            >
                                {part}
                            </Link>
                        );
                    }
                    // For external URLs, use regular anchor
                    return (
                        <a
                            key={index}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
                        >
                            {part}
                        </a>
                    );
                }
                // Regular text
                return <span key={index}>{part}</span>;
            })}
        </>
    );
}

function MessageBubble({ message }: { message: Message }) {
    const [copied, setCopied] = useState(false);
    const isAssistant = message.role === 'assistant';

    const handleCopy = async () => {
        await navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'flex w-full gap-2',
                isAssistant ? 'justify-start' : 'justify-end'
            )}
        >
                <div
                className={cn(
                    'group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                    isAssistant
                        ? 'bg-primary/10 text-foreground dark:bg-primary/20'
                        : 'bg-primary text-primary-foreground'
                )}
            >
                {isAssistant && (
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                        <Sparkles className="h-3 w-3" />
                        Wellovis AI
                    </div>
                )}
                
                <p className="whitespace-pre-wrap leading-relaxed">
                    <Linkify text={message.content} />
                </p>
                
                {isAssistant && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        className={cn(
                            'absolute right-2 top-2 h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100',
                            copied && 'opacity-100'
                        )}
                    >
                        {copied ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                            <Copy className="h-3.5 w-3.5" />
                        )}
                    </Button>
                )}
            </div>
        </motion.div>
    );
}

export function AIAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [hasActiveStream, setHasActiveStream] = useState(false);
    
    const { streamChat, isStreaming, streamedText, clearStream, error } = useAIChatStream();

    // Debug logging for streaming
    useEffect(() => {
        if (isStreaming) {
            console.log('Streaming update:', {
                isStreaming,
                length: streamedText.length,
                preview: streamedText.substring(0, 50)
            });
        }
    }, [isStreaming, streamedText]);

    // Auto-scroll to bottom when new messages arrive or stream updates
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamedText]);

    // Handle stream completion
    useEffect(() => {
        if (hasActiveStream && !isStreaming) {
            // When stream ends, persist the streamed content (if any) as a message
            if (streamedText && messages.length > 0 && messages[messages.length - 1].role === 'user') {
            // Stream just completed, save the final response
            const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                    content: streamedText,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
                clearStream(); // Clear the streaming data
            }
            setHasActiveStream(false);
        }
    }, [isStreaming, streamedText, hasActiveStream]);

    const handleSendMessage = () => {
        if (!inputValue.trim() || isStreaming) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');

        // Extract page context
        const pageContext = extractPageContext();

        // Build conversation history
        const conversationHistory = messages.slice(-6).map(msg => ({
            user: msg.role === 'user' ? msg.content : '',
            assistant: msg.role === 'assistant' ? msg.content : '',
        })).filter(exchange => exchange.user || exchange.assistant);

        // Prepare UI immediately for streaming
        setHasActiveStream(true);

        // Clear any previous stream residue
        clearStream();

        // Start streaming - send the payload (POST)
        streamChat(
            userMessage.content,
            pageContext,
            conversationHistory,
        );
    };

    const handleQuickAction = (query: string) => {
        setInputValue(query);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const quickActions = getQuickActions();

    return (
        <>
            {/* Floating Avatar Button */}
            <AnimatePresence>
                {!isOpen && (
                    <>
                        {/* Enhanced backdrop shadow ring - makes button stand out */}
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-background/80 shadow-2xl ring-2 ring-primary/20 ring-offset-4 ring-offset-background"
                        />
                        
                        <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsOpen(true)}
                            className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12),0_0_20px_rgba(var(--color-primary),0.3)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.15),0_0_30px_rgba(var(--color-primary),0.5)]"
                        >
                            {/* Outer glow ring */}
                            <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 blur-md opacity-60 animate-pulse-gentle" />
                            
                            {/* Continuous shine effect */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-white/30 to-transparent animate-shine" />
                            
                            {/* Enhanced glow effect on hover */}
                            <div className="absolute inset-0 rounded-full bg-primary opacity-0 blur-lg transition-opacity group-hover:opacity-60" />
                            
                            {/* Subtle rotating gradient border */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-foreground/20 via-transparent to-primary-foreground/20 animate-spin-slow opacity-50" />
                            
                            <Sparkles className="relative h-6 w-6 text-primary-foreground animate-pulse-gentle drop-shadow-lg" />
                        </motion.button>
                    </>
                )}
            </AnimatePresence>

            {/* Chat Interface */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        className="fixed bottom-6 right-6 z-50 flex h-[700px] w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
                    >
                        {/* Header */}
                        <div className="relative flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 backdrop-blur-sm">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold">Wellovis AI</h3>
                                    <p className="text-xs opacity-90">Your intelligent assistant</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsOpen(false)}
                                className="h-8 w-8 rounded-full p-0 text-primary-foreground hover:bg-primary-foreground/20"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-4">
                                {/* Welcome Message */}
                                {messages.length === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center dark:border-primary/30 dark:bg-primary/10"
                                    >
                                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                                            <Sparkles className="h-5 w-5 text-primary-foreground" />
                                        </div>
                                        <h4 className="mb-1 text-sm font-semibold text-foreground">
                                            Welcome to Wellovis AI
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            Your complete application guide, content writer, and page assistant - all in one!
                                        </p>
                                    </motion.div>
                                )}

                                {/* Messages */}
                                {messages.map((message) => (
                                    <MessageBubble key={message.id} message={message} />
                                ))}

                                {/* Active streaming response */}
                                {(hasActiveStream || isStreaming) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex w-full justify-start"
                                    >
                                        <div className="group relative max-w-[85%] rounded-2xl bg-primary/10 px-4 py-3 text-sm text-foreground dark:bg-primary/20">
                                            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                                                <Sparkles className="h-3 w-3" />
                                                Wellovis AI
                                            </div>
                                            
                                            {streamedText ? (
                                                <p className="whitespace-pre-wrap leading-relaxed">
                                                    <Linkify text={streamedText} />
                                                    <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-primary"></span>
                                                </p>
                                            ) : (
                                                <div className="flex h-6 items-center gap-1">
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Stream error (optional) */}
                                {error && (
                                    <div className="text-xs text-destructive">{error}</div>
                                )}

                                {/* Scroll anchor */}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="border-t border-border bg-muted/30 p-4">
                            {/* Quick Actions - only show when no messages */}
                            {messages.length === 0 && (
                                <div className="mb-3 space-y-2">
                                    <p className="text-center text-xs font-medium text-muted-foreground">💡 Quick actions:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {quickActions.map((action, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickAction(action.query)}
                                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            >
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Type your message..."
                                    disabled={isStreaming}
                                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                />
                                <Button
                                    size="sm"
                                    onClick={handleSendMessage}
                                    disabled={isStreaming || !inputValue.trim()}
                                    className="h-auto rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {isStreaming ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

