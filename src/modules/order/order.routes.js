import express from "express";
import { allowedTo, protectedRoutes } from "../auth/auth.controller.js";
import * as order from "../order/order.controller.js";

const orderRouter = express.Router();

// Create cash order & (optionally) fetch own order by ID
orderRouter
  .route("/:id")
  .post(protectedRoutes, allowedTo("user"), order.createCashOrder)
  .get(protectedRoutes, allowedTo("user"), order.getSpecificOrder);

// Stripe checkout session
orderRouter.post(
  "/checkout/:id",
  protectedRoutes,
  allowedTo("user"),
  order.createCheckOutSession
);

// Admin: get all orders
orderRouter.get(
  "/all",
  protectedRoutes,
  allowedTo("admin"),
  order.getAllOrders
);

export default orderRouter;
