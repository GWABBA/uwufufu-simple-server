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
    'https://discord.com/api/webhooks/1371276492977471649/hz5Mi4SSD4hbcAi7DykUgn2hCC0DP3vCTBlP4W1oTaHfkkgWbhuTLbMTAZ-hsCJWF02R';

  async handleWebhook(event: any) {
    console.log('Received PayPal webhook event:', event);

    const eventType = event.event_type;
    const resource = event.resource;

    switch (eventType) {
      // ✅ Handle New Subscription Activation
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subscriptionId: string = resource.id; // I-...
        const paypalEmail = resource?.subscriber?.email_address || null;
        const customId = resource?.custom_id ?? null;

        if (!customId) {
          console.warn('⚠️ No user ID (custom_id) found in webhook');
          break;
        }

        // Normalize id type (number vs uuid)
        const normalizedUserId =
          typeof customId === 'string' && /^\d+$/.test(customId)
            ? Number(customId)
            : String(customId);

        const user = await this.usersRepository.findOne({
          where: { id: normalizedUserId as any, deletedAt: IsNull() },
        });

        if (!user) {
          console.warn(`⚠️ User not found for ID: ${customId}`);
          break;
        }

        // Dedupe by subscriptionId
        const existingSubscription = await this.paymentRepository.findOne({
          where: { subscriptionId },
        });
        if (existingSubscription) {
          console.log(
            `⚠️ Subscription ${subscriptionId} already exists. Skipping duplicate.`,
          );
          break;
        }

        const amount = this.toAmount(
          resource?.billing_info?.last_payment?.amount,
        );

        // Create initial ACTIVE payment row (linked to subscription)
        await this.paymentRepository.createPayment({
          user,
          subscriptionId,
          status: 'ACTIVE',
          payerEmail: paypalEmail,
          amount,
          currency:
            resource?.billing_info?.last_payment?.amount?.currency_code || null,
        });

        // Trial detection
        let trialDays = 0;
        const cycles = resource?.billing_info?.cycle_executions ?? [];
        if (Array.isArray(cycles) && cycles.length) {
          const trialCycle = cycles.find(
            (c: any) => c?.tenure_type === 'TRIAL',
          );
          if (trialCycle) trialDays = Number(trialCycle.total_cycles || 0);
        }

        // Compute subscription window
        const startDate = new Date();
        const endDate = new Date(startDate);
        if (trialDays > 0) {
          // Your business rule: 7 days free trial
          endDate.setDate(endDate.getDate() + 7);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        // IMPORTANT: use save (not update) to avoid silent no-op / type issues
        await this.usersRepository.save({
          id: user.id, // keep the PK from the loaded entity
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          tier: 'plus',
        });

        console.log(
          `✅ Subscription activated for user ${user.id} | Trial: ${trialDays > 0 ? 'Yes (7 days)' : 'No'} | End: ${endDate.toISOString()}`,
        );
        break;
      }

      // ✅ Handle Subscription Renewal Payments
      case 'PAYMENT.SALE.COMPLETED': {
        const saleId: string = resource.id; // sale/payment id
        // const amount = parseFloat(resource.amount.value);
        // const currency = resource.amount.currency_code;
        const subscriptionId: string | undefined =
          resource.billing_agreement_id; // link to subscription
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
          const errorMsg = `⚠️ No subscription ID (billing_agreement_id) on sale ${saleId}`;
          console.warn(errorMsg);
          try {
            await fetch(this.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `❌ ${errorMsg}` }),
            });
          } catch (error) {
            console.error('❌ Failed to send Discord webhook:', error);
          }
          return;
        }

        // 🔍 Find Existing Subscription Row (by subscriptionId)
        const existingSubRow = await this.paymentRepository.findOne({
          where: { subscriptionId },
          relations: ['user'],
        });

        if (!existingSubRow) {
          const errorMsg = `⚠️ No subscription row found for subscriptionId ${subscriptionId} (sale ${saleId})`;
          console.warn(errorMsg);
          try {
            await fetch(this.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `❌ ${errorMsg}` }),
            });
          } catch (error) {
            console.error('❌ Failed to send Discord webhook:', error);
          }
          return;
        }

        // Optional: dedupe saleId to avoid double inserts on retries
        const dupSale = await this.paymentRepository.findOne({
          where: { saleId },
        });
        if (dupSale) {
          console.log(
            `⚠️ Sale ${saleId} already recorded. Skipping duplicate.`,
          );
          break;
        }

        try {
          // 1) Mark current subscription row as COMPLETED
          await this.paymentRepository.updatePaymentStatusBySubscriptionId(
            subscriptionId,
            'COMPLETED',
          );

          const amount = this.toAmount(resource?.amount);
          const currency = resource?.amount?.currency_code ?? null;

          // 2) Create a new row representing this charge
          await this.paymentRepository.createPayment({
            user: existingSubRow.user,
            subscriptionId, // keep the link
            saleId, // store sale/payment id
            status: 'ACTIVE', // or 'PAID' if you add an enum
            amount,
            currency,
            payerEmail: paypalEmail,
          });

          // 3) Extend user's end date
          const currentEndDate =
            existingSubRow.user.subscriptionEndDate || new Date();
          const nextMonth = new Date(currentEndDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);

          await this.usersRepository.update(existingSubRow.user.id, {
            subscriptionEndDate: nextMonth,
            tier: 'plus',
          });

          // Success webhook
          try {
            await fetch(this.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `✅ **Subscription Renewed Successfully**\n👤 User ID: ${existingSubRow.user.id}\n🧾 Sale: ${saleId}\n💰 Amount: ${amount} ${currency}\n📅 New End Date: ${nextMonth.toISOString()}`,
              }),
            });
          } catch (error) {
            console.error('❌ Failed to send success Discord webhook:', error);
          }

          console.log(
            `✅ Renewal recorded: subscription ${subscriptionId}, sale ${saleId}: ${amount} ${currency}`,
          );
        } catch (e) {
          // Error webhook
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
          throw e; // bubble up
        }
        break;
      }

      // ✅ Handle Subscription Cancellations
      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const subscriptionId: string = resource.id;
        await this.paymentRepository.updatePaymentStatusBySubscriptionId(
          subscriptionId,
          'CANCELLED',
        );
        console.log(`⚠️ Subscription cancelled: ${subscriptionId}`);
        break;
      }

      // ✅ Handle Payment Failures (e.g., insufficient funds)
      case 'PAYMENT.SALE.DENIED': {
        const saleId: string = resource.id;
        const subscriptionId: string | undefined =
          resource.billing_agreement_id;
        if (!subscriptionId) {
          const msg = `⚠️ No subscription ID on denied sale ${saleId}`;
          console.warn(msg);
          try {
            await fetch(this.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `❌ ${msg}` }),
            });
          } catch (error) {
            console.error('❌ Failed to send Discord webhook:', error);
          }
          return;
        }

        await this.paymentRepository.updatePaymentStatusBySubscriptionId(
          subscriptionId,
          'PAYMENT_FAILED',
        );
        console.log(
          `❌ Payment denied for subscription: ${subscriptionId} (sale ${saleId})`,
        );
        break;
      }

      default:
        console.log(`Unhandled event: ${eventType}`);
    }
  }

  private toAmount(input: any): number | null {
    // Accept either { value: "12.34", currency_code: "USD" } or a plain string/number
    const raw =
      typeof input === 'object' && input !== null ? input.value : input;
    if (raw === undefined || raw === null || raw === '') return null;
    const n = typeof raw === 'number' ? raw : parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
}
