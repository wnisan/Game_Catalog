import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import './ChatModal.css';

interface Message {
  id: number;
  sender_id: number;
  content: string;
  is_read: boolean;
  is_edited?: boolean;
  is_deleted?: boolean;
  created_at: string;
}

interface ChatModalProps {
  sellerUserId: number;
  sellerName: string;
  igdbGameId: number;
  gameName: string;
  onClose: () => void;
  onUnreadChange?: ((count: number) => void) | undefined;
  existingConvId?: number;
}

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/chat`;

const ChatModal: React.FC<ChatModalProps> = ({
  sellerUserId,
  sellerName,
  igdbGameId,
  gameName,
  onClose,
  onUnreadChange,
  existingConvId,
}) => {
  const { user } = useAuth();
  const convIdRef = useRef<number | null>(existingConvId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(!!existingConvId);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const connectWS = useCallback(
    async (cid: number) => {
      try {
        const tokenRes = await api.get('/auth/ws-token');
        const token = tokenRes.data.token;
        const ws = new WebSocket(
          `${WS_URL}?token=${encodeURIComponent(token)}`
        );
        wsRef.current = ws;
        ws.onopen = () =>
          ws.send(JSON.stringify({ type: 'join', convId: cid }));
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'message' && Number(msg.convId) === cid) {
              setMessages((prev) => [
                ...prev,
                {
                  id: msg.id,
                  sender_id: msg.senderId,
                  content: msg.content,
                  is_read: false,
                  created_at: msg.createdAt,
                },
              ]);
            }
            if (msg.type === 'unread_count') onUnreadChange?.(msg.count);
          } catch {}
        };
        ws.onerror = () => ws.close();
        ws.onclose = () => {};
      } catch {}
    },
    [onUnreadChange]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!existingConvId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const hist = await api.get(
          `/chat/conversations/${existingConvId}/messages`
        );
        setMessages(hist.data.messages || []);
      } catch {}
      setLoading(false);
      await connectWS(existingConvId);
    };
    load();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [existingConvId, connectWS]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content) return;

    if (!convIdRef.current) {
      try {
        const r = await api.post('/chat/conversations', {
          sellerUserId,
          igdbGameId,
          gameName,
        });
        const newConvId: number = r.data.conversation.id;
        convIdRef.current = newConvId;
        await connectWS(newConvId);
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch {
        return;
      }
    }

    const cid = convIdRef.current;
    if (!cid) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({ type: 'message', convId: cid, content })
    );
    setInput('');
  }, [input, sellerUserId, igdbGameId, gameName, connectWS]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEdit = async (msgId: number) => {
    if (!editText.trim()) return;
    try {
      await api.patch(`/chat/messages/${msgId}`, { content: editText.trim() });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: editText.trim(), is_edited: true }
            : m
        )
      );
      setEditingId(null);
      setEditText('');
    } catch {}
  };

  const handleDelete = async (msgId: number) => {
    try {
      await api.delete(`/chat/messages/${msgId}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: 'Сообщение удалено', is_deleted: true }
            : m
        )
      );
    } catch {}
  };

  const formatTime = (dt: string) =>
    new Date(dt).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div
      className="chat-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="chat-modal">
        <div className="chat-header">
          <div className="chat-header-info">
            <span className="chat-header-title">💬 {sellerName}</span>
            <span className="chat-header-sub">{gameName}</span>
          </div>
          <button className="chat-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="chat-messages">
          {loading ? (
            <p className="chat-loading">Загрузка...</p>
          ) : messages.length === 0 ? (
            <p className="chat-empty">Пока нет сообщений. Напишите первым!</p>
          ) : (
            messages.map((msg, i) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id ?? i}
                  className={`chat-msg ${isMine ? 'chat-msg--mine' : 'chat-msg--theirs'}`}
                >
                  {editingId === msg.id ? (
                    <div className="chat-edit-row">
                      <input
                        className="chat-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEdit(msg.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                      <button
                        className="chat-edit-save"
                        onClick={() => handleEdit(msg.id)}
                      >
                        ✓
                      </button>
                      <button
                        className="chat-edit-cancel"
                        onClick={() => setEditingId(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`chat-bubble ${msg.is_deleted ? 'chat-bubble--deleted' : ''}`}
                    >
                      {msg.content}
                      {msg.is_edited && !msg.is_deleted && (
                        <span className="chat-edited"> изменено</span>
                      )}
                    </div>
                  )}
                  <div className="chat-msg-meta">
                    <span className="chat-time">
                      {formatTime(msg.created_at)}
                    </span>
                    {isMine && !msg.is_deleted && editingId !== msg.id && (
                      <div className="chat-msg-actions">
                        <button
                          className="chat-action-btn"
                          onClick={() => {
                            setEditingId(msg.id);
                            setEditText(msg.content);
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          className="chat-action-btn chat-action-btn--del"
                          onClick={() => handleDelete(msg.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <textarea
            className="chat-input"
            placeholder="Введите сообщение..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="chat-send"
            onClick={sendMessage}
            disabled={!input.trim()}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
