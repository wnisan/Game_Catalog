import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getListingForGame, addToCart, checkInCart, updateListingPrice, type Listing } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import ChatModal from '../Chat/ChatModal';
import AuthPromptModal from '../AuthPromptModal/AuthPromptModal';
import './SellerBlock.css';

interface SellerBlockProps {
    gameId: number;
    gameName?: string;
    onCartChange?: () => void;
    onOpenCart?: () => void;
    onUnreadChange?: (count: number) => void;
}

const SellerBlock = ({ gameId, gameName = '', onCartChange, onOpenCart, onUnreadChange }: SellerBlockProps) => {
    const { isAuthenticated, user } = useAuth();
    const [listing, setListing] = useState<Listing | null | undefined>(undefined);
    const [inCart, setInCart] = useState(false);
    const [loading, setLoading] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);

    const [editingPrice, setEditingPrice] = useState(false);
    const [priceInput, setPriceInput] = useState('');
    const [priceLoading, setPriceLoading] = useState(false);

    useEffect(() => {
        // всегда загружаем листинг — даже для неавторизованных
        getListingForGame(gameId)
            .then(l => {
                setListing(l);
                if (l && isAuthenticated) {
                    checkInCart(l.id).then(setInCart).catch(() => { });
                }
            })
            .catch(() => setListing(null));
    }, [gameId, isAuthenticated]);


    useEffect(() => {
        const handler = (e: Event) => {
            const { listingId } = (e as CustomEvent).detail;
            if (listing && listing.id === listingId) setInCart(false);
        };
        window.addEventListener('cartItemRemoved', handler);
        return () => window.removeEventListener('cartItemRemoved', handler);
    }, [listing]);

    const requireAuth = () => {
        setShowAuthPrompt(true);
    };

    const handleAddToCart = async () => {
        if (!isAuthenticated) { requireAuth(); return; }
        if (!listing) return;
        setLoading(true);
        try {
            await addToCart(listing.id);
            setInCart(true);
            onCartChange?.();
            onOpenCart?.();
        } catch { }
        finally { setLoading(false); }
    };

    const handleChat = () => {
        if (!isAuthenticated) { requireAuth(); return; }
        if (isOwnListing) return; // нельзя писать самому себе
        setChatOpen(true);
    };

    const handleSavePrice = async () => {
        if (!listing) return;
        const price = parseFloat(priceInput);
        if (isNaN(price) || price <= 0) return;
        setPriceLoading(true);
        try {
            await updateListingPrice(listing.id, price);
            setListing({ ...listing, price });
            setEditingPrice(false);
        } catch { }
        finally { setPriceLoading(false); }
    };

    const isOwnListing = listing && user?.role === 'seller' && listing.seller_user_id === user.id;
    const isAdmin = user?.role === 'admin';
    const canEditPrice = isOwnListing || (isAdmin && listing);

    if (listing === undefined) return null;

    return (
        <div className="seller-block">

            <div className="seller-block__header-row">
                <p className="seller-block__title">Купить Steam-ключ</p>
                <p className="seller-block__seller-label">Продавец</p>
            </div>

            {!listing ? (
                <p className="seller-block__no-listing">Пока нет продавцов для этой игры.</p>
            ) : (
                <>
                    <div className="seller-block__main-row">
                        { }
                        <div className="seller-block__left">
                            {canEditPrice && editingPrice ? (
                                <div className="seller-block__price-edit">
                                    <input
                                        className="seller-block__price-input"
                                        type="number" min="0.01" step="0.01"
                                        value={priceInput}
                                        onChange={e => setPriceInput(e.target.value)}
                                        autoFocus
                                    />
                                    <button className="seller-block__save-btn" disabled={priceLoading} onClick={handleSavePrice}>
                                        {priceLoading ? '...' : 'Сохранить'}
                                    </button>
                                    <button className="seller-block__cancel-btn" onClick={() => setEditingPrice(false)}>Отмена</button>
                                </div>
                            ) : (
                                <div className="seller-block__price-display">
                                    <span className="seller-block__price">${Number(listing.price).toFixed(2)}</span>
                                    {canEditPrice && (
                                        <button className="seller-block__edit-price-btn"
                                            onClick={() => { setPriceInput(Number(listing.price).toFixed(2)); setEditingPrice(true); }}>
                                            Изменить
                                        </button>
                                    )}
                                </div>
                            )}

                            {!isOwnListing && (
                                <button
                                    className={`seller-block__buy-btn ${inCart ? 'seller-block__buy-btn--in-cart' : ''}`}
                                    onClick={inCart ? () => { onCartChange?.(); onOpenCart?.(); } : handleAddToCart}
                                    disabled={loading}
                                >
                                    {inCart ? '✓ В корзине' : loading ? 'Добавление...' : 'Добавить в корзину'}
                                </button>
                            )}
                        </div>

                        { }
                        <div className="seller-block__seller-card">
                            <div className="seller-block__seller-row">
                                <Link to={`/profile/${listing.seller_user_id}`} className="seller-block__seller-link">
                                    {listing.seller_name}
                                </Link>
                                {listing.is_verified && <span className="seller-block__verified">✓</span>}
                                {listing.seller_rating > 0 && (
                                    <span className="seller-block__rating">★ {Number(listing.seller_rating).toFixed(1)}</span>
                                )}
                            </div>
                            {!isOwnListing && (
                                <button className="seller-block__chat-btn" onClick={handleChat}>
                                    💬 Чат с {listing.seller_name}
                                </button>
                            )}
                        </div>
                    </div>

                    {showAuthPrompt && (
                        <AuthPromptModal onClose={() => setShowAuthPrompt(false)} message="Войдите, чтобы покупать игры и общаться с продавцами." />
                    )}

                    {chatOpen && listing && (
                        <ChatModal
                            sellerUserId={listing.seller_user_id}
                            sellerName={listing.seller_name}
                            igdbGameId={gameId}
                            gameName={gameName}
                            onClose={() => setChatOpen(false)}
                            onUnreadChange={onUnreadChange}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default SellerBlock;
