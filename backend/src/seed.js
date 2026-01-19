import prisma from './lib/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Test database connection with timeout
    const connectionPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 30000)
    );
    
    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }

  // Seed database with initial data

  // Create admin user
  console.log('👤 Creating admin user...');
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@commerceflow.com' },
    update: {},
    create: {
      email: 'admin@commerceflow.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN'
    }
  });

  // Create test customers
  const testCustomers = [
    {
      email: 'customer1@test.com',
      password: await bcrypt.hash('password123', 12),
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER'
    },
    {
      email: 'customer2@test.com',
      password: await bcrypt.hash('password123', 12),
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'USER'
    },
    {
      email: 'customer3@test.com',
      password: await bcrypt.hash('password123', 12),
      firstName: 'Mike',
      lastName: 'Johnson',
      role: 'USER'
    }
  ];

  console.log('👥 Creating test customers...');
  for (const customer of testCustomers) {
    await prisma.user.upsert({
      where: { email: customer.email },
      update: {},
      create: customer
    });
  }

  // Create categories
  const categories = [
    {
      name: 'Electronics',
      description: 'Latest gadgets and electronic devices',
      image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400'
    },
    {
      name: 'Clothing',
      description: 'Fashion and apparel for all seasons',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400'
    },
    {
      name: 'Home & Garden',
      description: 'Everything for your home and garden',
      image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400'
    },
    {
      name: 'Books',
      description: 'Books for all ages and interests',
      image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400'
    },
    {
      name: 'Sports & Outdoors',
      description: 'Equipment and gear for sports and outdoor activities',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400'
    }
  ];

  console.log('📂 Creating categories...');
  const createdCategories = [];
  for (const category of categories) {
    const created = await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category
    });
    createdCategories.push(created);
  }

  // Create comprehensive sample products with thematic consistency
  const products = [
    // Electronics - Premium Tech
    {
      name: 'Wireless Bluetooth Headphones',
      description: 'Experience high-fidelity sound with these wireless Bluetooth headphones. Comfortable fit, long battery life, and crystal-clear audio for music lovers.',
      price: 89.99,
      stock: 50,
      categoryId: createdCategories[0].id, // Electronics
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400'
      ]
    },
    {
      name: 'Smart Fitness Watch',
      description: 'Track your fitness goals with this advanced smart watch. Monitor heart rate, sleep patterns, and stay connected with notifications.',
      price: 299.99,
      stock: 0, // Out of stock
      categoryId: createdCategories[0].id, // Electronics
      images: [
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Wireless Charging Pad',
      description: 'Charge your devices wirelessly with this sleek charging pad. Compatible with all Qi-enabled devices.',
      price: 49.99,
      stock: 75,
      categoryId: createdCategories[0].id, // Electronics
      images: [
        'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Premium Wireless Earbuds',
      description: 'Experience premium sound quality with these wireless earbuds. Perfect for music lovers and professionals alike.',
      price: 159.99,
      stock: 45,
      categoryId: createdCategories[0].id, // Electronics
      images: [
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Smart Home Hub',
      description: 'Control all your smart home devices from one central hub. Compatible with major smart home ecosystems.',
      price: 89.99,
      stock: 35,
      categoryId: createdCategories[0].id, // Electronics
      images: [
        'https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },
    {
      name: 'Ultra HD Webcam',
      description: 'Crystal clear video quality for professional meetings and content creation. Perfect for remote work.',
      price: 79.99,
      stock: 60,
      categoryId: createdCategories[0].id, // Electronics
      images: [
        'https://images.unsplash.com/photo-1715869618915-a7bf6608d4c3?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://images.unsplash.com/photo-1715869618915-a7bf6608d4c3?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },
    {
      name: 'Wireless Gaming Mouse',
      description: 'High-performance wireless gaming mouse with customizable RGB lighting and programmable buttons.',
      price: 129.99,
      stock: 25,
      categoryId: createdCategories[0].id, // Electronics
      images: [
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'JBL Portable Speaker',
      description: 'Portable Bluetooth speaker with powerful sound and long battery life. Perfect for outdoor activities.',
      price: 69.99,
      stock: 40,
      categoryId: createdCategories[0].id, // Electronics
      images: [
        'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=900&h=1200&fit=crop'
      ]
    },

    // Clothing - Fashion & Style
    {
      name: 'Organic Cotton T-Shirt',
      description: 'Comfortable and sustainable organic cotton t-shirt. Perfect for everyday wear with a soft, breathable fabric.',
      price: 29.99,
      stock: 100,
      categoryId: createdCategories[1].id, // Clothing
      images: [
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Designer Leather Jacket',
      description: 'Premium leather jacket with timeless design. Crafted from genuine leather for durability and style.',
      price: 299.99,
      stock: 25,
      categoryId: createdCategories[1].id, // Clothing
      images: [
        'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'White Dress',
      description: 'Elegant white dress perfect for special occasions. Flattering fit with premium fabric.',
      price: 89.99,
      stock: 15,
      categoryId: createdCategories[1].id, // Clothing
      images: [
        'https://plus.unsplash.com/premium_photo-1676236306466-25ba882070b3?q=80&w=688&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://plus.unsplash.com/premium_photo-1676236306466-25ba882070b3?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },
    {
      name: 'Organic Cotton Hoodie',
      description: 'Comfortable and sustainable organic cotton hoodie. Perfect for casual wear and outdoor activities.',
      price: 59.99,
      stock: 30,
      categoryId: createdCategories[1].id, // Clothing
      images: [
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Designer Sunglasses',
      description: 'Stylish designer sunglasses with UV protection. Perfect for sunny days and outdoor activities.',
      price: 89.99,
      stock: 20,
      categoryId: createdCategories[1].id, // Clothing
      images: [
        'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=900&h=1200&fit=crop'
      ]
    },

    // Home & Garden - Lifestyle & Comfort
    {
      name: 'Premium Coffee Maker',
      description: 'Brew the perfect cup every time with this premium coffee maker. Features programmable settings and a sleek, modern design.',
      price: 199.99,
      stock: 30,
      categoryId: createdCategories[2].id, // Home & Garden
      images: [
        'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Stainless Steel Water Bottle',
      description: 'Keep your drinks cold for 24 hours or hot for 12 hours with this premium stainless steel water bottle.',
      price: 24.99,
      stock: 80,
      categoryId: createdCategories[2].id, // Home & Garden
      images: [
        'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Professional Coffee Grinder',
      description: 'Professional-grade coffee grinder for the perfect grind every time. Essential for coffee enthusiasts.',
      price: 149.99,
      stock: 40,
      categoryId: createdCategories[2].id, // Home & Garden
      images: [
        'https://images.unsplash.com/photo-1646346834998-5b610ec21d12?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://images.unsplash.com/photo-1646346834998-5b610ec21d12?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },
    {
      name: 'Memory Foam Pillow Set',
      description: 'Ultra-comfortable memory foam pillows for the best night\'s sleep. Set includes 2 standard pillows.',
      price: 49.99,
      stock: 70,
      categoryId: createdCategories[2].id, // Home & Garden
      images: [
        'https://images.unsplash.com/photo-1698746043955-42b03ddedfcb?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://images.unsplash.com/photo-1698746043955-42b03ddedfcb?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },
    {
      name: 'Bedside Table',
      description: 'Modern bedside table with storage drawer. Perfect addition to any bedroom with clean, minimalist design.',
      price: 79.99,
      stock: 15,
      categoryId: createdCategories[2].id, // Home & Garden
      images: [
        'https://images.unsplash.com/photo-1752062003907-331dc20be406?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://images.unsplash.com/photo-1752062003907-331dc20be406?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },
    {
      name: 'Sustainable Bamboo Cutlery Set',
      description: 'Eco-friendly bamboo cutlery set perfect for sustainable living. Includes fork, knife, and spoon.',
      price: 34.99,
      stock: 55,
      categoryId: createdCategories[2].id, // Home & Garden
      images: [
        'https://plus.unsplash.com/premium_photo-1716278501091-9e5de2270d54?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://plus.unsplash.com/premium_photo-1716278501091-9e5de2270d54?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },
    {
      name: 'Organic Tea Collection',
      description: 'Premium organic tea collection featuring 6 different varieties. Perfect for tea enthusiasts.',
      price: 24.99,
      stock: 65,
      categoryId: createdCategories[2].id, // Home & Garden
      images: [
        'https://plus.unsplash.com/premium_photo-1731696604187-fadf1df7ef54?q=80&w=1409&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://plus.unsplash.com/premium_photo-1731696604187-fadf1df7ef54?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },

    // Books - Knowledge & Entertainment
    {
      name: 'The Art of Programming',
      description: 'Comprehensive guide to modern programming practices and software development methodologies.',
      price: 39.99,
      stock: 45,
      categoryId: createdCategories[3].id, // Books
      images: [
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Mindful Living Guide',
      description: 'Transform your life with practical mindfulness techniques and meditation practices.',
      price: 19.99,
      stock: 80,
      categoryId: createdCategories[3].id, // Books
      images: [
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Culinary Masterclass',
      description: 'Master the art of cooking with professional techniques and gourmet recipes.',
      price: 29.99,
      stock: 35,
      categoryId: createdCategories[3].id, // Books
      images: [
        'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=900&h=1200&fit=crop'
      ]
    },

    // Sports & Outdoors - Active Lifestyle
    {
      name: 'Fitness Resistance Bands',
      description: 'Complete set of resistance bands for home workouts. Perfect for strength training and rehabilitation.',
      price: 19.99,
      stock: 90,
      categoryId: createdCategories[4].id, // Sports & Outdoors
      images: [
        'https://images.unsplash.com/photo-1610720991840-457ad2c7a658?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
        'https://images.unsplash.com/photo-1610720991840-457ad2c7a658?q=80&w=900&h=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
      ]
    },
    {
      name: 'Yoga Mat Premium',
      description: 'High-quality yoga mat with excellent grip and cushioning. Perfect for yoga, pilates, and meditation.',
      price: 44.99,
      stock: 60,
      categoryId: createdCategories[4].id, // Sports & Outdoors
      images: [
        'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Hiking Backpack',
      description: 'Durable hiking backpack with multiple compartments. Perfect for outdoor adventures and travel.',
      price: 89.99,
      stock: 25,
      categoryId: createdCategories[4].id, // Sports & Outdoors
      images: [
        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&h=1200&fit=crop'
      ]
    },
    {
      name: 'Running Shoes',
      description: 'Lightweight running shoes with superior comfort and support. Ideal for daily runs and training.',
      price: 129.99,
      stock: 40,
      categoryId: createdCategories[4].id, // Sports & Outdoors
      images: [
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&h=1200&fit=crop'
      ]
    }
  ];

  console.log('📦 Creating products...');
  for (const product of products) {
    const created = await prisma.product.create({
      data: product
    });
  }

  // Get all created products and users for reviews
  console.log('⭐ Creating reviews...');
  const allProducts = await prisma.product.findMany();
  const allUsers = await prisma.user.findMany({ where: { role: 'USER' } });

  // Create realistic reviews and ratings
  const reviewComments = [
    "Excellent quality! Highly recommend.",
    "Great value for money. Very satisfied.",
    "Fast shipping and perfect condition.",
    "Exactly what I was looking for.",
    "Amazing product, exceeded expectations.",
    "Good quality but could be better.",
    "Decent product for the price.",
    "Not bad, but there's room for improvement.",
    "Solid product, meets expectations.",
    "Really happy with this purchase!",
    "Good customer service and product quality.",
    "Worth every penny!",
    "Better than expected quality.",
    "Perfect for my needs.",
    "Great addition to my collection.",
    "High quality materials used.",
    "Very durable and well-made.",
    "Excellent customer experience.",
    "Fast delivery and great packaging.",
    "Highly satisfied with this purchase."
  ];

  // Create reviews for each product
  for (const product of allProducts) {
    // Generate 3-8 reviews per product, but don't exceed available users
    const maxReviews = Math.min(allUsers.length, Math.floor(Math.random() * 6) + 3);
    const numReviews = maxReviews;
    const usedUserIds = new Set();
    
    for (let i = 0; i < numReviews; i++) {
      // Pick a user who hasn't reviewed this product yet
      let user;
      let attempts = 0;
      do {
        user = allUsers[Math.floor(Math.random() * allUsers.length)];
        attempts++;
      } while (usedUserIds.has(user.id) && attempts < 10);
      if (usedUserIds.has(user.id)) continue; // skip if all users used
      usedUserIds.add(user.id);
      const rating = Math.floor(Math.random() * 3) + 3; // 3-5 stars
      const comment = reviewComments[Math.floor(Math.random() * reviewComments.length)];
      
      await prisma.review.upsert({
        where: {
          userId_productId: {
            userId: user.id,
            productId: product.id
          }
        },
        update: {
          rating,
          comment
        },
        create: {
          rating,
          comment,
          productId: product.id,
          userId: user.id
        }
      });
    }
  }

  // Create a regular user for testing
  console.log('👤 Creating regular user...');
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@commerceflow.com' },
    update: {},
    create: {
      email: 'user@commerceflow.com',
      password: await bcrypt.hash('user123', 12),
      firstName: 'Regular',
      lastName: 'User',
      role: 'USER'
    }
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('📋 Test Accounts:');
  console.log('Admin: admin@commerceflow.com / admin123');
  console.log('User: user@commerceflow.com / user123');
  console.log('Customer 1: customer1@test.com / password123');
  console.log('Customer 2: customer2@test.com / password123');
  console.log('Customer 3: customer3@test.com / password123');
  console.log(`📦 Created ${products.length} products across ${categories.length} categories`);
  console.log(`⭐ Added realistic reviews and ratings to all products`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    console.error('Error details:', e.message);
    if (e.code) {
      console.error('Error code:', e.code);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 