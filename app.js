import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "langchain/document";
import { loadQAStuffChain } from "langchain/chains";

async function main() {
  console.log("Using API URL:", process.env.OPENAI_API_BASE_URL);

  const llm = new ChatOpenAI({
    modelName: "llama-3.2-1b-instruct",
    temperature: 0.5,
    openAIApiKey: "sk-anykey", // Clé factice nécessaire
    configuration: {
      baseURL: process.env.OPENAI_API_BASE_URL
    }
  });

  const prompt = ChatPromptTemplate.fromTemplate(`
    Réponds à la question en utilisant le contexte.
    Contexte : {context}
    Question : {input}
  `);

  const infosHamid = new Document({
    pageContent: "Hamidou Djibo à pour sport préféré le football",
  });

  const chain = loadQAStuffChain(llm, { prompt });
  
  const result = await chain.call({
    input_documents: [infosHamid],
    input: "Quel est le sport préféré de Djibo Hamidou  ?"
  });

  console.log(result.text);
}

main().catch(console.error);