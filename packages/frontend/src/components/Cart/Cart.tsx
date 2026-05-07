import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCart,
  removeFromCart,
  type CartItem,
  api,
} from '../../services/api';
import './Cart.css';

interface CartProps {
  onClose: () => void;
  onCartChange?: () => void;
  onBalanceChange?: (newBalance: number) => void;
}

const Cart = ({ onClose, onCartChange, onBalanceChange }: CartProps) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameNames, setGameNames] = useState<Record<number, string>>({});
  const [gameCovers, setGameCovers] = useState<Record<number, string>>({});
  const [gameSlugs, setGameSlugs] = useState<Record<number, string | number>>(
    {}
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const data = await getCart();
      setItems(data);
      if (data.length > 0) {
        const ids = [...new Set(data.map((i) => i.igdb_game_id))];
        try {
          const res = await api.post('/games/bulk', { ids });
          const names: Record<number, string> = {};
          const covers: Record<number, string> = {};
          const slugs: Record<number, string | number> = {};
          (res.data.games || []).forEach((g: any) => {
            names[g.id] = g.name;
            slugs[g.id] = g.slug || g.id;
            if (g.cover?.url) {
              const raw: string = g.cover.url;
              const imageId = raw.startsWith('http')
                ? raw
                    .split('/')
                    .pop()
                    ?.replace(/\.(jpg|png)$/, '')
                : raw
                    .split('/')
                    .pop()
                    ?.replace(/\.(jpg|png)$/, '');
              covers[g.id] =
                `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
            }
          });
          setGameNames(names);
          setGameCovers(covers);
          setGameSlugs(slugs);
        } catch {}
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (listingId: number) => {
    try {
      await removeFromCart(listingId);
      setItems((prev) => prev.filter((i) => i.listing_id !== listingId));
      onCartChange?.();

      window.dispatchEvent(
        new CustomEvent('cartItemRemoved', { detail: { listingId } })
      );
    } catch {}
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const res = await api.post('/orders/checkout');
      setOrderCount(res.data.orderIds?.length || 0);
      setCheckoutDone(true);
      onCartChange?.();
      if (onBalanceChange) onBalanceChange(res.data.newBalance);
    } catch (err: any) {
      setCheckoutError(
        err.response?.data?.error || 'Не удалось оформить заказ'
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const total = items.reduce((sum, i) => sum + Number(i.price), 0);
  const orderWord = (count: number) => {
    if (count === 1) return 'заказ';
    if (count >= 2 && count <= 4) return 'заказа';
    return 'заказов';
  };

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cart-panel__header">
          <h2 className="cart-panel__title">Корзина ({items.length})</h2>
          <button
            className="cart-panel__close"
            onClick={onClose}
            aria-label="Закрыть корзину"
          >
            ✕
          </button>
        </div>

        <div className="cart-panel__body">
          {loading ? (
            <p className="cart-panel__empty">Загрузка...</p>
          ) : checkoutDone ? (
            <div className="cart-checkout-success">
              <div className="cart-checkout-icon">✓</div>
              <p className="cart-checkout-title">Заказ оформлен!</p>
              <p className="cart-checkout-sub">
                Создано {orderCount} {orderWord(orderCount)}. Продавец скоро
                пришлёт вам ключ игры. Проверьте ваши заказы на странице
                профиля.
              </p>
              <button className="cart-panel__checkout-btn" onClick={onClose}>
                Закрыть
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="cart-panel__empty">Ваша корзина пуста</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="cart-item">
                <div
                  className="cart-item__cover-wrap"
                  onClick={() => {
                    onClose();
                    navigate(
                      `/game/${gameSlugs[item.igdb_game_id] || item.igdb_game_id}`
                    );
                  }}
                >
                  {gameCovers[item.igdb_game_id] ? (
                    <img
                      className="cart-item__cover"
                      src={gameCovers[item.igdb_game_id]}
                      alt={gameNames[item.igdb_game_id] || ''}
                    />
                  ) : (
                    <div className="cart-item__cover-placeholder">🎮</div>
                  )}
                </div>
                <div className="cart-item__info">
                  <p
                    className="cart-item__name"
                    onClick={() => {
                      onClose();
                      navigate(
                        `/game/${gameSlugs[item.igdb_game_id] || item.igdb_game_id}`
                      );
                    }}
                  >
                    {gameNames[item.igdb_game_id] ||
                      `Игра №${item.igdb_game_id}`}
                  </p>
                  <p
                    className="cart-item__seller"
                    onClick={() => {
                      onClose();
                      navigate(`/profile/${item.seller_profile_id}`);
                    }}
                  >
                    {item.seller_name}
                    {item.is_verified && ' ✓'}
                  </p>
                  <p className="cart-item__price">
                    ${Number(item.price).toFixed(2)}
                  </p>
                </div>
                <button
                  className="cart-item__remove"
                  onClick={() => handleRemove(item.listing_id)}
                  aria-label="Удалить из корзины"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {!checkoutDone && items.length > 0 && (
          <div className="cart-panel__footer">
            <div className="cart-panel__total">
              <span>Итого</span>
              <span className="cart-panel__total-amount">
                ${total.toFixed(2)}
              </span>
            </div>
            {checkoutError && (
              <p className="cart-checkout-error">{checkoutError}</p>
            )}
            <button
              className="cart-panel__checkout-btn"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading
                ? 'Обработка...'
                : `Оплатить $${total.toFixed(2)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
