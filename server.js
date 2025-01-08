import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { OpenAI } from "openai"; // Correct import syntax for OpenAI
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
  project: process.env.OPENAI_PROJECT_ID,
});

const emulateChatbotMdResponse = (response) => {
  const gptTestResponse = `How about a quick and easy Chicken Tomato Stir-Fry? It’s savory, simple to prepare, and perfect for a weeknight dinner. Here’s the recipe:
    
    ---
    
    **Markdown File Output:**  
    \`\`\`markdown
    # Chicken Tomato Stir-Fry  
    
    **Description:**  
    A savory stir-fry featuring juicy chicken and a tangy tomato-based sauce.  
    
    **Ingredients:**  
    - 2 chicken breasts, cut into strips  
    - 2 tomatoes, diced  
    - 1 onion, sliced  
    - 3 cloves garlic, minced  
    - 2 tbsp olive oil  
    - 1 tsp soy sauce  
    - 1 tsp sugar  
    - Salt and pepper, to taste  
    
    **Instructions:**  
    1. Heat olive oil in a skillet over medium-high heat. Sauté garlic until fragrant.  
    2. Add chicken strips and cook until golden brown.  
    3. Stir in onions and tomatoes, cooking until softened.  
    4. Add soy sauce, sugar, salt, and pepper, stirring to combine.  
    5. Serve hot over rice or noodles.  
    
    **Notes:**  
    - Add chili flakes for extra heat.  
    - Use canned tomatoes if fresh ones are unavailable.  
    \`\`\`
    `;
  return gptTestResponse;
};

const separateGPTResponse = (response) => {
  console.log(response);
  // Split the response at "**Markdown File Output**"
  const separator = "**Markdown File Output:**";
  const parts = response.split(separator);

  // Trim and store the message (top text)
  const message = parts[0]?.trim() || "";

  // Trim and store the Markdown content without the separator
  const markdown = parts[1]?.trim() || "";

  return { message, markdown };
};

// Routes
app.post("/ask-chef", async (req, res) => {
  const userPrompt = req.body;
  //   console.log(userPrompt);
  if (!userPrompt) {
    return res.status(400).json({ error: "Prompt is required!" });
  }

  //   try {
  //     const stream = await openai.chat.completions.create({
  //       model: "gpt-3.5-turbo", // or gpt-4, depending on your plan
  //       messages: [
  //         {
  //           role: "system",
  //           content:
  //             "You are a virtual kitchen assistant. Help the user by generating recipes, suggesting replacements for ingredients, or guiding them step-by-step.",
  //         },
  //         { role: "user", content: userPrompt },
  //       ],
  //       stream: true, // Enable streaming if you want real-time responses
  //     });

  //     let assistantResponse = "";
  //     for await (const chunk of stream) {
  //       assistantResponse += chunk.choices[0]?.delta?.content || "";
  //     }

  //     res.status(200).json({ response: assistantResponse });
  //   } catch (error) {
  //     console.error("Error interacting with OpenAI:", error.message);
  //     res.status(500).json({ error: "Failed to process the request." });
  //   }

  //   const { message, markdown } = emulateChatbotMdResponse(userPrompt.content);
  const gptResponse = emulateChatbotMdResponse();
  const { message, markdown } = separateGPTResponse(gptResponse);

  const chatLog = {
    id: "msg-12345",
    role: "system",
    content: message,
    markdown: markdown,
    created_at: Date.now(),
    conversation_id: "conv-67890",
    user_id: "user-abc123",
    session_id: "session-def456",
    message_type: "text",
    // status: "pending",
  };

  res.status(200).json({
    response: chatLog,
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
