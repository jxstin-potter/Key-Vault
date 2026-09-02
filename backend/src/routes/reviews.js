import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Product.averageRating and Product.reviewCount are denormalised so the
 * catalogue can sort by rating in SQL. They must be recomputed on every
 * review write, or ?sort=rating silently drifts out of date.
 *
 * Called after every create/update/delete below - there is no trigger doing
 * this at the database level, so a code path that writes a review without
 * calling this would leave the aggregate stale until the next write to the
 * same product.
 *
 * @param {string} productId - Product whose aggregate rating to recompute.
 * @returns {Promise<void>}
 */
async function refreshProductRating(productId) {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true }
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      averageRating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      reviewCount: agg._count.rating
    }
  });
}

/**
 * @route GET /api/reviews/product/:productId
 * @access Public
 * @description Paginated reviews for one product, each with the reviewer's
 *   first/last name.
 * @param {string} req.params.productId
 * @param {number} [req.query.page=1]
 * @param {number} [req.query.limit=10]
 * @returns {200} `{ reviews, pagination: { page, limit, total, pages } }`.
 */
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const total = await prisma.review.count({
      where: { productId }
    });

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

/**
 * @route POST /api/reviews
 * @access Authenticated
 * @description Create a review. One review per user per product, enforced
 *   by a database unique constraint on `(userId, productId)` - checked here
 *   for a friendly error message, but the constraint is the real guarantee
 *   against a race between two concurrent submissions.
 * @param {string} req.body.productId
 * @param {number} req.body.rating - 1 to 5.
 * @param {string} [req.body.comment] - Max 1000 characters.
 * @returns {201} `{ message, review }`.
 * @returns {400} Validation failed, or the caller already reviewed this product.
 * @returns {404} Product not found.
 */
router.post('/', authenticateToken, [
  body('productId').isString(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, rating, comment } = req.body;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user already reviewed this product
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId
        }
      }
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        productId,
        rating,
        comment
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    await refreshProductRating(productId);

    res.status(201).json({
      message: 'Review created successfully',
      review
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create review' });
  }
});

/**
 * @route PUT /api/reviews/:id
 * @access Authenticated (own reviews only)
 * @description Edit a review's rating/comment. Admins cannot edit other
 *   users' reviews through this endpoint (only delete them - see below);
 *   the ownership filter here has no admin bypass.
 * @param {string} req.params.id - Review id.
 * @param {number} req.body.rating - 1 to 5.
 * @param {string} [req.body.comment] - Max 1000 characters.
 * @returns {200} `{ message, review }`.
 * @returns {400} Validation failed.
 * @returns {404} No such review, or it belongs to a different user.
 */
router.put('/:id', authenticateToken, [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    // Check if review exists and belongs to user
    const review = await prisma.review.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: { rating, comment },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    await refreshProductRating(updatedReview.productId);

    res.json({
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update review' });
  }
});

/**
 * @route DELETE /api/reviews/:id
 * @access Authenticated (own reviews); admins can delete any review
 * @description Remove a review. The admin override exists so moderators can
 *   take down abusive content without needing to impersonate the author.
 * @param {string} req.params.id - Review id.
 * @returns {200} `{ message }`.
 * @returns {404} No such review, or (for a non-admin) it belongs to a
 *   different user - deliberately indistinguishable from "doesn't exist",
 *   so a non-owner probing ids learns nothing about which reviews are real.
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Authors delete their own reviews; admins can delete any. A store that
    // accepts user-generated content needs a way to remove abuse, and there
    // was previously none - the admin area could see reported reviews and do
    // nothing about them.
    const isAdmin = req.user.role === 'ADMIN';

    const review = await prisma.review.findFirst({
      where: {
        id,
        ...(isAdmin ? {} : { userId: req.user.id })
      }
    });

    // 404 rather than 403 for a review that exists but belongs to someone
    // else: a non-owner has no business learning that this id is real.
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    await prisma.review.delete({
      where: { id }
    });

    await refreshProductRating(review.productId);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete review' });
  }
});

/**
 * @route GET /api/reviews/user/me
 * @access Authenticated
 * @description Every review the caller has written, with a summary of the
 *   product each one is for.
 * @returns {200} `{ reviews }`, newest first.
 */
router.get('/user/me', authenticateToken, async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user reviews' });
  }
});

/**
 * @route GET /api/reviews/info
 * @access Public
 * @description Static usage hint for this router.
 * @returns {200} `{ message }`.
 */
router.get('/info', (req, res) => {
  res.json({
    message: 'GET /api/reviews returns reviews. Use POST, PUT, DELETE for review actions.'
  });
});

export default router; 