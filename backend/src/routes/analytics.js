import express from "express";
import prisma from "../lib/prisma.js";
import { Parser as Json2csvParser } from "json2csv";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Stock is derived from the count of AVAILABLE game keys.
const AVAILABLE_KEYS = { select: { gameKeys: { where: { status: "AVAILABLE" } } } };
const LOW_STOCK_THRESHOLD = 10;

// Which orders represent money the business actually received.
//
// An order row is created the moment someone clicks Checkout, before any
// payment is attempted, and it stays there when they abandon the tab. It also
// survives being cancelled, failing, and being refunded. Summing `total`
// across every row - which is what this file used to do - counts abandoned
// baskets and returned money as income, and reports roughly double the truth
// on a store with a normal abandonment rate.
//
// PENDING is not revenue: nobody has paid. REFUNDED is not revenue: the money
// went back. Only these two states mean funds arrived and stayed.
const REVENUE_STATUSES = ["PAID", "COMPLETED"];
const EARNED = { status: { in: REVENUE_STATUSES } };

/**
 * @route GET /api/analytics/test
 * @access Admin only
 * @description Diagnostic endpoint for confirming an admin token is
 *   recognized - echoes the resolved `req.user` back to the caller.
 * @returns {200} `{ message, user, timestamp }`.
 * @returns {403} Caller is not an admin.
 */
router.get("/test", requireAdmin, (req, res) => {
  res.json({
    message: "Admin authentication working!",
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route GET /api/analytics/overview
 * @access Admin only
 * @description The admin dashboard's headline numbers: totals, a 6-month
 *   revenue trend, top-selling products, recent activity, and 30-day
 *   growth versus the prior 30 days.
 *
 *   Every revenue and "sold" figure here is filtered to the EARNED status
 *   set (PAID/COMPLETED) - see the module-level comment on EARNED above for
 *   why an unfiltered sum over all orders roughly doubles the true number by
 *   counting abandoned checkouts as income.
 * @returns {200} `{ overview: { totalOrders, totalRevenue, totalUsers,
 *   totalProducts, orderGrowth, revenueGrowth, orderStatuses,
 *   monthlyRevenue, topProducts, recentOrders, recentUsers } }`.
 *   `orderStatuses` is intentionally unfiltered (every status, including
 *   PENDING/FAILED/CANCELLED) - that breakdown is exactly where an operator
 *   would notice a broken webhook piling up unpaid orders.
 * @returns {403} Caller is not an admin.
 */
router.get("/overview", requireAdmin, async (req, res) => {
  try {
    // Basic stats
    const totalOrders = await prisma.order.count({ where: EARNED });
    const totalRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: EARNED,
    });
    const totalUsers = await prisma.user.count({
      where: { role: "USER" },
    });
    const totalProducts = await prisma.product.count({
      where: { isActive: true },
    });

    // Order status breakdown
    const orderStatuses = await prisma.order.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    // Monthly revenue for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await prisma.order.groupBy({
      by: ["createdAt"],
      _sum: { total: true },
      where: {
        ...EARNED,
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
    });

    // Top selling products
    const topProducts = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      // Without this, a product nobody bought outranks one that sold, purely
      // on how often it was abandoned in a basket.
      where: { order: EARNED },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    // Get product details for top products
    const topProductDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            category: {
              select: { name: true },
            },
          },
        });
        return {
          ...product,
          category: product?.category?.name || "Uncategorized",
          totalSold: item._sum.quantity,
        };
      }),
    );

    // Recent activity
    const recentOrders = await prisma.order.findMany({
      take: 10,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const recentUsers = await prisma.user.findMany({
      where: { role: "USER" },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
    });

    // Calculate growth percentages (comparing last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentOrdersCount = await prisma.order.count({
      where: { ...EARNED, createdAt: { gte: thirtyDaysAgo } },
    });

    const previousOrdersCount = await prisma.order.count({
      where: {
        ...EARNED,
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      },
    });

    const recentRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: { ...EARNED, createdAt: { gte: thirtyDaysAgo } },
    });

    const previousRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        ...EARNED,
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      },
    });

    const orderGrowth =
      previousOrdersCount > 0
        ? Math.round(
            ((recentOrdersCount - previousOrdersCount) / previousOrdersCount) *
              100,
          )
        : recentOrdersCount > 0
          ? 100
          : 0;

    const revenueGrowth =
      (previousRevenue._sum.total || 0) > 0
        ? Math.round(
            ((recentRevenue._sum.total - previousRevenue._sum.total) /
              previousRevenue._sum.total) *
              100,
          )
        : (recentRevenue._sum.total || 0) > 0
          ? 100
          : 0;

    res.json({
      overview: {
        totalOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        totalUsers,
        totalProducts,
        orderGrowth,
        revenueGrowth,
        orderStatuses: orderStatuses.reduce((acc, status) => {
          acc[status.status] = status._count.status;
          return acc;
        }, {}),
        monthlyRevenue: monthlyRevenue.map((item) => ({
          month: item.createdAt.toISOString().slice(0, 7),
          revenue: item._sum.total || 0,
        })),
        topProducts: topProductDetails,
        recentOrders,
        recentUsers,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch analytics overview" });
  }
});

/**
 * @route GET /api/analytics/sales
 * @access Admin only
 * @description Sales figures over a date range, optionally filtered to one
 *   product or category, and optionally exported as a CSV instead of JSON.
 *   Like /overview, scoped to EARNED orders only - this is the report an
 *   operator would hand to an accountant, and it must not include revenue
 *   that never actually arrived.
 * @param {string} [req.query.start] - ISO date, inclusive lower bound.
 * @param {string} [req.query.end] - ISO date, inclusive upper bound (time
 *   forced to 23:59:59.999 so the end date's full day is included).
 * @param {string} [req.query.productId] - Restrict to one product.
 * @param {string} [req.query.category] - Restrict to one category, by name.
 * @param {'1'} [req.query.exportCsv] - When exactly `'1'`, responds with a
 *   `text/csv` attachment instead of JSON.
 * @returns {200} `{ sales: { dailySales, productSales } }` as JSON, or a CSV
 *   attachment (`sales-analytics.csv`) when `exportCsv=1`.
 * @returns {403} Caller is not an admin.
 */
router.get("/sales", requireAdmin, async (req, res) => {
  try {
    const { start, end, productId, category, exportCsv } = req.query;
    let startDate = start ? new Date(start) : null;
    let endDate = end ? new Date(end) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    // Build where clause for orders. Seeded with the revenue filter: this
    // endpoint also backs the CSV export, and a sales report that counts
    // abandoned baskets is worse than no report at all.
    const orderWhere = { ...EARNED };
    if (startDate)
      orderWhere.createdAt = { ...orderWhere.createdAt, gte: startDate };
    if (endDate)
      orderWhere.createdAt = { ...orderWhere.createdAt, lte: endDate };

    // Daily sales for the period
    const dailySales = await prisma.order.findMany({
      where: orderWhere,
      select: {
        createdAt: true,
        total: true,
        id: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Sales by category/product
    const orderIds = dailySales.map((o) => o.id);
    const orderItemWhere = { orderId: { in: orderIds } };
    if (productId) orderItemWhere.productId = productId;
    // Get product details for category filtering
    let productIds = undefined;
    if (category) {
      const products = await prisma.product.findMany({
        where: {
          category: {
            name: category,
          },
        },
        select: { id: true },
      });
      productIds = products.map((p) => p.id);
      orderItemWhere.productId = { in: productIds };
    }

    const salesByProduct = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true, price: true },
      where: orderItemWhere,
    });

    // Get product/category info
    const productInfo = {};
    for (const item of salesByProduct) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          name: true,
          category: {
            select: { name: true },
          },
        },
      });
      productInfo[item.productId] = product;
    }

    // Prepare CSV if requested
    if (exportCsv === "1") {
      const csvData = salesByProduct.map((item) => ({
        productId: item.productId,
        productName: productInfo[item.productId]?.name,
        category: productInfo[item.productId]?.category?.name,
        quantity: item._sum.quantity,
        revenue: item._sum.price,
      }));
      const parser = new Json2csvParser({
        fields: ["productId", "productName", "category", "quantity", "revenue"],
      });
      const csv = parser.parse(csvData);
      res.header("Content-Type", "text/csv");
      res.attachment("sales-analytics.csv");
      return res.send(csv);
    }

    // Group by day
    const dailySummary = {};
    for (const order of dailySales) {
      const date = order.createdAt.toISOString().split("T")[0];
      if (!dailySummary[date]) dailySummary[date] = { revenue: 0, orders: 0 };
      dailySummary[date].revenue += order.total;
      dailySummary[date].orders += 1;
    }

    res.json({
      sales: {
        dailySales: Object.entries(dailySummary).map(([date, data]) => ({
          date,
          ...data,
        })),
        productSales: salesByProduct.map((item) => ({
          productId: item.productId,
          productName: productInfo[item.productId]?.name,
          category: productInfo[item.productId]?.category?.name,
          quantity: item._sum.quantity,
          revenue: item._sum.price,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sales analytics" });
  }
});

/**
 * @route GET /api/analytics/users
 * @access Admin only
 * @description Signup growth over time (cumulative) plus the top 10
 *   customers by spend. "Active"/spending customers are computed from
 *   EARNED orders only, so someone who abandoned every checkout they ever
 *   started does not appear as a spending customer.
 * @returns {200} `{ users: { userGrowth, totalUsers, activeUsers,
 *   topCustomers } }`. `userGrowth` is one entry per day a signup occurred,
 *   with a running `totalUsers` total.
 * @returns {403} Caller is not an admin.
 */
router.get("/users", requireAdmin, async (req, res) => {
  try {
    // User growth over time - aggregate by date
    const userGrowthRaw = await prisma.user.findMany({
      where: {
        role: "USER",
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Group by date
    const userGrowthByDate = {};
    userGrowthRaw.forEach((user) => {
      const date = user.createdAt.toISOString().split("T")[0];
      userGrowthByDate[date] = (userGrowthByDate[date] || 0) + 1;
    });

    // Convert to cumulative growth
    const userGrowth = [];
    let cumulative = 0;
    Object.entries(userGrowthByDate).forEach(([date, count]) => {
      cumulative += count;
      userGrowth.push({
        date,
        newUsers: count,
        totalUsers: cumulative,
      });
    });

    // User activity (users with orders)
    const activeUsers = await prisma.order.groupBy({
      by: ["userId"],
      _count: { id: true },
      _sum: { total: true },
      // A customer who filled a basket and left has spent nothing, and should
      // not appear alongside customers who actually paid.
      where: EARNED,
    });

    // Get user details for active users
    const activeUserDetails = await Promise.all(
      activeUsers.map(async (user) => {
        const userInfo = await prisma.user.findUnique({
          where: { id: user.userId },
          select: {
            firstName: true,
            lastName: true,
            email: true,
            createdAt: true,
          },
        });
        return {
          ...userInfo,
          orderCount: user._count.id,
          totalSpent: user._sum.total || 0,
        };
      }),
    );

    // Top customers
    const topCustomers = activeUserDetails
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    res.json({
      users: {
        userGrowth,
        totalUsers: await prisma.user.count({ where: { role: "USER" } }),
        activeUsers: activeUserDetails.length,
        topCustomers,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user analytics" });
  }
});

/**
 * @route GET /api/analytics/products
 * @access Admin only
 * @description Per-product sales performance, a low-stock list, and revenue
 *   rolled up by category. Sales figures (`totalSold`, `totalRevenue`,
 *   `orderCount`) are scoped to EARNED orders; stock figures (`stock`,
 *   `lowStockProducts`) are the live AVAILABLE key count and are unrelated
 *   to order status.
 * @returns {200} `{ products: { productPerformance, lowStockProducts,
 *   categoryPerformance } }`. `lowStockProducts` includes any active
 *   product with `stock <= LOW_STOCK_THRESHOLD` (10), sorted lowest first.
 * @returns {403} Caller is not an admin.
 */
router.get("/products", requireAdmin, async (req, res) => {
  try {
    // Product performance
    const productPerformance = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true, price: true },
      _count: { id: true },
      where: { order: EARNED },
    });

    // Get product details
    const productDetails = await Promise.all(
      productPerformance.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            price: true,
            category: {
              select: { name: true },
            },
            images: true,
            _count: AVAILABLE_KEYS,
          },
        });
        return {
          ...product,
          _count: undefined,
          stock: product?._count?.gameKeys ?? 0,
          category: product?.category?.name || "Uncategorized",
          totalSold: item._sum.quantity,
          totalRevenue: item._sum.price,
          orderCount: item._count.id,
        };
      }),
    );

    // Low stock products. Prisma cannot filter on a relation _count, so fetch
    // the counts and narrow in JS - the catalogue is small enough for this.
    const productsWithKeyCounts = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        category: {
          select: { name: true },
        },
        _count: AVAILABLE_KEYS,
      },
    });

    const lowStockProductsWithCategory = productsWithKeyCounts
      .map(({ _count, ...product }) => ({
        ...product,
        stock: _count.gameKeys,
        category: product.category?.name || "Uncategorized",
      }))
      .filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock - b.stock);

    // Category performance
    const categoryPerformance = productDetails.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = { quantity: 0, revenue: 0, products: 0 };
      }
      acc[product.category].quantity += product.totalSold;
      acc[product.category].revenue += product.totalRevenue;
      acc[product.category].products += 1;
      return acc;
    }, {});

    res.json({
      products: {
        productPerformance: productDetails.sort(
          (a, b) => b.totalSold - a.totalSold,
        ),
        lowStockProducts: lowStockProductsWithCategory,
        categoryPerformance: Object.entries(categoryPerformance).map(
          ([category, data]) => ({
            category,
            totalSold: data.quantity,
            totalRevenue: data.revenue,
            productCount: data.products,
          }),
        ),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch product analytics" });
  }
});

export default router;
