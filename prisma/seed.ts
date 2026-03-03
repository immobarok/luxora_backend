import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Configuration
  const SALT_ROUNDS = 12;

  // Super Admin
  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@luxora.com';
  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123456';

  // Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@luxora.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

  // Hash passwords
  let superAdminHash: string;
  let adminHash: string;

  try {
    superAdminHash = await bcrypt.hash(superAdminPassword, SALT_ROUNDS);
    adminHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
  } catch (error) {
    console.error('❌ Failed to hash passwords:', error);
    process.exit(1);
  }

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      passwordHash: superAdminHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Super Admin: ${superAdmin.email} (${superAdmin.id})`);

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {}, // Don't update if exists
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Admin: ${admin.email} (${admin.id})`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📧 Login Credentials:');
  console.log('─────────────────────────────────');
  console.log(`Super Admin: ${superAdminEmail}`);
  console.log(`Password:    ${superAdminPassword}`);
  console.log('─────────────────────────────────');
  console.log(`Admin:       ${adminEmail}`);
  console.log(`Password:    ${adminPassword}`);
  console.log('─────────────────────────────────');
  console.log('\n⚠️  Change these passwords in production!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
