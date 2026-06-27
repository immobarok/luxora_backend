<div align="center">
  <br />
  <h1>🛍️ Luxora Backend API</h1>
  <p><strong>A highly scalable, robust, and feature-rich E-Commerce REST API built with NestJS.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
    <img src="https://img.shields.io/badge/Stripe-008CDD?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe" />
    <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  </p>
</div>

<br />

## 📖 Overview

The **Luxora Backend** powers the e-commerce platform by providing a scalable and secure API. Engineered with **NestJS**, it follows strict architectural patterns and leverages modern technologies to deliver a flawless shopping experience. From real-time chat interactions to secure Stripe payment processing, this backend is built for enterprise-grade applications.

## ✨ Core Features

- 🔐 **Authentication & Authorization**: JWT-based secure auth, Role-Based Access Control (Admin, User, etc.), OTP generation.
- 🛍️ **Product Catalog**: Comprehensive management of products, categories, and brands.
- 🛒 **Shopping Cart & Orders**: Fully managed cart system, order processing, and dynamic coupon integrations.
- 💳 **Payment Processing**: Integrated with **Stripe** for reliable checkout and transaction management.
- 💬 **Real-time Chat**: Powered by **WebSockets (Socket.io)** for seamless live communication.
- 🖼️ **Media Management**: Robust media handling via **Cloudinary** and **MinIO**.
- 🚀 **Performance & Caching**: Engineered with **Redis** to cache heavy database queries and optimize load times.
- 📨 **Email Notifications**: Asynchronous email delivery via **Nodemailer**.
- 🗄️ **Database Integrity**: Strictly typed ORM queries utilizing **Prisma (v7+)** with **PostgreSQL**.

---

## 🛠️ Technology Stack

| Category        | Technology                                                                |
| --------------- | ------------------------------------------------------------------------- |
| **Framework**   | [NestJS v11](https://nestjs.com/)                                         |
| **Language**    | [TypeScript](https://www.typescriptlang.org/)                             |
| **Database**    | [PostgreSQL](https://www.postgresql.org/)                                 |
| **ORM**         | [Prisma](https://www.prisma.io/)                                          |
| **Caching/PubSub**| [Redis](https://redis.io/)                                              |
| **Payments**    | [Stripe](https://stripe.com/)                                             |
| **WebSockets**  | [Socket.io](https://socket.io/)                                           |
| **Cloud Storage**| [Cloudinary](https://cloudinary.com/) / [MinIO](https://min.io/)         |

---

## 🏗️ Project Structure

The codebase is organized into highly cohesive, loosely coupled domain modules:

```text
src/
├── address/       # User address management
├── auth/          # Authentication & JWT strategies
├── brand/         # Product brand domains
├── cart/          # Shopping cart logic
├── category/      # Product categorization
├── chat/          # Real-time WebSocket chat gateway
├── common/        # Shared decorators, filters, interceptors, and guards
├── coupon/        # Discount logic
├── dashboard/     # Admin analytics and metrics
├── mail/          # SMTP mailing logic
├── media/         # File upload services (Cloudinary / MinIO)
├── order/         # Order processing pipelines
├── prisma/        # Database module & extensions
├── product/       # Core product inventory
├── redis/         # Caching and Redis adapter
└── stripe/        # Payment processing webhooks
```

---

## 🚦 Getting Started

### Prerequisites

Ensure you have the following installed on your local development machine:

- **Node.js** (v18 or higher)
- **npm** or **bun** (Project includes `bun.lock`)
- **PostgreSQL**
- **Redis**
- **Docker** (Optional, for running infrastructure via `docker-compose.yml`)

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-org/luxora_backend.git
cd luxora_backend

# Install dependencies
npm install
# or
bun install
```

### 2. Environment Variables

Create a `.env` file in the root directory. You can use the provided `.env.demo` as a template:

```bash
cp .env.demo .env
```

Ensure the following critical variables are properly set:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/luxora_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis
REDIS_URL="redis://localhost:6379"

# Mail
MAIL_HOST="smtp.mailtrap.io"
MAIL_PORT=587
MAIL_USER="your-mail-user"
MAIL_PASSWORD="your-mail-password"
MAIL_FROM="noreply@luxora.com"
```

### 3. Database Setup

The project uses Prisma as its ORM. Run the following commands to generate the Prisma client, apply migrations, and optionally seed the database.

```bash
# Generate Prisma Types
npx prisma generate

# Apply database migrations
npx prisma migrate dev

# (Optional) Seed the database with initial data
npm run db:seed
```

### 4. Running the Application

You can run the application in various modes:

```bash
# Development mode
npm run start

# Watch mode (recommended for development)
npm run dev

# Production mode
npm run build
npm run start:prod
```

---

## 🏥 Checking the Production API

To verify that your production API is running properly, you can ping the built-in Health Check endpoint. This is particularly useful for uptime monitors (like UptimeRobot) or load balancer health checks.

```bash
curl -X GET https://your-production-url.com/api/v1/health
```

**Expected Response (200 OK):**
```json
{
  "status": "ok"
}
```

> **Note:** The health check endpoint deliberately omits the standard API response envelope to keep the payload minimal for monitoring tools.

---

## 🐳 Docker Support

If you prefer containerized development, use the included Docker Compose configuration to spin up external services (PostgreSQL, Redis, MinIO):

```bash
docker-compose up -d
```

---

## 🧪 Testing

The codebase is equipped with Jest for comprehensive testing coverage.

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# View test coverage
npm run test:cov

# Run End-to-End (e2e) tests
npm run test:e2e
```

---

## 🧹 Code Quality

Enforce code formatting and catch issues early with integrated linting tools.

```bash
# Check formatting
npm run format

# Run linter
npm run lint
```

---

## 📄 License

This project is licensed under the **UNLICENSED** software license (as per `package.json`).

<div align="center">
  <sub>Built with ❤️ for Luxora</sub>
</div>
