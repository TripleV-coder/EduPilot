import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SupportedProvider } from "@/lib/finance/types";

export async function POST(req: NextRequest) {
    try {
        const _providerHeader = req.headers.get("x-payment-provider") as SupportedProvider;
        // In real implementation, verify signature here using req.headers.get("verif-hash")

        const body = await req.json();

        // Simplification: In real world, each provider has different payload structure
        // We assume the provider sends transactionId map-able data
        const transactionId = body.id || body.transaction_id;
        const status = body.status; // "successful", "failed"

        if (!transactionId) {
            return NextResponse.json({ received: true }); // Acknowledge anyway
        }

        const payment = await prisma.payment.findFirst({
            where: { transactionId: String(transactionId) }
        });

        if (!payment) {
            console.warn(`Webhook received for unknown transaction: ${transactionId}`);
            return NextResponse.json({ received: true });
        }

        if (status === 'successful') {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'VERIFIED',
                    paidAt: new Date(),
                    providerData: body as any
                }
            });

            // Auto-reconcile logic: Update Fee or PaymentPlan
            // ... (Logic to update Fee.paidAmount would go here)
        } else if (status === 'failed') {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'CANCELLED',
                    providerData: body as any
                }
            });
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}
