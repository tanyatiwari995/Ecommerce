import { catchAsyncError } from "../../utils/catchAsyncError.js";
import { AppError } from "../../utils/AppError.js";
import { cartModel } from "../../../Database/models/cart.model.js";
import { productModel } from "../../../Database/models/product.model.js";
import dotenv from "dotenv";

import Stripe from "stripe";
import { userModel } from "../../../Database/models/user.model.js";

dotenv.config();

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 1) Create cash order
const createCashOrder = catchAsyncError(async (req, res, next) => {
  const cart = await cartModel.findById(req.params.id);
  if (!cart) return next(new AppError("Cart not found", 404));

  const totalOrderPrice = cart.totalPriceAfterDiscount || cart.totalPrice;

  const order = await orderModel.create({
    userId: req.user._id,
    cartItem: cart.cartItem,
    totalOrderPrice,
    shippingAddress: req.body.shippingAddress,
    paymentMethod: "cash"
  });

  // Decrement stock & increment sold
  const updates = cart.cartItem.map(item => ({
    updateOne: {
      filter: { _id: item.productId },
      update: { $inc: { quantity: -item.quantity, sold: item.quantity } }
    }
  }));
  await productModel.bulkWrite(updates);

  // Delete the cart
  await cartModel.findByIdAndDelete(req.params.id);

  res.status(201).json({ message: "success", order });
});

// 2) Get specific user order
const getSpecificOrder = catchAsyncError(async (req, res, next) => {
  const order = await orderModel
    .findOne({ userId: req.user._id })
    .populate("cartItem.productId");
  if (!order) return next(new AppError("Order not found", 404));
  res.status(200).json({ message: "success", order });
});

// 3) Get all orders
const getAllOrders = catchAsyncError(async (req, res) => {
  const orders = await orderModel
    .find({})
    .populate("cartItem.productId");
  res.status(200).json({ message: "success", orders });
});

// 4) Create Stripe checkout session
const createCheckOutSession = catchAsyncError(async (req, res, next) => {
  const cart = await cartModel.findById(req.params.id);
  if (!cart) return next(new AppError("Cart not found", 404));

  const totalOrderPrice = cart.totalPriceAfterDiscount || cart.totalPrice;

  const session = await stripe.checkout.sessions.create({
    line_items: [{
      price_data: {
        currency: "egp",
        unit_amount: Math.round(totalOrderPrice * 100),
        product_data: { name: req.user.name }
      },
      quantity: 1
    }],
    mode: "payment",
    success_url: process.env.STRIPE_SUCCESS_URL,
    cancel_url: process.env.STRIPE_CANCEL_URL,
    customer_email: req.user.email,
    client_reference_id: req.params.id,
    metadata: { shippingAddress: JSON.stringify(req.body.shippingAddress) }
  });

  res.status(200).json({ message: "success", session });
});

// 5) Stripe webhook handler
const createOnlineOrder = catchAsyncError(async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    await handlePaidOrder(event.data.object, next);
  }

  // Acknowledge receipt
  res.status(200).json({ received: true });
});

// Helper: process paid order
async function handlePaidOrder(session, next) {
  const cart = await cartModel.findById(session.client_reference_id);
  if (!cart) return next(new AppError("Cart not found in webhook", 404));

  const user = await userModel.findOne({ email: session.customer_email });
  if (!user) return next(new AppError("User not found in webhook", 404));

  const order = await orderModel.create({
    userId: user._id,
    cartItem: cart.cartItem,
    totalOrderPrice: session.amount_total / 100,
    shippingAddress: JSON.parse(session.metadata.shippingAddress),
    paymentMethod: "card",
    isPaid: true,
    paidAt: Date.now()
  });

  const updates = cart.cartItem.map(item => ({
    updateOne: {
      filter: { _id: item.productId },
      update: { $inc: { quantity: -item.quantity, sold: item.quantity } }
    }
  }));
  await productModel.bulkWrite(updates);

  await cartModel.findByIdAndDelete(cart._id);
}

export {
  createCashOrder,
  getSpecificOrder,
  getAllOrders,
  createCheckOutSession,
  createOnlineOrder
};