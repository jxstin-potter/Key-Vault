import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/categories
 * @access Public
 * @description List all categories with a product count. Soft-deleted
 *   (isActive: false) products are excluded from the count so a genre
 *   doesn't look more populated than what's actually browsable.
 * @returns {200} `{ categories }` - each with `productCount`, sorted by name.
 */
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          // Soft-deleted games remain in the table with isActive false;
          // counting them would inflate the genre totals shoppers see.
          select: { products: { where: { isActive: true } } }
        }
      },
      orderBy: { name: 'asc' }
    });

    const categoriesWithCount = categories.map(category => ({
      ...category,
      productCount: category._count.products,
      _count: undefined
    }));

    res.json({ categories: categoriesWithCount });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

/**
 * @route GET /api/categories/info
 * @access Public
 * @description Static usage hint for this router.
 * @returns {200} `{ message }`.
 */
router.get('/info', (req, res) => {
  res.json({
    message: 'GET /api/categories returns all categories. Use POST, PUT, DELETE for admin actions.'
  });
});

/**
 * @route GET /api/categories/:id
 * @access Public
 * @description Fetch one category with its active products, each carrying
 *   a live-computed `averageRating` and `reviewCount`. Unlike
 *   routes/products.js, these ratings are computed here from the raw
 *   `reviews` relation rather than read from the denormalised columns on
 *   the product row.
 * @param {string} req.params.id - Category id.
 * @returns {200} `{ category }`.
 * @returns {404} Category not found.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          where: { isActive: true },
          include: {
            reviews: {
              select: { rating: true }
            },
            _count: {
              select: { reviews: true }
            }
          }
        },
        _count: {
          select: { products: true }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Calculate average rating for each product
    const productsWithRating = category.products.map(product => {
      const avgRating = product.reviews.length > 0
        ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
        : 0;

      return {
        ...product,
        averageRating: Math.round(avgRating * 10) / 10,
        reviewCount: product._count.reviews,
        reviews: undefined,
        _count: undefined
      };
    });

    const categoryWithProducts = {
      ...category,
      products: productsWithRating,
      productCount: category._count.products,
      _count: undefined
    };

    res.json({ category: categoryWithProducts });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});

/**
 * @route POST /api/categories
 * @access Admin only
 * @description Create a new category. Names must be unique.
 * @param {string} req.body.name - 1-100 characters.
 * @param {string} [req.body.description] - Max 500 characters.
 * @param {string} [req.body.image] - Must be a valid URL.
 * @returns {201} `{ message, category }`.
 * @returns {400} Validation failed, or the name is already in use.
 * @returns {403} Caller is not an admin.
 */
router.post('/', authenticateToken, requireAdmin, [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('image').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, image } = req.body;

    // Check if category already exists
    const existingCategory = await prisma.category.findUnique({
      where: { name }
    });

    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = await prisma.category.create({
      data: { name, description, image }
    });

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create category' });
  }
});

/**
 * @route PUT /api/categories/:id
 * @access Admin only
 * @description Update a category. If `name` is changing, the new name is
 *   checked for a collision with another category before writing.
 * @param {string} req.params.id - Category id.
 * @param {string} [req.body.name]
 * @param {string} [req.body.description]
 * @param {string} [req.body.image]
 * @returns {200} `{ message, category }`.
 * @returns {400} Validation failed, or the new name collides with another category.
 * @returns {403} Caller is not an admin.
 * @returns {404} Category not found.
 */
router.put('/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('image').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if name is being updated and if it already exists
    if (updateData.name && updateData.name !== existingCategory.name) {
      const nameExists = await prisma.category.findUnique({
        where: { name: updateData.name }
      });

      if (nameExists) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update category' });
  }
});

/**
 * @route DELETE /api/categories/:id
 * @access Admin only
 * @description Hard-delete a category. Unlike products (soft-deleted), a
 *   category is actually removed - but only if it has zero products, so
 *   deleting a category can never orphan a product's category reference.
 * @param {string} req.params.id - Category id.
 * @returns {200} `{ message }`.
 * @returns {400} Category still has one or more products attached.
 * @returns {403} Caller is not an admin.
 * @returns {404} Category not found.
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has products
    if (category._count.products > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with existing products' 
      });
    }

    await prisma.category.delete({
      where: { id }
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

export default router; 