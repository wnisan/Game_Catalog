import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getGameComments,
  createGameComment,
  updateComment,
  deleteComment
} from '../../services/api';
import './Comments.css';

interface CommentsProps {
  gameId: number;
}

interface BaseComment {
  id: number;
  game_id: number;
  comment_text: string;
  created_at: string;
  updated_at: string;
  user_id: number;
  user_name: string;
  user_email: string;
  parent_id?: number | null;
}

interface CommentWithReplies extends BaseComment {
  parent_id?: number | null;
  replies?: CommentWithReplies[];
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface CommentItemProps {
  comment: CommentWithReplies;
  gameId: number;
  user: any;
  isAuthenticated: boolean;
  onReload: () => void;
  depth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  gameId,
  user,
  isAuthenticated,
  onReload,
  depth = 0,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const handleUpdate = async (commentId: number) => {
    if (!editText.trim()) return;
    try {
      await updateComment(commentId, editText);
      setEditingId(null);
      onReload();
    } catch {}
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Удалить этот комментарий?')) return;
    try {
      await deleteComment(commentId);
      onReload();
    } catch {}
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    try {
      await createGameComment(gameId, replyText, comment.id);
      setReplyText('');
      setReplyOpen(false);
      onReload();
    } catch {
    } finally {
      setReplyLoading(false);
    }
  };

  return (
    <div
      className={`comments__item ${depth > 0 ? 'comments__item--reply' : ''}`}
    >
      <div className="comments__header">
        <div className="comments__author">
          <Link
            to={`/profile/${comment.user_id}`}
            className="comments__author-link"
          >
            <strong>{comment.user_name}</strong>
          </Link>
          <span className="comments__date">
            {formatDate(comment.created_at)}
          </span>
        </div>
        <div className="comments__actions">
          {isAuthenticated && (
            <button
              type="button"
              className="comments__action-btn comments__action-btn--reply"
              onClick={() => {
                setReplyOpen(!replyOpen);
                setReplyText('');
              }}
            >
              ↩ Ответить
            </button>
          )}
          {isAuthenticated && user && user.id === comment.user_id && (
            <>
              {editingId === comment.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleUpdate(comment.id)}
                    className="comments__action-btn comments__action-btn--save"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="comments__action-btn comments__action-btn--cancel"
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditText(comment.comment_text);
                    }}
                    className="comments__action-btn comments__action-btn--edit"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="comments__action-btn comments__action-btn--delete"
                  >
                    Удалить
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {editingId === comment.id ? (
        <textarea
          className="comments__edit-input"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          rows={3}
        />
      ) : (
        <div>
          <p className="comments__text">{comment.comment_text}</p>
          {comment.updated_at && comment.updated_at !== comment.created_at && (
            <span className="comments__edited">изменено</span>
          )}
        </div>
      )}

      {replyOpen && (
        <div className="comments__reply-form">
          <textarea
            className="comments__input comments__input--reply"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Ответить ${comment.user_name}...`}
            rows={2}
          />
          <div className="comments__reply-actions">
            <button
              className="comments__submit-btn comments__submit-btn--sm"
              disabled={!replyText.trim() || replyLoading}
              onClick={handleReply}
            >
              {replyLoading ? '...' : 'Отправить ответ'}
            </button>
            <button
              className="comments__action-btn comments__action-btn--cancel"
              onClick={() => setReplyOpen(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="comments__replies">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              gameId={gameId}
              user={user}
              isAuthenticated={isAuthenticated}
              onReload={onReload}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Comments: React.FC<CommentsProps> = ({ gameId }) => {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    loadComments();
  }, [gameId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const flat = (await getGameComments(gameId)) as CommentWithReplies[];

      const map = new Map<number, CommentWithReplies>();
      flat.forEach((c) => {
        map.set(c.id, { ...c, replies: [] });
      });
      const roots: CommentWithReplies[] = [];
      map.forEach((c) => {
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id)!.replies!.push(c);
        } else {
          roots.push(c);
        }
      });
      setComments(roots);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuthenticated) return;
    try {
      await createGameComment(gameId, newComment);
      setNewComment('');
      await loadComments();
    } catch {}
  };

  return (
    <div className="comments">
      <h2 className="comments__title">Комментарии</h2>

      {isAuthenticated && (
        <form onSubmit={handleSubmit} className="comments__form">
          <textarea
            className="comments__input"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Напишите комментарий..."
            rows={4}
          />
          <button
            type="submit"
            className="comments__submit-btn"
            disabled={!newComment.trim()}
          >
            Опубликовать комментарий
          </button>
        </form>
      )}

      {loading ? (
        <div className="comments__loading">Загрузка комментариев...</div>
      ) : comments.length === 0 ? (
        <div className="comments__empty">
          Пока нет комментариев. Будьте первым!
        </div>
      ) : (
        <div className="comments__list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              gameId={gameId}
              user={user}
              isAuthenticated={isAuthenticated}
              onReload={loadComments}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Comments;
