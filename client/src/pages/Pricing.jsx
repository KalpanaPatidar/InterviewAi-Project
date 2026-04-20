import React, { useState } from 'react'
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { motion } from "motion/react"
import { ServerUrl } from '../App';
import axios from "axios"
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';

function Pricing() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const dispatch = useDispatch()
  const plans = [
    {
      id: "beginner",
      name: "Beginner",
      price: 99,
      duration: "month",
      credits: 500,
      description: "For beginners getting started",
      features: [
        "5 Interview Sessions",
        "Basic Feedback",
        "Limited Analytics",
      ],
      highlight: false,
    },
    {
      id: "pro",
      name: "Pro",
      credits: 5000,
      price: 299,
      duration: "month",
      description: "Best for serious preparation",
      features: [
        "Unlimited Interviews",
        "Detailed AI Feedback",
        "Performance Analytics",
        "Download Reports (PDF)",
      ],
      highlight: true,
    },
    {
      id: "premium",
      name: "Premium",
      price: 999,
      credits: 10000,
      duration: "year",
      description: "Best value for long-term preparation",
      features: [
        "Unlimited Interviews (1 Year)",
        "All Pro Features Included",
        "Advanced AI Insights",
        "Priority Support",
        "Mock Interview Reports",
      ],
      highlight: false,
    },
  ];

  const handlePayment = async (plan) => {
    try {
      setLoadingPlan(plan.id)
      const amountMap = {
        beginner: 99,
        pro: 299,
        premium: 999,
      };

      const amount = amountMap[plan.id];

      const result = await axios.post(
        ServerUrl + "/api/payment/order",
        {
          planId: plan.id,
          amount: amount,
          credits: plan.credits,
        },
        { withCredentials: true }
      );
      console.log(result.data)
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: result.data.amount,
        currency: "INR",
        name: "InterviewIQ.AI",
        description: `${plan.name}-${plan.credits} Credits`,
        order_id: result.data.id,

        handler: async function (response) {
          const verifyPayment= await axios.post(ServerUrl + "/api/payment/verify",response,{withCredentials:true})
          dispatch(setUserData(verifyPayment.data.user))
          alert("Payment Successful Credits Added!");
          navigate("/")
        },
        theme: {
          color: "#10b981",
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
      setLoadingPlan(null);
    } catch (error) {
      console.log(error)
    }

  }
  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 py-16 px-6'>
      <div className='max-w-6xl mx-auto mb-14 flex items-center gap-4'>
        <button onClick={() => navigate("/")} className='mt-2 p-3 rounded-fullbg-white shadow hover:shadow-md transition'>
          <FaArrowLeft className='text-gray-600' />
        </button>

        <div className='text-center w-full'>
          <h1 className='text-4xl font-bold text-gray-800'>
            Choose Your Plan
          </h1>
          <p className='text-gray-500 mt-3 text-lg'>
            Flexible pricing to match your interview preparation goals.
          </p>
        </div>
      </div>
      <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto'>
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id
          return (
            <motion.div
              key={plan.name} // plan.id was undefined in your array, use plan.name
              whileHover={!plan.default ? { scale: 1.03 } : {}} // Use a proper ternary
              onClick={() => !plan.default && setSelectedPlan(plan.name)}
              className={`relative rounded-3xl p-8 transition-all duration-300 
              border ${selectedPlan === plan.name // Use plan.name since plan.id is missing
                  ? "border-emerald-600 shadow-2xl bg-white"
                  : "border-gray-200 bg-white shadow-md"
                }
                ${plan.default ? "cursor-default" : "cursor-pointer"}
               `}
            >

              {plan.badge && (
                <div className='absolute top-6 right-6 bg-emerald-600 text-white text-xs px-4 py-1 rounded-full shadow'>
                  {plan.badge}
                </div>
              )}

              {plan.default && (
                <div className='absolute top-6 right-6 bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full'>
                  Default
                </div>
              )}

              <h3 className='text-xl font-semibold text-gray-800'>
                {plan.name}
              </h3>

              <div className='mt-4'>
                <span className='text-3xl font-bold text-emerald-600'>
                  {plan.price}
                </span>
                <p className='text-gray-500 mt-4 text-sm leading-relaxed'>
                  {plan.description}
                </p>

                <div className='mt-6 space-y-3 text-left'>
                  {plan.features.map((feature, i) => (
                    <div key={i} className='flex items-center gap-3'>
                      <FaCheckCircle className='text-emerald-500 text-sm' />
                      <span className='text-gray-700 text-sm'>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
                {!plan.default &&
                  <button
                    disabled={loadingPlan === plan.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSelected) {
                        setSelectedPlan(plan.id)
                      } else {
                        handlePayment(plan)
                      }
                    }
                    }
                    className={`w-full mt-8 py-3 rounded-xl font-semibold transition
                  ${isSelected ? "bg-emerald-600 text-white hover:opacity-90"
                        : "bg-gray-100 text-gray-700 hover:bg-emerald-50"
                      }
                  `}>
                    {loadingPlan === plan.id ? "Processing..." :
                      isSelected ? "Proceed to Pay" : "Select plan"}
                  </button>
                }
              </div>

            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default Pricing