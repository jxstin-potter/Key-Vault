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

/**
 * Reshape a Prisma product (with `_count.gameKeys` included via
 * AVAILABLE_KEYS) into the client-facing shape, replacing the Prisma count
 * wrapper with a plain `stock` number so API consumers never see the
 * underlying query structure.
 * @param {object|null} product - A product record queried with `_count: AVAILABLE_KEYS`.
 * @returns {object|null} The same product with `_count` replaced by `stock`.
 */
const withStock = (product) => {
  if (!product) return product;
  const { _count, ...rest } = product;
  return { ...rest, stock: _count?.gameKeys ?? 0 };
};

/**
 * @route GET /api/products
 * @access Public
 * @description List active products with filtering, search, sorting, and
 *   pagination.
 * @param {number} [req.query.page=1]
 * @param {number} [req.query.limit=10] - Max 1000.
 * @param {string} [req.query.category] - Matched against category name,
 *   slug, or id (whichever the caller happens to hold).
 * @param {string} [req.query.search] - Case-insensitive match against name/description.
 * @param {number} [req.query.minPrice]
 * @param {number} [req.query.maxPrice]
 * @param {'name'|'price'|'createdAt'} [req.query.sortBy='createdAt'] - Legacy sort param.
 * @param {'asc'|'desc'} [req.query.sortOrder='desc']
 * @param {keyof SORT_OPTIONS} [req.query.sort] - Preferred sort param; takes
 *   priority over sortBy/sortOrder when present.
 * @param {string} [req.query.platform] - One of PLATFORMS.
 * @param {string} [req.query.region] - One of REGIONS.
 * @param {boolean} [req.query.inStock] - Filter to products with at least one AVAILABLE key.
 * @returns {200} `{ products, pagination: { page, limit, total, pages } }`.
 *   Each product carries a derived `stock` count, not a stored value.
 * @returns {400} A query parameter failed validation.
 */
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

/**
 * @route GET /api/products/info
 * @access Public
 * @description Static usage hint for this router.
 * @returns {200} `{ message }`.
 */
router.get('/info', (req, res) => {
  res.json({
    message: 'GET /api/products returns all products. Use POST, PUT, DELETE for admin actions.'
  });
});

/**
 * @route GET /api/products/:id
 * @access Public
 * @description Fetch one product with its reviews and derived stock. Looks
 *   up by id OR slug in one query, so both a database id and a pretty URL
 *   (`/products/elden-ring`) resolve.
 * @param {string} req.params.id - Product id or slug.
 * @returns {200} `{ product }` including nested `reviews` (with reviewer name).
 * @returns {404} No product matches that id or slug.
 */
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

/**
 * @route POST /api/products
 * @access Admin only
 * @description Create a new product listing. Note this only creates the
 *   listing itself - sellable inventory is added separately as game_keys
 *   rows (see routes/keys.js), since a product with zero keys is a valid,
 *   simply out-of-stock, listing.
 * @param {string} req.body.name
 * @param {string} req.body.description
 * @param {number} req.body.price
 * @param {string} req.body.categoryId
 * @param {string[]} req.body.images
 * @param {string} req.body.slug - URL slug, must be unique.
 * @param {string} req.body.platform - One of PLATFORMS.
 * @param {string} req.body.region - One of REGIONS.
 * @param {string} [req.body.developer]
 * @param {string} [req.body.publisher]
 * @param {string} [req.body.releaseDate] - ISO 8601 date.
 * @returns {201} `{ message, product }`.
 * @returns {400} Validation failed, or `categoryId` doesn't match a real category.
 * @returns {403} Caller is not an admin.
 */
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

/**
 * @route PUT /api/products/:id
 * @access Admin only
 * @description Partially update a product. All body fields are optional;
 *   only the fields present are changed.
 * @param {string} req.params.id - Product id.
 * @param {object} req.body - Any subset of the fields accepted by POST /,
 *   plus `isActive` to hide/show the listing without deleting it.
 * @returns {200} `{ message, product }`.
 * @returns {400} Validation failed, or a provided `categoryId` doesn't exist.
 * @returns {403} Caller is not an admin.
 * @returns {404} Product not found.
 */
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

/**
 * @route DELETE /api/products/bulk
 * @access Admin only
 * @description Soft-delete several products at once (sets `isActive: false`
 *   on each; rows are never hard-deleted, preserving order history that
 *   references them).
 * @param {string[]} req.body.productIds - At least one product id.
 * @returns {200} `{ message, deletedCount }`.
 * @returns {400} Empty array, or one or more ids don't match a real product.
 * @returns {403} Caller is not an admin.
 */
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

/**
 * @route DELETE /api/products/:id
 * @access Admin only
 * @description Soft-delete a single product (`isActive: false`), same
 *   reasoning as the bulk variant above.
 * @param {string} req.params.id - Product id.
 * @returns {200} `{ message }`.
 * @returns {403} Caller is not an admin.
 * @returns {404} Product not found.
 */
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