import {
    getSellerById, getListingByGameId,
    getListingsBySellerId, getListingById,
    addToCart, removeFromCart, getCart, isInCart,
} from '../database.js';

export const getSellerProfileHandler = async (req, res) => {
    try {
        const seller = await getSellerById(parseInt(req.params.sellerId));
        if (!seller) return res.status(404).json({ error: 'Seller not found' });
        res.json({ seller });
    } catch { res.status(500).json({ error: 'Failed to get seller' }); }
};

export const getListingForGame = async (req, res) => {
    try {
        const listing = await getListingByGameId(parseInt(req.params.gameId));
        res.json({ listing: listing || null });
    } catch { res.status(500).json({ error: 'Failed to get listing' }); }
};

export const getSellerListings = async (req, res) => {
    try {
        const listings = await getListingsBySellerId(parseInt(req.params.sellerId));
        res.json({ listings });
    } catch { res.status(500).json({ error: 'Failed to get listings' }); }
};

export const getCartHandler = async (req, res) => {
    try {
        const items = await getCart(req.user.id);
        res.json({ items });
    } catch { res.status(500).json({ error: 'Failed to get cart' }); }
};

export const addToCartHandler = async (req, res) => {
    try {
        const { listingId } = req.body;
        if (!listingId) return res.status(400).json({ error: 'listingId is required' });
        const listing = await getListingById(parseInt(listingId));
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        const success = await addToCart(req.user.id, parseInt(listingId));
        if (!success) return res.status(400).json({ error: 'Already in cart' });
        res.json({ message: 'Added to cart' });
    } catch { res.status(500).json({ error: 'Failed to add to cart' }); }
};

export const removeFromCartHandler = async (req, res) => {
    try {
        const success = await removeFromCart(req.user.id, parseInt(req.params.listingId));
        if (!success) return res.status(404).json({ error: 'Item not in cart' });
        res.json({ message: 'Removed from cart' });
    } catch { res.status(500).json({ error: 'Failed to remove from cart' }); }
};

export const checkCartHandler = async (req, res) => {
    try {
        const inCart = await isInCart(req.user.id, parseInt(req.params.listingId));
        res.json({ inCart });
    } catch { res.status(500).json({ error: 'Failed to check cart' }); }
};