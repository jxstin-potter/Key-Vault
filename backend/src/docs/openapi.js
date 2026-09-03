/**
 * OpenAPI 3.1 description of the KeyVault API.
 *
 * This replaces a hand-maintained JSON blob that used to live in server.js and
 * had already drifted - it advertised neither /api/keys nor /api/checkout, the
 * two routes that make this a key marketplace rather than a generic store.
 *
 * Drift is now a test failure rather than a discovery: docs.test.js walks the
 * Express router stack and asserts every mounted path appears here. Adding a
 * route without documenting it turns CI red.
 */

const bearerAuth = [{ bearerAuth: [] }];

// ---------------------------------------------------------------------------
// Reusable pieces
// ---------------------------------------------------------------------------

const schemas = {
  Error: {
    type: 'object',
    properties: {
      message: { type: 'string', example: 'Something went wrong' },
      success: { type: 'boolean', example: false }
    }
  },

  ValidationError: {
    type: 'object',
    properties: {
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            msg: { type: 'string', example: 'Please provide a valid email address' },
            path: { type: 'string', example: 'email' },
            location: { type: 'string', example: 'body' }
          }
        }
      }
    }
  },

  User: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'clx8k2p0a0000qw3f8h2n1m4t' },
      email: { type: 'string', format: 'email', example: 'user@keyvault.com' },
      firstName: { type: 'string', nullable: true, example: 'Ada' },
      lastName: { type: 'string', nullable: true, example: 'Lovelace' },
      role: { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },

  AuthResponse: {
    type: 'object',
    properties: {
      message: { type: 'string', example: 'Login successful' },
      user: { $ref: '#/components/schemas/User' },
      token: {
        type: 'string',
        description: 'JWT, valid for 7 days. Send as `Authorization: Bearer <token>`.'
      }
    }
  },

  Category: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string', example: 'Action' },
      slug: { type: 'string', nullable: true, example: 'action' },
      description: { type: 'string', nullable: true },
      image: { type: 'string', nullable: true },
      icon: { type: 'string', nullable: true, description: 'lucide-react icon name', example: 'Swords' },
      tagline: { type: 'string', nullable: true }
    }
  },

  Product: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string', example: 'Elden Ring' },
      slug: { type: 'string', example: 'elden-ring' },
      description: { type: 'string' },
      price: { type: 'string', description: 'Decimal(10,2) serialised as a string', example: '59.99' },
      images: { type: 'array', items: { type: 'string', format: 'uri' } },
      isActive: { type: 'boolean' },
      platform: {
        type: 'string',
        enum: ['STEAM', 'EPIC', 'GOG', 'XBOX', 'PLAYSTATION', 'BATTLENET', 'UBISOFT', 'NINTENDO']
      },
      region: { type: 'string', enum: ['GLOBAL', 'NA', 'EU', 'UK', 'ASIA', 'LATAM'] },
      developer: { type: 'string', nullable: true },
      publisher: { type: 'string', nullable: true },
      releaseDate: { type: 'string', format: 'date-time', nullable: true },
      averageRating: { type: 'number', format: 'float', example: 4.6 },
      reviewCount: { type: 'integer', example: 128 },
      category: { $ref: '#/components/schemas/Category' },
      stock: {
        type: 'integer',
        description:
          'Derived, never stored: the count of game keys in AVAILABLE status. A product with zero is sold out.',
        example: 42
      }
    }
  },

  GameKey: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      code: { type: 'string', example: 'ABCDE-FGHJK-LMNPQ' },
      status: { type: 'string', enum: ['AVAILABLE', 'RESERVED', 'SOLD', 'REVOKED'] },
      soldAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },

  CartItem: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      quantity: { type: 'integer', example: 1 },
      product: { $ref: '#/components/schemas/Product' }
    }
  },

  OrderItem: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      quantity: { type: 'integer' },
      price: { type: 'string', description: 'Price captured at purchase time, not the current price' },
      product: { $ref: '#/components/schemas/Product' },
      gameKeys: { type: 'array', items: { $ref: '#/components/schemas/GameKey' } }
    }
  },

  Order: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      status: {
        type: 'string',
        enum: ['PENDING', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'],
        description:
          'PENDING is created at checkout with keys held; COMPLETED means paid and keys delivered. FAILED, CANCELLED and REFUNDED are terminal.'
      },
      total: { type: 'string', example: '59.99' },
      paidAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      orderItems: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } }
    }
  },

  Review: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      rating: { type: 'integer', minimum: 1, maximum: 5 },
      comment: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      user: { $ref: '#/components/schemas/User' }
    }
  }
};

const responses = {
  Unauthorized: {
    description: 'Missing, malformed, or expired bearer token.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
  },
  Forbidden: {
    description: 'Authenticated, but the account is not an admin.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
  },
  NotFound: {
    description: 'No such record.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
  },
  ValidationFailed: {
    description: 'Request body failed validation.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } }
  }
};

/**
 * Endpoints that exist purely so a browser GET explains how to POST.
 * Several routers (auth, cart, orders, products, categories, reviews, users)
 * expose a plain-text usage hint at their base path or /info for anyone who
 * navigates there directly; this generates the matching OpenAPI path entry.
 * @param {string} summary - Short OpenAPI summary for this hint endpoint.
 * @returns {object} An OpenAPI path-item object with a single documented GET.
 */
const postOnlyHint = (summary) => ({
  get: {
    tags: ['Meta'],
    summary,
    description:
      'Convenience hint for anyone who opens the URL in a browser. Returns guidance, never data.',
    responses: { 200: { description: 'Usage hint.' } }
  }
});

/**
 * A reusable OpenAPI path-parameter definition for an id segment
 * (`/resource/:id`), so every route documenting one doesn't repeat the
 * same shape.
 * @param {string} [name='id'] - Path parameter name.
 * @param {string} [description='Record id'] - Parameter description.
 * @returns {object} An OpenAPI parameter object.
 */
const idParam = (name = 'id', description = 'Record id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description
});

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const paths = {
  '/': {
    get: {
      tags: ['Meta'],
      summary: 'Service banner',
      responses: { 200: { description: 'Name, version, and a pointer to the docs.' } }
    }
  },

  '/health': {
    get: {
      tags: ['Meta'],
      summary: 'Liveness probe',
      description:
        'Reports that the process is up. Deliberately does not touch the database - a transient database fault should not cause the platform to restart an otherwise healthy instance. Use /health/ready for the dependency check.',
      responses: { 200: { description: 'Process is alive.' } }
    }
  },

  '/health/ready': {
    get: {
      tags: ['Meta'],
      summary: 'Readiness probe',
      description: 'Round-trips a `SELECT 1` against Postgres.',
      responses: {
        200: { description: 'Database reachable.' },
        503: { description: 'Database unreachable.' }
      }
    }
  },

  '/api': {
    get: { tags: ['Meta'], summary: 'API index', responses: { 200: { description: 'Version and links.' } } }
  },

  '/api/docs': {
    get: { tags: ['Meta'], summary: 'Interactive API reference', responses: { 200: { description: 'Swagger UI.' } } }
  },

  '/api/docs.json': {
    get: { tags: ['Meta'], summary: 'This OpenAPI document', responses: { 200: { description: 'OpenAPI 3.1 JSON.' } } }
  },

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  '/api/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Create an account',
      description: 'Passwords are hashed with bcrypt at cost 12. Returns a token, so no second login round trip is needed.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 6 },
                firstName: { type: 'string' },
                lastName: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Account created.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } }
        },
        400: { $ref: '#/components/responses/ValidationFailed' }
      }
    },
    ...postOnlyHint('Registration usage hint')
  },

  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Exchange credentials for a JWT',
      description:
        'Rate limited to 20 failed attempts per 15 minutes per IP. Successful logins are not counted, so a legitimate user is never locked out by their own activity.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Authenticated.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } }
        },
        401: {
          description:
            'Invalid credentials. Deliberately identical whether the email is unknown or the password is wrong, so the response cannot be used to enumerate accounts.'
        },
        429: { description: 'Too many failed attempts.' }
      }
    },
    ...postOnlyHint('Login usage hint')
  },

  '/api/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'The authenticated user',
      security: bearerAuth,
      responses: {
        200: { description: 'Current user.', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        401: { $ref: '#/components/responses/Unauthorized' }
      }
    }
  },

  '/api/auth/profile': {
    put: {
      tags: ['Auth'],
      summary: 'Update your own name',
      security: bearerAuth,
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { firstName: { type: 'string' }, lastName: { type: 'string' } }
            }
          }
        }
      },
      responses: {
        200: { description: 'Updated.' },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' }
      }
    }
  },

  // -------------------------------------------------------------------------
  // Catalogue
  // -------------------------------------------------------------------------
  '/api/products': {
    get: {
      tags: ['Products'],
      summary: 'Browse the catalogue',
      description: 'Public. `stock` on each product is derived from AVAILABLE key count, not a stored column.',
      parameters: [
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Matches name and description.' },
        { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category id or slug.' },
        { name: 'platform', in: 'query', schema: { type: 'string' } },
        { name: 'region', in: 'query', schema: { type: 'string' } },
        { name: 'minPrice', in: 'query', schema: { type: 'number' } },
        { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
        { name: 'sort', in: 'query', schema: { type: 'string' } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } }
      ],
      responses: {
        200: {
          description: 'A page of products.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'integer' },
                      limit: { type: 'integer' },
                      total: { type: 'integer' },
                      pages: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    post: {
      tags: ['Products'],
      summary: 'Create a product (admin)',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'description', 'price', 'categoryId'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                price: { type: 'number' },
                categoryId: { type: 'string' },
                images: { type: 'array', items: { type: 'string' } },
                platform: { type: 'string' },
                region: { type: 'string' },
                developer: { type: 'string' },
                publisher: { type: 'string' },
                isActive: { type: 'boolean' }
              }
            }
          }
        }
      },
      responses: {
        201: { description: 'Created.' },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' }
      }
    }
  },

  '/api/products/{id}': {
    get: {
      tags: ['Products'],
      summary: 'One product by id or slug',
      parameters: [idParam('id', 'Product id or slug')],
      responses: {
        200: { description: 'Product.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
        404: { $ref: '#/components/responses/NotFound' }
      }
    },
    put: {
      tags: ['Products'],
      summary: 'Update a product (admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'Product id')],
      responses: {
        200: { description: 'Updated.' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' }
      }
    },
    delete: {
      tags: ['Products'],
      summary: 'Delete a product (admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'Product id')],
      responses: {
        200: { description: 'Deleted.' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' }
      }
    }
  },

  '/api/products/bulk': {
    delete: {
      tags: ['Products'],
      summary: 'Delete several products (admin)',
      security: bearerAuth,
      requestBody: {
        content: {
          'application/json': {
            schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } }
          }
        }
      },
      responses: {
        200: { description: 'Deleted.' },
        403: { $ref: '#/components/responses/Forbidden' }
      }
    }
  },

  '/api/products/info': postOnlyHint('Product endpoint usage hint'),

  '/api/categories': {
    get: {
      tags: ['Categories'],
      summary: 'List categories (genres)',
      responses: {
        200: {
          description: 'Categories with product counts.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Category' } }
            }
          }
        }
      }
    },
    post: {
      tags: ['Categories'],
      summary: 'Create a category (admin)',
      security: bearerAuth,
      responses: { 201: { description: 'Created.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/categories/{id}': {
    get: {
      tags: ['Categories'],
      summary: 'One category',
      parameters: [idParam('id', 'Category id or slug')],
      responses: { 200: { description: 'Category.' }, 404: { $ref: '#/components/responses/NotFound' } }
    },
    put: {
      tags: ['Categories'],
      summary: 'Update a category (admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'Category id')],
      responses: { 200: { description: 'Updated.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    },
    delete: {
      tags: ['Categories'],
      summary: 'Delete a category (admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'Category id')],
      responses: { 200: { description: 'Deleted.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/categories/info': postOnlyHint('Category endpoint usage hint'),

  // -------------------------------------------------------------------------
  // Cart
  // -------------------------------------------------------------------------
  '/api/cart': {
    get: {
      tags: ['Cart'],
      summary: 'The caller\'s cart',
      security: bearerAuth,
      responses: {
        200: {
          description: 'Cart contents.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: { type: 'array', items: { $ref: '#/components/schemas/CartItem' } },
                  total: { type: 'number' }
                }
              }
            }
          }
        },
        401: { $ref: '#/components/responses/Unauthorized' }
      }
    }
  },

  '/api/cart/add': {
    post: {
      tags: ['Cart'],
      summary: 'Add a product to the cart',
      security: bearerAuth,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['productId'],
              properties: { productId: { type: 'string' }, quantity: { type: 'integer', default: 1 } }
            }
          }
        }
      },
      responses: {
        200: { description: 'Added.' },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' }
      }
    }
  },

  '/api/cart/update/{itemId}': {
    put: {
      tags: ['Cart'],
      summary: 'Change a line quantity',
      security: bearerAuth,
      parameters: [idParam('itemId', 'Cart item id')],
      responses: { 200: { description: 'Updated.' }, 401: { $ref: '#/components/responses/Unauthorized' } }
    }
  },

  '/api/cart/remove/{itemId}': {
    delete: {
      tags: ['Cart'],
      summary: 'Remove a line',
      security: bearerAuth,
      parameters: [idParam('itemId', 'Cart item id')],
      responses: { 200: { description: 'Removed.' }, 401: { $ref: '#/components/responses/Unauthorized' } }
    }
  },

  '/api/cart/clear': {
    delete: {
      tags: ['Cart'],
      summary: 'Empty the cart',
      security: bearerAuth,
      responses: { 200: { description: 'Cleared.' }, 401: { $ref: '#/components/responses/Unauthorized' } }
    }
  },

  '/api/cart/info': postOnlyHint('Cart endpoint usage hint'),

  // -------------------------------------------------------------------------
  // Checkout
  // -------------------------------------------------------------------------
  '/api/checkout/session': {
    post: {
      tags: ['Checkout'],
      summary: 'Reserve keys and open a Stripe Checkout session',
      security: bearerAuth,
      description: [
        'The critical path of the whole system. In one transaction it creates a PENDING order and moves one game key per unit from AVAILABLE to RESERVED, then opens a Stripe session against that frozen basket.',
        '',
        'Prices are read from the database; anything the client sends is ignored.',
        '',
        'The reservation outlives the Stripe session on purpose (35 minutes against 30), so it is never possible to pay for a key that has already been released back to the pool.',
        '',
        'Returns 503 rather than failing hard when Stripe is not configured, so the rest of the store keeps working.'
      ].join('\n'),
      responses: {
        200: {
          description: 'Session created.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'Redirect the browser here.' },
                  orderId: { type: 'string' }
                }
              }
            }
          }
        },
        400: { description: 'Cart is empty or contains nothing purchasable.' },
        401: { $ref: '#/components/responses/Unauthorized' },
        409: { description: 'Not enough keys in stock for one of the items.' },
        503: { description: 'Payments are not configured on this server.' }
      }
    }
  },

  '/api/checkout/by-session/{sessionId}': {
    get: {
      tags: ['Checkout'],
      summary: 'Poll an order by Stripe session id',
      security: bearerAuth,
      description:
        'Read-only by design. Fulfilment happens in the webhook, so a customer who closes the tab before the redirect still receives their keys; this endpoint only reports what the webhook has already done.',
      parameters: [idParam('sessionId', 'Stripe Checkout session id')],
      responses: {
        200: { description: 'Order, including delivered keys once fulfilled.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' }
      }
    }
  },

  '/api/webhooks/stripe': {
    post: {
      tags: ['Checkout'],
      summary: 'Stripe webhook receiver',
      description: [
        'Where fulfilment actually happens. Mounted with a raw body parser above the global JSON parser, because signature verification hashes the exact bytes Stripe sent.',
        '',
        'Handles checkout.session.completed, async_payment_succeeded, async_payment_failed, checkout.session.expired, and charge.refunded.',
        '',
        'Idempotent: a duplicate delivery finds the order already COMPLETED and returns without issuing a second set of keys. Only a bad signature earns a 4xx - every other failure returns 5xx so Stripe retries.'
      ].join('\n'),
      security: [],
      responses: {
        200: { description: 'Event acknowledged.' },
        400: { description: 'Signature verification failed.' },
        503: { description: 'Webhooks are not configured.' }
      }
    }
  },

  // -------------------------------------------------------------------------
  // Keys
  // -------------------------------------------------------------------------
  '/api/keys/mine': {
    get: {
      tags: ['Keys'],
      summary: 'Your purchased keys, grouped by order',
      security: bearerAuth,
      description: 'Scoped hard to the caller through the order relation; there is no client-supplied user id to tamper with.',
      responses: {
        200: { description: 'Purchased keys.' },
        401: { $ref: '#/components/responses/Unauthorized' }
      }
    }
  },

  '/api/keys/inventory': {
    get: {
      tags: ['Keys'],
      summary: 'Key counts per product by status (admin)',
      security: bearerAuth,
      responses: { 200: { description: 'Inventory summary.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/keys/product/{productId}': {
    get: {
      tags: ['Keys'],
      summary: 'Every key for one product (admin)',
      security: bearerAuth,
      parameters: [idParam('productId', 'Product id')],
      responses: { 200: { description: 'Keys.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/keys/bulk': {
    post: {
      tags: ['Keys'],
      summary: 'Upload a batch of codes (admin)',
      security: bearerAuth,
      description: 'Trims, drops blanks, de-duplicates within the batch, and skips codes already in the database.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['productId', 'codes'],
              properties: {
                productId: { type: 'string' },
                codes: { type: 'array', minItems: 1, items: { type: 'string' } }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: 'Codes added.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  added: { type: 'integer' },
                  skipped: { type: 'integer', description: 'Blank, duplicate, or already present.' }
                }
              }
            }
          }
        },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' }
      }
    }
  },

  '/api/keys/{id}': {
    delete: {
      tags: ['Keys'],
      summary: 'Delete an unsold key (admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'Key id')],
      description:
        'Only AVAILABLE keys may be deleted. Removing a SOLD key would destroy a customer purchase record; removing a RESERVED one would pull it out from under an open checkout.',
      responses: {
        200: { description: 'Deleted.' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: { description: 'Key is not AVAILABLE.' }
      }
    }
  },

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------
  '/api/orders': {
    get: {
      tags: ['Orders'],
      summary: 'Your orders (admin sees all)',
      security: bearerAuth,
      responses: {
        200: {
          description: 'Orders.',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Order' } } } }
        },
        401: { $ref: '#/components/responses/Unauthorized' }
      }
    }
  },

  '/api/orders/stats': {
    get: {
      tags: ['Orders'],
      summary: 'Order totals for the caller',
      security: bearerAuth,
      responses: { 200: { description: 'Counts and revenue.' }, 401: { $ref: '#/components/responses/Unauthorized' } }
    }
  },

  '/api/orders/{id}': {
    get: {
      tags: ['Orders'],
      summary: 'One order',
      security: bearerAuth,
      parameters: [idParam('id', 'Order id')],
      responses: {
        200: { description: 'Order.' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { description: 'No such order, or it belongs to someone else.' }
      }
    }
  },

  '/api/orders/{id}/status': {
    put: {
      tags: ['Orders'],
      summary: 'Change order status (admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'Order id')],
      description:
        'Setting REFUNDED issues a real Stripe refund and revokes the delivered keys. It is rejected if the order was never paid, and is idempotent - a second attempt reports the order is already refunded rather than refunding twice.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['PENDING', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'Updated.' },
        400: { $ref: '#/components/responses/ValidationFailed' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: { description: 'Illegal transition, for example refunding an unpaid order.' },
        502: { description: 'Stripe rejected the refund.' }
      }
    }
  },

  '/api/orders/info': postOnlyHint('Order endpoint usage hint'),

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------
  '/api/reviews': {
    post: {
      tags: ['Reviews'],
      summary: 'Leave a review',
      security: bearerAuth,
      description: 'One review per user per product, enforced by a unique constraint.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['productId', 'rating'],
              properties: {
                productId: { type: 'string' },
                rating: { type: 'integer', minimum: 1, maximum: 5 },
                comment: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        201: { description: 'Created.' },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        409: { description: 'Already reviewed this product.' }
      }
    }
  },

  '/api/reviews/product/{productId}': {
    get: {
      tags: ['Reviews'],
      summary: 'Reviews for a product',
      parameters: [idParam('productId', 'Product id')],
      responses: {
        200: {
          description: 'Reviews.',
          content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Review' } } } }
        }
      }
    }
  },

  '/api/reviews/user/me': {
    get: {
      tags: ['Reviews'],
      summary: 'Your own reviews',
      security: bearerAuth,
      responses: { 200: { description: 'Reviews.' }, 401: { $ref: '#/components/responses/Unauthorized' } }
    }
  },

  '/api/reviews/{id}': {
    put: {
      tags: ['Reviews'],
      summary: 'Edit your review',
      security: bearerAuth,
      parameters: [idParam('id', 'Review id')],
      responses: { 200: { description: 'Updated.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    },
    delete: {
      tags: ['Reviews'],
      summary: 'Delete your review (or any, as admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'Review id')],
      responses: { 200: { description: 'Deleted.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/reviews/info': postOnlyHint('Review endpoint usage hint'),

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------
  '/api/users': {
    get: {
      tags: ['Users'],
      summary: 'List customers (admin)',
      security: bearerAuth,
      responses: { 200: { description: 'Users.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'One customer (admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'User id')],
      responses: { 200: { description: 'User.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/users/{id}/role': {
    put: {
      tags: ['Users'],
      summary: 'Change a role (admin)',
      security: bearerAuth,
      parameters: [idParam('id', 'User id')],
      responses: { 200: { description: 'Updated.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/users/me/stats': {
    get: {
      tags: ['Users'],
      summary: 'Your own order statistics',
      security: bearerAuth,
      responses: { 200: { description: 'Stats.' }, 401: { $ref: '#/components/responses/Unauthorized' } }
    }
  },

  '/api/users/info': postOnlyHint('User endpoint usage hint'),

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------
  '/api/analytics/overview': {
    get: {
      tags: ['Analytics'],
      summary: 'Headline figures (admin)',
      security: bearerAuth,
      responses: { 200: { description: 'Revenue, orders, customers, inventory.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/analytics/sales': {
    get: {
      tags: ['Analytics'],
      summary: 'Sales over time (admin)',
      security: bearerAuth,
      parameters: [{ name: 'range', in: 'query', schema: { type: 'string' }, description: 'Reporting window.' }],
      responses: { 200: { description: 'Time series.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/analytics/users': {
    get: {
      tags: ['Analytics'],
      summary: 'Customer analytics (admin)',
      security: bearerAuth,
      responses: { 200: { description: 'Signups and spend.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/analytics/products': {
    get: {
      tags: ['Analytics'],
      summary: 'Product performance (admin)',
      security: bearerAuth,
      responses: { 200: { description: 'Best sellers and stock health.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  },

  '/api/analytics/test': {
    get: {
      tags: ['Analytics'],
      summary: 'Analytics connectivity check (admin)',
      security: bearerAuth,
      responses: { 200: { description: 'OK.' }, 403: { $ref: '#/components/responses/Forbidden' } }
    }
  }
};

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'KeyVault API',
    version: '1.0.0',
    description: [
      'A digital game-key marketplace: browse a catalogue, buy a key, receive it instantly.',
      '',
      '### The part worth reading',
      '',
      'Inventory is not a number. Every sellable unit is a row in `game_keys`, and a product\'s stock is the count of those rows in AVAILABLE status. That choice is what makes overselling a solvable problem rather than a race between two `UPDATE ... SET stock = stock - 1` statements.',
      '',
      'Checkout moves keys AVAILABLE -> RESERVED inside a transaction using a compare-and-set predicate, so two buyers racing for the last key cannot both win. Payment confirmation arrives by webhook and flips RESERVED -> SOLD behind an idempotency latch, so a duplicate delivery from Stripe cannot hand out a second set of keys.',
      '',
      '### Auth',
      '',
      'Send `Authorization: Bearer <token>` from `/api/auth/login`. Tokens last 7 days. Admin-only routes are marked in their descriptions and return 403 for ordinary accounts.'
    ].join('\n'),
    license: { name: 'ISC' }
  },
  servers: [
    { url: 'http://localhost:5000', description: 'Local development' },
    { url: '/', description: 'This deployment' }
  ],
  tags: [
    { name: 'Meta', description: 'Service metadata and health probes.' },
    { name: 'Auth', description: 'Registration, login, and profile.' },
    { name: 'Products', description: 'The game catalogue.' },
    { name: 'Categories', description: 'Genres.' },
    { name: 'Cart', description: 'Per-user basket.' },
    { name: 'Checkout', description: 'Reservation, payment, and fulfilment.' },
    { name: 'Keys', description: 'Key inventory and delivery.' },
    { name: 'Orders', description: 'Order history, status, and refunds.' },
    { name: 'Reviews', description: 'Ratings and comments.' },
    { name: 'Users', description: 'Customer administration.' },
    { name: 'Analytics', description: 'Admin reporting.' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas,
    responses
  },
  paths
};

export default openApiDocument;
