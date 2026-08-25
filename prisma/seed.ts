import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Default Owner User
  const ownerEmail = 'zakavi@gmail.com';
  const ownerHashedPassword = await bcrypt.hash('jawhara123', 10);
  
  const ownerUser = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      password: ownerHashedPassword,
      rawPassword: 'jawhara123',
    },
    create: {
      name: 'Murtaza Zakavi',
      email: ownerEmail,
      password: ownerHashedPassword,
      rawPassword: 'jawhara123',
      role: 'OWNER',
    },
  });
  console.log(`Seeded owner user: ${ownerUser.email}`);

  // 1b. Create Default Admin User
  const adminEmail = 'admin@maisonjawhara.com';
  const hashedPassword = await bcrypt.hash('JawharaOS2026!', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      rawPassword: 'JawharaOS2026!',
    },
    create: {
      name: 'Boutique Admin',
      email: adminEmail,
      password: hashedPassword,
      rawPassword: 'JawharaOS2026!',
      role: 'ADMIN',
    },
  });
  console.log(`Seeded admin user: ${adminUser.email}`);

  // 2. Create Categories
  const ridaCategory = await prisma.productCategory.upsert({
    where: { name: 'Rida' },
    update: {},
    create: {
      name: 'Rida',
      slug: 'rida',
      code: 'R',
      description: 'Elegant, premium one-of-one Ridas',
    },
  });

  const beddingCategory = await prisma.productCategory.upsert({
    where: { name: 'Bedding' },
    update: {},
    create: {
      name: 'Bedding',
      slug: 'bedding',
      code: 'B',
      description: 'Luxurious bedspreads, duvets, and covers',
    },
  });

  const decorCategory = await prisma.productCategory.upsert({
    where: { name: 'Décor' },
    update: {},
    create: {
      name: 'Décor',
      slug: 'decor',
      code: 'D',
      description: 'Handcrafted boutique décor items',
    },
  });

  const kidsCategory = await prisma.productCategory.upsert({
    where: { name: 'Kids' },
    update: {},
    create: {
      name: 'Kids',
      slug: 'kids',
      code: 'K',
      description: 'Kids clothing and accessories',
    },
  });

  console.log('Seeded product categories.');

  // 3. Create Attribute Definitions
  // Rida Attributes
  const ridaAttributes = [
    { key: 'pardi_style', name: 'Pardi Style', fieldType: 'TEXT', sortOrder: 1 },
    { key: 'embroidery_type', name: 'Embroidery Type', fieldType: 'TEXT', sortOrder: 2 },
    { key: 'top_colour', name: 'Top Colour', fieldType: 'TEXT', sortOrder: 3 },
    { key: 'bottom_colour', name: 'Bottom Colour', fieldType: 'TEXT', sortOrder: 4 },
    { key: 'fabric', name: 'Fabric', fieldType: 'TEXT', sortOrder: 5 },
  ];

  for (const attr of ridaAttributes) {
    await prisma.attributeDefinition.create({
      data: {
        categoryId: ridaCategory.id,
        key: attr.key,
        name: attr.name,
        fieldType: attr.fieldType,
        sortOrder: attr.sortOrder,
      },
    });
  }

  // Bedding Attributes
  const beddingAttributes = [
    { key: 'bed_size', name: 'Bed Size', fieldType: 'SELECT', options: JSON.stringify(['Single', 'Double', 'Queen', 'King']), sortOrder: 1 },
    { key: 'material', name: 'Material', fieldType: 'TEXT', sortOrder: 2 },
  ];

  for (const attr of beddingAttributes) {
    await prisma.attributeDefinition.create({
      data: {
        categoryId: beddingCategory.id,
        key: attr.key,
        name: attr.name,
        fieldType: attr.fieldType,
        options: attr.options,
        sortOrder: attr.sortOrder,
      },
    });
  }

  console.log('Seeded attribute definitions.');

  // 4. Create Collections
  const gulabEdit = await prisma.collection.upsert({
    where: { name: 'Gulab Edit' },
    update: {},
    create: {
      name: 'Gulab Edit',
      slug: 'gulab-edit',
      description: 'Soft floral collection emphasizing delicate rose motifs.',
    },
  });

  const pastelEdit = await prisma.collection.upsert({
    where: { name: 'Pastel Edit' },
    update: {},
    create: {
      name: 'Pastel Edit',
      slug: 'pastel-edit',
      description: 'Gentle, light luxury hues in dusty pinks and mauves.',
    },
  });

  console.log('Seeded collections.');

  // 5. Seed Customers
  const customer1 = await prisma.customer.upsert({
    where: { normalizedMobile: '+919876543210' },
    update: {},
    create: {
      name: 'Eleanor Vance',
      mobile: '9876543210',
      normalizedMobile: '+919876543210',
      email: 'eleanor@vance.com',
      city: 'Mumbai',
      notes: 'Prefers silk embroidery and pastel hues. VIP client.',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { normalizedMobile: '+919876543211' },
    update: {},
    create: {
      name: 'Marcus Sterling',
      mobile: '9876543211',
      normalizedMobile: '+919876543211',
      email: 'marcus@sterling.com',
      city: 'Delhi',
      notes: 'Bespoke tailoring, high value customer.',
    },
  });

  const customer3 = await prisma.customer.upsert({
    where: { normalizedMobile: '+919876543212' },
    update: {},
    create: {
      name: 'Chloe Chen',
      mobile: '9876543212',
      normalizedMobile: '+919876543212',
      email: 'chloe@chen.com',
      city: 'Bangalore',
      notes: 'Loves rose motifs and neutral bedding.',
    },
  });

  console.log('Seeded customers.');

  // 6. Seed Products
  // Product 1: Mehr-e-Gul Rida
  const p1 = await prisma.product.create({
    data: {
      productCode: 'JWR-R-26-0001',
      name: 'Mehr-e-Gul',
      slug: 'mehr-e-gul',
      categoryId: ridaCategory.id,
      shortDesc: 'A graceful sage floral Rida',
      description: 'Crafted from premium quality fabrics, this piece is decorated with delicate pink rose embroidery detailing. Soft and feminine, perfect for special boutique gatherings.',
      price: 22000,
      costPrice: 12000,
      isUnique: true,
      quantity: 1,
      publishStatus: 'PUBLISHED',
      inventoryStatus: 'AVAILABLE',
      primaryColour: 'Sage Green',
      secondaryColours: 'Dusty Pink, Cream',
      collectionId: gulabEdit.id,
      images: {
        create: [
          {
            url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCSBqPaRxBHtavIugBS7vsMtNTjgSs1Ej9plud-0rWCqZXouu-6YEi0qXfP7Xvba4HsDIldr1cTHqo2465k3MY7KsLkrs_WmNNCqj6swlx8StBkGQJ_me_0IIS5P1RfL6fKqr7pNPRt6C-pkPZt6JeOoIklI1Q1LftgXfaW-h5OAWMX0YpFy01GQlL64NXhIJmvCd74sq6_K2ZP5B9hjk5dUncsQeyjt_0iIJ4JmzR_S9WTWi19bfuDSA',
            isPrimary: true,
            sortOrder: 0,
            altText: 'Mehr-e-Gul Sage Green Rida close-up'
          }
        ]
      }
    },
  });

  // Load attribute definitions for Rida
  const ridaDefs = await prisma.attributeDefinition.findMany({ where: { categoryId: ridaCategory.id } });
  
  const ridaValues = [
    { key: 'pardi_style', value: 'Traditional' },
    { key: 'embroidery_type', value: 'Floral Cross-stitch' },
    { key: 'top_colour', value: 'Sage Green' },
    { key: 'bottom_colour', value: 'Cream' },
    { key: 'fabric', value: 'Soft Cotton blend' },
  ];

  for (const val of ridaValues) {
    const def = ridaDefs.find(d => d.key === val.key);
    if (def) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p1.id,
          definitionId: def.id,
          value: val.value,
        }
      });
    }
  }

  // Product 2: Noor Rida (Reserved for Eleanor Vance)
  const p2 = await prisma.product.create({
    data: {
      productCode: 'JWR-R-26-0002',
      name: 'Noor Rida',
      slug: 'noor-rida',
      categoryId: ridaCategory.id,
      shortDesc: 'Dusty mauve silk elegant Rida',
      description: 'An elegant dusty mauve Rida crafted from Mulberry silk with minimalist geometric gold piping and soft cream borders.',
      price: 25000,
      costPrice: 15000,
      isUnique: true,
      quantity: 1,
      publishStatus: 'PUBLISHED',
      inventoryStatus: 'RESERVED',
      primaryColour: 'Dusty Mauve',
      secondaryColours: 'Gold, Cream',
      collectionId: pastelEdit.id,
      images: {
        create: [
          {
            url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCktgD1PGuz4WnOcGwOkI_atm5vudNTeAjaJWDdxg_DgqxZLlG2ZkI9QlNi6RfydsFuxj1NunkgoYfNh_cU-Uh9s1Qmhe9qdzSmrZ9OYTT3h0wy6HNqnbkw_a9pbBHte-kxLKyRCXldBUl_rZfqIbp4r2ikoMIZe2t_PG3XtKg5qfKjcid2J2oQF4aJ5GfcOkG1DLasQCZXqwY8aJSj3pKzkX51wfYZd8In-Ji8RuEnt7nBdA0efAz4Fg',
            isPrimary: true,
            sortOrder: 0,
            altText: 'Noor Dusty Mauve Silk Rida'
          }
        ]
      }
    },
  });

  const noorValues = [
    { key: 'pardi_style', value: 'Modern Minimalist' },
    { key: 'embroidery_type', value: 'Gold piping' },
    { key: 'top_colour', value: 'Dusty Mauve' },
    { key: 'bottom_colour', value: 'Dusty Mauve' },
    { key: 'fabric', value: '100% Mulberry Silk' },
  ];

  for (const val of noorValues) {
    const def = ridaDefs.find(d => d.key === val.key);
    if (def) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p2.id,
          definitionId: def.id,
          value: val.value,
        }
      });
    }
  }

  // Create active reservation for Noor Rida
  await prisma.reservation.create({
    data: {
      productId: p2.id,
      customerId: customer1.id,
      reservedBy: 'Boutique Admin',
      status: 'ACTIVE',
      notes: 'Eleanor requested to reserve this during lookbook presentation.',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    }
  });

  // Product 3: Rose Duvet Set (Bedding category, not unique)
  const beddingDefs = await prisma.attributeDefinition.findMany({ where: { categoryId: beddingCategory.id } });
  
  const p3 = await prisma.product.create({
    data: {
      productCode: 'JWR-B-26-0003',
      name: 'Rosé Duvet Set',
      slug: 'rose-duvet-set',
      categoryId: beddingCategory.id,
      shortDesc: 'Luxury linen set in soft blush',
      description: 'Linen sheet set featuring a double duvet cover and four pillowcases in an airy, elegant soft blush pink colorway.',
      price: 18000,
      costPrice: 9000,
      isUnique: false,
      quantity: 10,
      publishStatus: 'PUBLISHED',
      inventoryStatus: 'AVAILABLE',
      primaryColour: 'Soft Blush',
      secondaryColours: 'Warm Ivory',
      collectionId: pastelEdit.id,
      images: {
        create: [
          {
            url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWrcac-6HYoIHaABxPeMRAD0B2MqCiWJplqc7dVdmwnNyt2SDuI5ZXE81tL6bFWbxG4rKJimztEQM8zWSmVRINkJjq6I9UQsPN_42xLS4t8l57-QZdXfTDXDe5P39MYV3xe2sijrCIzuhIQzypUtNhEndW0WdZp-EMAzgBHmQNbICXzildMjOSncdmPFsEfTQumGfSLR0lqzWu6ITyuCAKWeJCoJw2h27bWMlQBZRlztrbUhqYNRxyYQ',
            isPrimary: true,
            sortOrder: 0,
            altText: 'Rose Duvet Set blush pink bed linen'
          }
        ]
      }
    },
  });

  const beddingValues = [
    { key: 'bed_size', value: 'King' },
    { key: 'material', value: '100% Organic Linen' },
  ];

  for (const val of beddingValues) {
    const def = beddingDefs.find(d => d.key === val.key);
    if (def) {
      await prisma.productAttributeValue.create({
        data: {
          productId: p3.id,
          definitionId: def.id,
          value: val.value,
        }
      });
    }
  }

  // Product 4: Blossom Bunting (Decor category, sold)
  const p4 = await prisma.product.create({
    data: {
      productCode: 'JWR-D-26-0004',
      name: 'Blossom Bunting',
      slug: 'blossom-bunting',
      categoryId: decorCategory.id,
      shortDesc: 'Rose theme fabric bunting',
      description: 'Festive wall décor bunting stitched from vintage Jawhara floral print fabric leftovers.',
      price: 4500,
      costPrice: 1500,
      isUnique: true,
      quantity: 1,
      publishStatus: 'PUBLISHED',
      inventoryStatus: 'SOLD',
      primaryColour: 'Dusty Pink',
      secondaryColours: 'Sage Green, Olive',
      collectionId: gulabEdit.id,
      soldAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Sold 2 days ago
      images: {
        create: [
          {
            url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBlRdRuK3vwknJbIrxziunCyt0s8zSz_j28FQ8c8r03W7aMdB7NJQovrs_aNDfbn5Ujf8RIpU9ddVa2Yigxs8UC0mDcuOm5elCxjqHjAFWimTcMcal8P2Y4pIKlFUDHoCZAjbt_npm9wdwAYOSxqS2KBCmEGyiFywTEdhgnjh1hiMDgpgtwjEEE-jvW5PueZcPvCOebRwyvwexlU9XwXDEarVYPeSS_KVjxLpwxLyQImkhG08dhuxIAMA',
            isPrimary: true,
            sortOrder: 0,
            altText: 'Blossom Bunting floral print flags'
          }
        ]
      }
    },
  });

  // Create order for Blossom Bunting
  const order1 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-10001',
      customerId: customer3.id,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      subtotal: 4500,
      total: 4500,
      currency: 'INR',
      notes: 'Customer bought via Instagram DM. Hand-delivered.',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      orderItems: {
        create: [
          {
            productId: p4.id,
            quantity: 1,
            unitPrice: 4500,
            finalPrice: 4500,
          }
        ]
      }
    }
  });

  console.log('Seeded products, reservations, and orders.');
  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
