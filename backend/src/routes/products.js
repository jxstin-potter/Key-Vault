import express from 'express';
import { body, validationResult, query } from 'express-validator';
import prisma from '../lib/prisma.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const PLATFORMS = ['STEAM', 'EPIC', 'GOG', 'XBOX', 'PLAYSTATION', 'BATTLENET', 'UBISOFT', 'NINTENDO'];
const REGIONS = ['GLOBAL', 'NA', 'EU', 'UK', 'ASIA', 'LATAM'];

const router = express.Router();

// Stock is derived: a product's sellable inventory is its count of AVAILABLE
// game keys. Surfaced as `stock` so the client-facing shape is unchanged.
const AVAILABLE_KEYS = { select: { gameKeys: { where: { status: 'AVAILABLE' } } } };

// Maps the sort values used in the UI onto Prisma orderBy clauses. The
// homepage has always linked to ?sort=rating and ?sort=newest, neither of
// which the old name/price/createdAt whitelist accepted.
const SORT_OPTIONS = {
  name: { name: 'asc' },
  price: { price: 'asc' },
  'price-desc': { price: 'desc' },
  rating: { averageRating: 'desc' },
  newest: { createdAt: 'desc' },
  releaseDate: { releaseDate: 'desc' },
  popular: { reviews: { _count: 'desc' } }
};

const withStock = (product) => {
  if (!product) return product;
  const { _count, ...rest } = product;
  return { ...rest, stock: _count?.gameKeys ?? 0 };
};

// Get all products with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('category').optional().isString(),
  query('search').optional().isString(),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('sortBy').optional().isIn(['name', 'price', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('sort').optional().isIn(Object.keys(SORT_OPTIONS)),
  query('platform').optional().isIn(PLATFORMS),
  query('region').optional().isIn(REGIONS),
  query('inStock').optional().isBoolean().toBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 10,
      category,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      sort,
      platform,
      region,
      inStock
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      isActive: true
    };

    if (category) {
      // Accept whichever handle the caller happens to hold. The catalogue UI
      // links by name (?category=Action), Categories.jsx and shareable links
      // read better with a slug, and API clients naturally have the id.
      // Matching all three costs one indexed lookup and removes a class of
      // "why does this filter silently return nothing" bug.
      where.category = { OR: [{ name: category }, { slug: category }, { id: category }] };
    }

    if (platform) where.platform = platform;
    if (region) where.region = region;

    // Prisma cannot filter on a relation _count, but it can filter on the
    // relation itself, which is exactly the semantics we want here.
    if (inStock) {
      where.gameKeys = { some: { status: 'AVAILABLE' } };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    // Get products and total count in parallel (independent queries)
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true }
          },
          _count: AVAILABLE_KEYS
        },
        orderBy: sort ? SORT_OPTIONS[sort] : { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.product.count({ where })
    ]);

    // averageRating / reviewCount are denormalised columns, maintained in
    // routes/reviews.js. Only stock needs deriving here.
    const productsWithRating = products.map(withStock);

    res.json({
      products: productsWithRating,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Add GET /info for demo
router.get('/info', (req, res) => {
  res.json({
    message: 'GET /api/products returns all products. Use POST, PUT, DELETE for admin actions.'
  });
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Look up by id or slug. Products carry a unique slug that nothing could
    // previously resolve, so /products/elden-ring 404'd while the far uglier
    // /products/clx8k2p0a0000qw3f8h2n1m4t worked. findFirst rather than
    // findUnique because this is now a two-column OR.
    const product = await prisma.product.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        category: {
          select: { id: true, name: true }
        },
        reviews: {
          include: {
            user: {
              select: { firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: AVAILABLE_KEYS
      }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const productWithRating = withStock(product);

    res.json({ product: productWithRating });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

// Create product (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('description').trim().isLength({ min: 1 }),
  body('price').isFloat({ min: 0 }),
  body('categoryId').isString(),
  body('images').isArray(),
  body('slug').trim().isSlug(),
  body('platform').isIn(PLATFORMS),
  body('region').isIn(REGIONS),
  body('developer').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('publisher').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('releaseDate').optional({ values: 'falsy' }).isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, categoryId, images, slug,
            platform, region, developer, publisher, releaseDate } = req.body;

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(400).json({ message: 'Category not found' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        categoryId,
        images,
        slug,
        platform,
        region,
        developer: developer || null,
        publisher: publisher || null,
        releaseDate: releaseDate ? new Date(releaseDate) : null
      },
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product' });
  }
});

// Update product (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim().isLength({ min: 1 }),
  body('price').optional().isFloat({ min: 0 }),
  body('categoryId').optional().isString(),
  body('images').optional().isArray(),
  body('isActive').optional().isBoolean(),
  body('slug').optional().trim().isSlug(),
  body('platform').optional().isIn(PLATFORMS),
  body('region').optional().isIn(REGIONS),
  body('developer').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('publisher').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('releaseDate').optional({ values: 'falsy' }).isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Verify product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Verify category if provided
    if (updateData.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: updateData.categoryId }
      });

      if (!category) {
        return res.status(400).json({ message: 'Category not found' });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// Bulk delete products (admin only)
router.delete('/bulk', authenticateToken, requireAdmin, [
  body('productIds').isArray({ min: 1 }).withMessage('At least one product ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productIds } = req.body;

    // Check if all products exist
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    if (existingProducts.length !== productIds.length) {
      return res.status(400).json({ message: 'Some products not found' });
    }

    // Soft delete all products by setting isActive to false
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isActive: false }
    });

    res.json({ 
      message: `${productIds.length} products deleted successfully`,
      deletedCount: productIds.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete products' });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Soft delete by setting isActive to false
    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

export default router; 