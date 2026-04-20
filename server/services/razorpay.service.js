import Razorpay from 'razorpay';
import dotenv from 'dotenv';
dotenv.config(); // Ensure config is loaded if not already in index.js

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default razorpay;