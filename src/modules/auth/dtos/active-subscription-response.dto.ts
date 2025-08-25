export class ActiveSubscriptionResponseDto {
  provider: 'stripe' | 'paypal' | null;
  subscriptionId: string | null;
  customerId?: string | null;
  status: string | null; // e.g., 'active' | 'trialing' | 'canceled' | 'ACTIVE' ...
  cancelAtPeriodEnd?: boolean | null; // for Stripe (and conceptually PayPal)
  priceId?: string | null; // price_... (Stripe) or null for PayPal unless you fetch plan info
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}
