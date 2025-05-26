process.env.NODE_OPTIONS = '--no-warnings'; // Supprime tous les warnings

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";
import { ChatPromptTemplate } from "@langchain/core/prompts";

async function main() {
  const llm = new ChatOpenAI({
    modelName: "llama3-1b-instruct",
    openAIApiKey: "sk-any",
    configuration: { baseURL: "http://localhost:1234/v1" },
    maxRetries: 1 // Réduit les logs superflus
  });

  // Chargement PDF + mapping des polices inconnues
  const loader = new PDFLoader("test.pdf", {
    pdfjsOptions: {
      standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/"
    }
  });
  
  const docs = await loader.load();
  
  // Découpage
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocs = await splitter.splitDocuments(docs);

  // Ajout info personnalisée
  splitDocs.push(new Document({
    pageContent: "Hamidou Djibo a pour sport préféré le football"
  }));

  // Prompt
  const prompt = ChatPromptTemplate.fromTemplate(`
    Réponds en français aux questions de l'utilisateur en utlisant le context si besoin avec style télégraphique :
    Contexte: {context}
    Question: {input}
    Réponse concise:
  `);

  // Exécution
  const chain = loadQAStuffChain(llm, { prompt });
  const response = await chain.invoke({
    input_documents: splitDocs,
    input: "quelle est la filiere de bladou affoué"
  });

  console.log("🦙 Réponse :", response.text);
}

main().catch(console.error);