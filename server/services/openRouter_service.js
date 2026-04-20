import axios from "axios"
import dotenv from "dotenv"
dotenv.config() 
export const askAi =  async (messages) => {
    try {
        if(!messages || !Array.isArray(messages)||messages.length===0){
            throw new Error("Messags array is empty");
            
        } 
        console.log("API KEY:", process.env.OPENROUTER_API_KEY)
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions",{
           model: "openai/gpt-4o-mini",
           messages: messages
        },{
        headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    
  },}
    );
    const content = response?.data?.choices?.[0]?.message?.content;
    if(!content || !content.trim()){
        throw new Error("AI returned empty response");
        
    }
    return content
    } catch (error) {
        console.log("openrouter error ",error.response?.data || error.message);
        throw new Error("openrouter api error");
        
    }
}