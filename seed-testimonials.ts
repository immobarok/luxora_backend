import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const testimonials = [
    {
      quote: "Lorem Khaled Ipsum is a major key to success. The staff are friendly which is always nice. The clothes are stylish and affordable. Everyone has a choice. I pick my choice, squeaky clean.",
      name: "Sharon Stone",
      role: "Acc - Hollywood",
    },
    {
      quote: "Another one. The key is to enjoy life, because they don't want you to enjoy life. I promise you, they don't want you to jetski at breakfast. Major key to success.",
      name: "DJ Khaled",
      role: "Artist - Producer",
    },
    {
      quote: "They key is to have every key, the key to open every door. We the best. Best customer service in the game, hands down. We keep winning.",
      name: "Just A Customer",
      role: "VIP Member",
    },
  ];

  for (const t of testimonials) {
    await prisma.testimonial.create({ data: t });
  }
  console.log("Seeded successfully");
}

main().catch(console.error).finally(() => prisma.$disconnect());
