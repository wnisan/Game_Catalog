import { Request, Response } from 'express';
import {
    getSellerById, getListingByGameId,
    getListingsBySellerId, getListingById,
    addToCart, removeFromCart, getCart, isInCart,
} from '../database.js';

interface ErrorResponse {
    error: string;
}

interface MessageResponse {
    message: string;
}

export const getSellerProfileHandler = async (req: Request<{ sellerId: string }>, res: Response): Promise<void> => {
    try {
        const seller = await getSellerById(Number(req.params.sellerId));
        if (!seller) {
            res.status(404).json({ error: 'Seller not found' });
            return;
        }
        res.json({ seller });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get seller' } satisfies ErrorResponse);
    }
};

export const getListingForGame = async (req: Request<{ gameId: string }>, res: Response): Promise<void> => {
    try {
        const listing = await getListingByGameId(Number(req.params.gameId));
        res.json({ listing: listing || null });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get listing' } satisfies ErrorResponse);
    }
};

export const getSellerListings = async (req: Request<{ sellerId: string }>, res: Response): Promise<void> => {
    try {
        const listings = await getListingsBySellerId(Number(req.params.sellerId));
        res.json({ listings });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get listings' } satisfies ErrorResponse);
    }
};

export const getCartHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const items = await getCart(req.user.id);
        res.json({ items });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to get cart' } satisfies ErrorResponse);
    }
};

export const addToCartHandler = async (req: Request<Record<string, never>, unknown, { listingId?: unknown }>, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const listingIdRaw = req.body?.listingId;
        if (listingIdRaw === undefined || listingIdRaw === null) {
            res.status(400).json({ error: 'listingId is required' });
            return;
        }

        const listingId = Number(listingIdRaw);
        if (Number.isNaN(listingId)) {
            res.status(400).json({ error: 'listingId must be a number' });
            return;
        }

        const listing = await getListingById(listingId);
        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        const success = await addToCart(req.user.id, listingId);
        if (!success) {
            res.status(400).json({ error: 'Already in cart' });
            return;
        }

        res.json({ message: 'Added to cart' } satisfies MessageResponse);
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to add to cart' } satisfies ErrorResponse);
    }
};

export const removeFromCartHandler = async (req: Request<{ listingId: string }>, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const success = await removeFromCart(req.user.id, Number(req.params.listingId));
        if (!success) {
            res.status(404).json({ error: 'Item not in cart' });
            return;
        }

        res.json({ message: 'Removed from cart' } satisfies MessageResponse);
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to remove from cart' } satisfies ErrorResponse);
    }
};

export const checkCartHandler = async (req: Request<{ listingId: string }>, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const inCart = await isInCart(req.user.id, Number(req.params.listingId));
        res.json({ inCart });
    } catch (_error: unknown) {
        res.status(500).json({ error: 'Failed to check cart' } satisfies ErrorResponse);
    }
};
