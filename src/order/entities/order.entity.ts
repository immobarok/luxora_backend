// src/order/entities/order.entity.ts

export interface OrderItemEntity {
  id: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  discountAmount: number | null;
  status: string;
  returnedQuantity: number;
}

export interface OrderAddressEntity {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderPaymentEntity {
  id: string;
  amount: number;
  status: string;
  method: string;
  provider: string;
  processedAt: Date | null;
}

export interface OrderShipmentEntity {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}

export interface OrderEntity {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;

  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;

  couponCode: string | null;

  placedAt: Date;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;

  items: OrderItemEntity[];
  shippingAddress: OrderAddressEntity | null;
  billingAddress: OrderAddressEntity | null;
  payments: OrderPaymentEntity[];
  shipments: OrderShipmentEntity[];
}

export interface OrderListItemEntity {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  itemCount: number;
  firstItemImage: string | null;
  placedAt: Date;
}

export interface CheckoutResult {
  order: OrderEntity;
  payment: {
    status: string;
    redirectUrl?: string;
  };
}
