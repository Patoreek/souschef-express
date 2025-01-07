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

// Routes
app.post("/ask-chef", async (req, res) => {
  const { userPrompt } = req.body;

  if (!userPrompt) {
    return res.status(400).json({ error: "Prompt is required!" });
  }

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // or gpt-4, depending on your plan
      messages: [
        {
          role: "system",
          content:
            "You are a virtual kitchen assistant. Help the user by generating recipes, suggesting replacements for ingredients, or guiding them step-by-step.",
        },
        { role: "user", content: userPrompt },
      ],
      stream: true, // Enable streaming if you want real-time responses
    });

    let assistantResponse = "";
    for await (const chunk of stream) {
      assistantResponse += chunk.choices[0]?.delta?.content || "";
    }

    res.status(200).json({ response: assistantResponse });
  } catch (error) {
    console.error("Error interacting with OpenAI:", error.message);
    res.status(500).json({ error: "Failed to process the request." });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
