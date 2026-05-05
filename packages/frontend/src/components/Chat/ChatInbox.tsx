import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import ChatModal from './ChatModal';
import './ChatInbox.css';

interface Conversation {
    id: number;
    igdb_game_id: number;
    game_name: string;
    buyer_id: number;
    buyer_name: string;
    seller_id: number;
    seller_name: string;
    unread_count: number;
    last_message: string;
    last_message_at: string;
}

interface ChatInboxProps {
    unreadCount: number;
    onUnreadChange: (count: number) => void;
}

const ChatInbox: React.FC<ChatInboxProps> = ({ unreadCount, onUnreadChange }) => {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [convs, setConvs] = useState<Conversation[]>([]);
    const [activeConv, setActiveConv] = useState<Conversation | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) loadConvs();
    }, [open]);

    // Закрыть при клике вне
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const loadConvs = async () => {
        try {
            const r = await api.get('/chat/conversations');
            setConvs(Array.isArray(r.data.conversations) ? r.data.conversations : []);
        } catch { }
    };

    const openChat = (conv: Conversation) => {
        setActiveConv(conv);
        setOpen(false);
    };

    if (!user) return null;

    const otherName = (conv: Conversation) =>
        user.id === conv.buyer_id ? conv.seller_name : conv.buyer_name;

    return (
        <>
            <div className="chat-inbox-wrap" ref={panelRef}>
                <button
                    className="chat-inbox-btn"
                    onClick={() => setOpen(v => !v)}
                    aria-label="Открыть сообщения"
                    type="button"
                >
                    Чат
                    {unreadCount > 0 && (
                        <span className="chat-inbox-badge">{unreadCount}</span>
                    )}
                </button>

                {open && (
                    <div className="chat-inbox-panel">
                        <div className="chat-inbox-header">Сообщения</div>
                        <div className="chat-inbox-list">
                            {convs.length === 0 ? (
                                <p className="chat-inbox-empty">Пока нет диалогов</p>
                            ) : (
                                convs.map(conv => (
                                    <button
                                        key={conv.id}
                                        className="chat-inbox-item"
                                        onClick={() => openChat(conv)}
                                    >
                                        <div className="chat-inbox-item-top">
                                            <span className="chat-inbox-name">{otherName(conv)}</span>
                                            {conv.unread_count > 0 && (
                                                <span className="chat-inbox-unread">{conv.unread_count}</span>
                                            )}
                                        </div>
                                        <div className="chat-inbox-game">{conv.game_name}</div>
                                        {conv.last_message && (
                                            <div className="chat-inbox-preview">{conv.last_message}</div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {activeConv && (
                <ChatModal
                    sellerUserId={activeConv.seller_id}
                    sellerName={otherName(activeConv)}
                    igdbGameId={activeConv.igdb_game_id}
                    gameName={activeConv.game_name}
                    existingConvId={activeConv.id}
                    onClose={() => { setActiveConv(null); loadConvs(); }}
                    onUnreadChange={onUnreadChange}
                />
            )}
        </>
    );
};

export default ChatInbox;
