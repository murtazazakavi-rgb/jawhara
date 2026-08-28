import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;

  try {
    const paymentRequest = await prisma.paymentRequest.findUnique({
      where: { providerPaymentLinkId: linkId },
      include: {
        order: {
          include: { customer: true },
        },
      },
    });

    if (!paymentRequest) {
      return new Response('Payment Link Not Found', { status: 404 });
    }

    const order = paymentRequest.order;
    const customer = order.customer;
    const amount = Number(paymentRequest.amount);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Jawhara Checkout Simulator</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #fbf9f7;
            color: #1b1c1b;
            font-family: 'Plus Jakarta Sans', sans-serif;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            background: #ffffff;
            border: 1px solid #d1c3c8;
            border-radius: 4px;
            padding: 40px;
            max-width: 420px;
            width: 100%;
            box-shadow: 0px 4px 20px rgba(117, 85, 102, 0.04);
            text-align: center;
          }
          .title {
            font-family: 'Playfair Display', serif;
            font-size: 26px;
            color: #755566;
            margin-bottom: 24px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #efedec;
            padding: 12px 0;
            font-size: 13px;
          }
          .label {
            color: #807479;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
          }
          .value {
            font-weight: 550;
            color: #1b1c1b;
          }
          .amount-row {
            border-bottom: none;
            padding-top: 20px;
            margin-bottom: 24px;
          }
          .amount-val {
            font-family: 'Playfair Display', serif;
            font-size: 32px;
            color: #755566;
            font-weight: 600;
          }
          .btn {
            background-color: #755566;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            padding: 14px 24px;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            cursor: pointer;
            width: 100%;
            transition: opacity 0.2s;
          }
          .btn:hover {
            opacity: 0.9;
          }
          .btn:disabled {
            background-color: #807479;
            cursor: not-allowed;
          }
          .success-msg {
            color: #2e7d32;
            font-size: 14px;
            font-weight: 600;
            margin-top: 16px;
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">Jawhara OS</div>
          <div class="label" style="font-size: 11px; margin-bottom: 20px;">Checkout Sandbox Simulator</div>
          
          <div class="row">
            <span class="label">Order Number</span>
            <span class="value">${order.orderNumber}</span>
          </div>
          <div class="row">
            <span class="label">Customer</span>
            <span class="value">${customer.name}</span>
          </div>
          <div class="row">
            <span class="label">Mobile</span>
            <span class="value">${customer.mobile}</span>
          </div>
          
          <div class="amount-row">
            <div class="label" style="font-size: 10px; margin-bottom: 4px;">Total Amount</div>
            <div class="amount-val">₹${amount.toLocaleString('en-IN')}</div>
          </div>
          
          <button id="payBtn" class="btn">Simulate Successful Payment</button>
          <div id="successMsg" class="success-msg">Payment simulated successfully! You can close this tab now.</div>
        </div>

        <script>
          const payBtn = document.getElementById('payBtn');
          const successMsg = document.getElementById('successMsg');

          payBtn.addEventListener('click', async () => {
            payBtn.disabled = true;
            payBtn.textContent = 'Processing...';

            const payload = {
              event: 'payment_link.paid',
              payload: {
                payment_link: {
                  entity: {
                    id: '${linkId}',
                    status: 'paid',
                    reference_id: '${order.id}',
                    amount: ${amount * 100},
                    amount_paid: ${amount * 100},
                    short_url: window.location.href
                  }
                },
                payment: {
                  entity: {
                    id: 'pay_simulated_' + Date.now(),
                    amount: ${amount * 100},
                    currency: 'INR',
                    status: 'captured',
                    method: 'simulated_card'
                  }
                }
              }
            };

            try {
              const res = await fetch('/api/webhooks/razorpay', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
              });

              if (res.ok) {
                payBtn.style.display = 'none';
                successMsg.textContent = 'Payment simulated successfully! Redirecting to receipt...';
                successMsg.style.display = 'block';
                setTimeout(() => {
                  window.location.href = '/orders/${order.id}/receipt';
                }, 1500);
              } else {
                alert('Webhook simulation failed.');
                payBtn.disabled = false;
                payBtn.textContent = 'Simulate Successful Payment';
              }
            } catch (err) {
              console.error(err);
              alert('Network error triggering simulation.');
              payBtn.disabled = false;
              payBtn.textContent = 'Simulate Successful Payment';
            }
          });
        </script>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: any) {
    console.error('pay-mock route error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
