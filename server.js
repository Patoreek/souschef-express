import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { OpenAI } from "openai"; // Correct import syntax for OpenAI
import dotenv from "dotenv";
import pool from "./db.js"; // Import the pool from db.js

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
    
    **Cuisine:** Chinese  
    **Dish Name:** Chicken Tomato Stir-Fry  

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
  // Extract the cuisine
  const cuisineMatch = response.match(/\*\*Cuisine:\*\* (.+?)(?=\s{2,}|\n|$)/);
  const cuisine = cuisineMatch ? cuisineMatch[1].trim() : "";

  // Extract the dish name
  const dishNameMatch = response.match(
    /\*\*Dish Name:\*\* (.+?)(?=\s{2,}|\n|$)/
  );
  const dishName = dishNameMatch ? dishNameMatch[1].trim() : "";

  // Split response at "**Markdown File Output**"
  const separator = "**Markdown File Output:**";
  const parts = response.split(separator);

  // Trim and clean the message (top text)
  let message = parts[0]?.trim() || "";

  // Remove "---", "Dish Name", and "Cuisine" lines from the message
  message = message
    .replace(/---/, "") // Remove "---"
    .replace(/\*\*Cuisine:\*\*.*(\n|\s{2,})?/, "") // Remove the Cuisine line and trailing spaces/newlines
    .replace(/\*\*Dish Name:\*\*.*(\n|\s{2,})?/, "") // Remove the Dish Name line and trailing spaces/newlines
    .replace(/\n{2,}/g, "\n") // Remove excess blank lines
    .trim(); // Final cleanup

  // Trim and store the Markdown content without the separator
  const markdown = parts[1]?.trim() || "";

  return { cuisine, dishName, message, markdown };
};

// Routes
app.post("/ask-chef", async (req, res) => {
  //** USER PROMPT **/
  const userPrompt = req.body;
  if (!userPrompt) {
    return res.status(400).json({ error: "Prompt is required!" });
  }
  console.log(userPrompt);
  const userChatStored = await storeChatLog(userPrompt, userPrompt.role);
  if (!userChatStored)
    res
      .status(500)
      .json({ error: "Failed to store the users prompt in the database." });

  //** GPT RESPONSE **/
  //   const { message, markdown } = emulateChatbotMdResponse(userPrompt.content);
  const gptResponse = emulateChatbotMdResponse();
  const { cuisine, dishName, message, markdown } =
    separateGPTResponse(gptResponse);

  const cuisineData = await createOrGetCuisine(cuisine);
  const recipeData = await createOrUpdateRecipe(
    userPrompt,
    cuisineData,
    dishName,
    markdown
  );

  const gptChatLog = {
    role: "system",
    content: message,
    dishName: dishName,
    cuisine: cuisineData.id,
    recipe: recipeData.id,
    conversation_id: userPrompt.conversation_id,
    user_id: 1,
    message_type: "text",
  };
  const gptChatStored = await storeChatLog(gptChatLog, gptChatLog.role);

  if (!gptChatStored)
    res
      .status(500)
      .json({ error: "Failed to store the GPT prompt in the database." });

  console.log("userChatStored:", userChatStored);
  console.log("gptChatStored:", gptChatStored);

  res.status(200).json({
    userPrompt: userChatStored,
    gptChat: gptChatStored,
  });

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
});

app.post("/create-conversation", async (req, res) => {
  console.log("creating new conversation in db...");
  const userId = 1; // For now, we'll set user_id to 1

  try {
    const result = await pool.query(
      "INSERT INTO conversations (user_id) VALUES ($1) RETURNING *",
      [userId]
    );

    res.status(201).json({
      message: "Conversation created successfully",
      data: result.rows[0], // Return the created conversation row
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ message: "Database error", error });
  }
});

const createOrUpdateRecipe = async (
  userPrompt,
  cuisineData,
  dishName,
  markdown
) => {
  try {
    const { user_id, conversation_id } = userPrompt;

    const existingRecipeResult = await pool.query(
      "SELECT * FROM recipes WHERE user_id = $1 AND dish_name = $2",
      [user_id, dishName]
    );
    if (existingRecipeResult.rows.length > 0) {
      const existingRecipe = existingRecipeResult.rows[0];

      const updateResult = await pool.query(
        `UPDATE recipes
        SET markdown = $1, cuisine_id = $2, created_at = CURRENT_TIMESTAMP
        WHERE recipe_id = $3
        RETURNING *`,
        [markdown || null, cuisineData.cuisine_id, existingRecipe.recipe_id]
      );

      console.log("Updated recipe:", updateResult.rows[0]);
      return updateResult.rows[0]; // Return the updated recipe row
    }

    // If the recipe does not exist, insert a new recipe
    const insertResult = await pool.query(
      `INSERT INTO recipes (user_id, og_conversation_id, dish_name, cuisine_id, markdown, created_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          RETURNING *`,
      [
        user_id,
        conversation_id,
        dishName,
        cuisineData.cuisine_id,
        markdown || null,
      ]
    );

    console.log("New recipe created:", insertResult.rows[0]);
    return insertResult.rows[0];
  } catch (error) {
    console.error("Error creating or updating recipe:", error);
    throw error;
  }
};

const createOrGetCuisine = async (cuisine) => {
  try {
    if (cuisine) {
      const result = await pool.query(
        "SELECT * FROM cuisines WHERE cuisine_name = $1",
        [cuisine]
      );
      if (result.rows.length > 0) {
        console.log("Cuisine found:", result.rows[0]);
        return result.rows[0];
      }
    } else {
      // If the cuisine does not exist, insert a new row
      const insertResult = await pool.query(
        "INSERT INTO cuisines (cuisine_name) VALUES ($1) RETURNING *",
        [cuisine]
      );

      return insertResult.rows[0];
    }
  } catch (error) {
    console.error("Error checking or creating cuisine:", error);
    throw error;
  }
};

const storeChatLog = async (chatLog, role) => {
  try {
    const result = await pool.query(
      "INSERT INTO chatlogs (role, content, created_at, conversation_id, user_id, message_type, markdown) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6) RETURNING *",
      [
        chatLog.role,
        chatLog.content,
        chatLog.conversation_id,
        chatLog.user_id,
        chatLog.message_type,
        chatLog.markdown || null, // If markdown exists, pass it; otherwise, pass null
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error storing chatlog:", error);
    return false;
  }
};

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
