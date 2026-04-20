import Payment from "../models/payment.model.js";
import User from "../models/user.models.js";
import razorpay from "../services/razorpay.service.js";
import crypto from "crypto"

export const createOrder = async (req,res) =>{
    try{
        const {planId,amount,credits} = req.body;
        if(!amount || !credits){
            return res.status(400).json({message:"Invalid plan data"});
        }
        const options = {
            amount:amount * 100,
            currency:"INR",
            receipt:`receipt_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options)

        await Payment.create({
            userId:req.userId,
            planId,
            amount,
            credits,
            razorpayOrderId: order.id,
            status:"created",
        });
        res.json(order);
    }
    catch(error){
        return res.status(500).json({message:`failed to create Razorpay order${errror}`})
    }
}

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {

      // ✅ Get payment from DB
      const payment = await Payment.findOne({
        razorpayOrderId: razorpay_order_id,
      });

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const user = await User.findById(payment.userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log("Before:", user.credits);

      // ✅ Update credits
      user.credits += payment.credits;
      await user.save();

      console.log("After:", user.credits);

      // ✅ Update payment status
      payment.status = "paid";
      payment.razorpayPaymentId = razorpay_payment_id;
      await payment.save();

      return res.json({
        success: true,
        user,
      });

    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "failed to verify Razorpay order",
      error: error.message,
    });
  }
};