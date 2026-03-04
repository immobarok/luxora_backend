export interface CartItemEntity {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  stockAvailable: number;
  maxQuantity: number;
}

export interface CartSummaryEntity {
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
}

export interface CartSettingsInfo {
  taxRate: number;
  taxRatePercent: string;
  freeShippingThreshold: number;
  shippingCost: number;
  isFreeShipping: boolean;
}

export interface CartEntity {
  id: string;
  userId: string;
  currency: string;
  items: CartItemEntity[];
  summary: CartSummaryEntity;
  settings?: CartSettingsInfo;
}

export interface GuestCartSession {
  sessionId: string;
  expiresAt: Date;
}

export type CartWithItems = any; // Replace with proper Prisma type
export type CartItemWithVariant = any; // Replace with proper Prisma type
