import mongoose from "mongoose"
const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            family: 4
        })
        console.log("database connected")
    } catch (error) {
        console.log(`database error ${error}`)
    }
}
export default connectDb