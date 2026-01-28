import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getGameComments, createGameComment, updateComment, deleteComment, type Comment } from '../../services/api';
import './Comments.css';

interface CommentsProps {
    gameId: number;
}

const Comments: React.FC<CommentsProps> = ({ gameId }) => {
    const { isAuthenticated, user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');

    useEffect(() => {
        loadComments();
    }, [gameId]);

    const loadComments = async () => {
        try {
            setLoading(true);
            const data = await getGameComments(gameId);
            setComments(data);
        } catch (error) {
            console.error('Error loading comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !isAuthenticated) return;

        try {
            await createGameComment(gameId, newComment);
            await loadComments();
            setNewComment('');
        } catch (error) {
            console.error('Error creating comment:', error);
        }
    };

    const handleEdit = (comment: Comment) => {
        setEditingId(comment.id);
        setEditText(comment.comment_text);
    };

    const handleUpdate = async (commentId: number) => {
        if (!editText.trim()) return;

        try {
            const updatedComment = await updateComment(commentId, editText);
            setComments(prev =>
                prev.map(c => c.id === commentId ? updatedComment : c)
            );
            setEditingId(null);
            setEditText('');
        } catch (error) {
            console.error('Error updating comment:', error);
        }
    };

    const handleDelete = async (commentId: number) => {
        if (!confirm('Are you sure you want to delete this comment?')) return;

        try {
            await deleteComment(commentId);
            await loadComments();
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="comments">
            <h2 className="comments__title">Comments</h2>

            {isAuthenticated && (
                <form onSubmit={handleSubmit} className="comments__form">
                    <textarea
                        className="comments__input"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write your comment..."
                        rows={4}
                    />
                    <button type="submit" className="comments__submit-btn" disabled={!newComment.trim()}>
                        Post Comment
                    </button>
                </form>
            )}

            {loading ? (
                <div className="comments__loading">Loading comments...</div>
            ) : comments.length === 0 ? (
                <div className="comments__empty">No comments yet. Be the first to comment!</div>
            ) : (
                <div className="comments__list">
                    {comments.map(comment => (
                        <div key={comment.id} className="comments__item">
                            <div className="comments__header">
                                <div className="comments__author">
                                    <strong>{comment.user_name}</strong>
                                    <span className="comments__date">{formatDate(comment.created_at)}</span>
                                </div>
                                {isAuthenticated && user && user.id === comment.user_id && (
                                    <div className="comments__actions">
                                        {editingId === comment.id ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdate(comment.id)}
                                                    className="comments__action-btn comments__action-btn--save"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingId(null);
                                                        setEditText('');
                                                    }}
                                                    className="comments__action-btn comments__action-btn--cancel"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleEdit(comment)}
                                                    className="comments__action-btn comments__action-btn--edit"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(comment.id)}
                                                    className="comments__action-btn comments__action-btn--delete"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            {editingId === comment.id ? (
                                <textarea
                                    className="comments__edit-input"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={3}
                                />
                            ) : (
                                <p className="comments__text">{comment.comment_text}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Comments;
