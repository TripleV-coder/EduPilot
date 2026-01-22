import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentProviderFactory } from "@/lib/finance/factory";
import { SupportedProvider } from "@/lib/finance/types";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { amount, currency, feeId, studentId, provider } = body;

        // 1. Create Pending Payment Record
        const payment = await prisma.payment.create({
            data: {
                amount,
                method: "MOBILE_MONEY_MTN", // Defaulting for now, should be from body
                provider: provider,
                feeId,
                studentId,
                status: "PENDING",
                reference: `PAY-${Date.now()}`,
            },
        });

        // 2. Initiate with Provider
        const paymentProvider = PaymentProviderFactory.getProvider(provider as SupportedProvider);
        const result = await paymentProvider.initiatePayment(
            amount,
            currency || 'XOF',
            session.user.email!,
            payment.reference!,
            { paymentId: payment.id }
        );

        // 3. Update with Transaction ID
        await prisma.payment.update({
            where: { id: payment.id },
            data: { transactionId: result.transactionId }
        });

        return NextResponse.json({
            paymentUrl: result.paymentUrl,
            transactionId: result.transactionId,
            paymentId: payment.id
        });

    } catch (error) {
        console.error("Payment Init Error:", error);
        return NextResponse.json({ error: "Payment initiation failed" }, { status: 500 });
    }
}
