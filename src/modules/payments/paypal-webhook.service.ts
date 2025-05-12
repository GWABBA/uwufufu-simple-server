import { UsersRepository } from './../users/users.repository';
import { Injectable } from '@nestjs/common';
import { PaymentRepository } from './payments.repository';
import { IsNull } from 'typeorm';
import fetch from 'node-fetch';

@Injectable()
export class PaypalWebhookService {
  constructor(
    private paymentRepository: PaymentRepository,
    private usersRepository: UsersRepository,
  ) {}

  private readonly DISCORD_WEBHOOK_URL =
    'https://discord.com/api/webhooks/1370660983600582666/FUf0MgmC26YAvAO0-uvJoLdYnHnNrelqmGZAUxVPAZgd723eR8_7KguJsr4ToxDTJONT';

  async handleWebhook(event: any) {
    const eventType = event.event_type;
    const resource = event.resource;

    // Send webhook event to Discord
    try {
      const message = `💰 **PayPal Webhook Event**\n\`\`\`json\n${JSON.stringify(event, null, 4)}\n\`\`\``;

      // Check if message exceeds Discord's 2000 character limit
      if (message.length > 2000) {
        // If it does, send a truncated version
        const truncatedMessage = `💰 **PayPal Webhook Event**\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
        await fetch(this.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: truncatedMessage,
          }),
        });
      } else {
        await fetch(this.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: message,
          }),
        });
      }
    } catch (error) {
      console.error('❌ Failed to send Discord webhook:', error);
      // Continue processing the webhook even if Discord notification fails
    }

    console.log(`📢 PayPal Webhook Event: ${eventType}`);
    console.log(JSON.stringify(resource, null, 2));

    switch (eventType) {
      // ✅ Handle New Subscription Activation
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subscriptionId = resource.id;
        const paypalEmail = resource?.subscriber?.email_address || null;
        const userId = resource?.custom_id || null;

        if (!userId) {
          console.warn(`⚠️ No user ID found in webhook`);
          return;
        }

        // 🔍 Find user in the database
        const user = await this.usersRepository.findOne({
          where: { id: userId, deletedAt: IsNull() },
        });

        if (!user) {
          console.warn(`⚠️ User not found for ID: ${userId}`);
          return;
        }

        // ✅ Prevent duplicate subscription entries
        const existingSubscription = await this.paymentRepository.findOne({
          where: { paypalOrderId: subscriptionId },
        });

        if (existingSubscription) {
          console.log(
            `⚠️ Subscription ${subscriptionId} already exists. Skipping duplicate.`,
          );
          return;
        }

        // ✅ Store Subscription in Database
        await this.paymentRepository.createPayment({
          user,
          paypalOrderId: subscriptionId,
          status: 'ACTIVE',
          payerEmail: paypalEmail,
          amount: resource?.billing_info?.last_payment?.amount?.value
            ? parseFloat(resource.billing_info.last_payment.amount.value)
            : null,
          currency:
            resource?.billing_info?.last_payment?.amount?.currency_code || null,
        });

        // 🔍 Check if the subscription has a trial
        let trialDays = 0;
        if (resource.billing_info?.cycle_executions?.length) {
          const trialCycle = resource.billing_info.cycle_executions.find(
            (cycle) => cycle.tenure_type === 'TRIAL',
          );
          if (trialCycle) {
            trialDays = trialCycle.total_cycles; // The trial period in days
          }
        }

        const startDate = new Date();
        const endDate = new Date();

        if (trialDays > 0) {
          // ✅ If trial exists, add 7 days
          endDate.setDate(endDate.getDate() + 7);
        } else {
          // ✅ If no trial, add 1 full month
          endDate.setMonth(endDate.getMonth() + 1);
        }

        await this.usersRepository.update(user.id, {
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          tier: 'plus',
        });

        console.log(
          `✅ Subscription activated for user: ${user.id} | Trial: ${trialDays > 0 ? 'Yes (7 days)' : 'No'} | End Date: ${endDate.toISOString()}`,
        );
        break;
      }

      // ✅ Handle Subscription Renewal Payments
      case 'PAYMENT.SALE.COMPLETED': {
        const paypalPaymentId = resource.id;
        const amount = resource.amount.value;
        const currency = resource.amount.currency_code;
        const subscriptionId = resource.billing_agreement_id;
        const paypalEmail = resource?.payer?.email_address || null;

        // Send initial webhook to Discord
        try {
          await fetch(this.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🔄 **Processing Subscription Renewal**\n\`\`\`json\n${JSON.stringify(resource, null, 4)}\n\`\`\``,
            }),
          });
        } catch (error) {
          console.error('❌ Failed to send initial Discord webhook:', error);
        }

        if (!subscriptionId) {
          const errorMsg = `⚠️ No subscription ID found for payment: ${paypalPaymentId}`;
          console.warn(errorMsg);
          try {
            await fetch(this.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `❌ ${errorMsg}`,
              }),
            });
          } catch (error) {
            console.error('❌ Failed to send Discord webhook:', error);
          }
          return;
        }

        // 🔍 Find Existing Subscription
        const existingPayment = await this.paymentRepository.findOne({
          where: { paypalOrderId: subscriptionId },
          relations: ['user'],
        });

        if (!existingPayment) {
          const errorMsg = `⚠️ No existing subscription found for Payment: ${paypalPaymentId}`;
          console.warn(errorMsg);
          try {
            await fetch(this.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `❌ ${errorMsg}`,
              }),
            });
          } catch (error) {
            console.error('❌ Failed to send Discord webhook:', error);
          }
          return;
        }

        try {
          // 1. Mark current subscription as COMPLETED
          await this.paymentRepository.updatePaymentStatus(
            subscriptionId,
            'COMPLETED',
          );

          // 2. Create new ACTIVE subscription record
          await this.paymentRepository.createPayment({
            user: existingPayment.user,
            paypalOrderId: paypalPaymentId,
            status: 'ACTIVE',
            amount: amount,
            currency: currency,
            payerEmail: paypalEmail,
          });

          // 3. Update user's subscription dates
          const currentEndDate = existingPayment.user.subscriptionEndDate || new Date();
          const nextMonth = new Date(currentEndDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);

          await this.usersRepository.update(existingPayment.user.id, {
            subscriptionEndDate: nextMonth,
            tier: 'plus',
          });

          // Send success webhook
          try {
            await fetch(this.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `✅ **Subscription Renewed Successfully**\n👤 User ID: ${existingPayment.user.id}\n💰 Amount: ${amount} ${currency}\n📅 New End Date: ${nextMonth.toISOString()}`,
              }),
            });
          } catch (error) {
            console.error('❌ Failed to send success Discord webhook:', error);
          }

          console.log(
            `✅ Recurring Payment recorded for subscription ${subscriptionId}: $${amount} ${currency}`,
          );
        } catch (e) {
          // Send error to Discord
          try {
            await fetch(this.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `❌ **Subscription Renewal Error**\n\`\`\`json\n${JSON.stringify(e, null, 4)}\n\`\`\``,
              }),
            });
          } catch (error) {
            console.error('❌ Failed to send error Discord webhook:', error);
          }
          throw e; // Re-throw to handle at controller level
        }
        break;
      }

      // ✅ Handle Subscription Cancellations
      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const subscriptionId = resource.id;

        // ✅ Update subscription status to CANCELLED
        await this.paymentRepository.updatePaymentStatus(
          subscriptionId,
          'CANCELLED',
        );

        console.log(`⚠️ Subscription cancelled: ${subscriptionId}`);
        break;
      }

      // ✅ Handle Payment Failures (e.g., insufficient funds)
      case 'PAYMENT.SALE.DENIED': {
        const paypalPaymentId = resource.id;
        const subscriptionId = resource.billing_agreement_id;

        if (!subscriptionId) {
          console.warn(
            `⚠️ No subscription ID found for failed payment: ${paypalPaymentId}`,
          );
          return;
        }

        // ✅ Update subscription status to PAYMENT FAILED
        await this.paymentRepository.updatePaymentStatus(
          subscriptionId,
          'PAYMENT_FAILED',
        );

        console.log(`❌ Payment failed for subscription: ${subscriptionId}`);
        break;
      }

      default:
        console.log(`Unhandled event: ${eventType}`);
    }
  }
}
