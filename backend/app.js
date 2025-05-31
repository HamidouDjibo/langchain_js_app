import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { ChatOpenAI } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { loadQAStuffChain } from "langchain/chains";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration des chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`📁 Dossier uploads créé : ${uploadDir}`);
}

const app = express();
app.use(cors());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: false
}));
app.use(express.json());

let splitDocs = [];

// Configuration LLM Hermes via LM Studio
const llm = new ChatOpenAI({
  modelName: "hermes-3-llama-3.2-3b",
  openAIApiKey: "lm-studio",
  configuration: { 
    baseURL: "http://localhost:1234/v1",
  },
  temperature: 0.4,
  maxTokens: 1000
});

// Configuration du splitter
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1200,
  chunkOverlap: 300,
  separators: ["\n\n", "\n", ". ", "! ", "? "]
});

// Prompt pour mode RAG (avec document)
const ragPrompt = ChatPromptTemplate.fromTemplate(`
  <|im_start|>system
  Vous êtes un assistant expert en analyse documentaire. Répondez précisement et clairement en français en utilisant si fourni le contexte suivant.<|im_end|>
  
  <|im_start|>context
  {context}<|im_end|>
  
  <|im_start|>user
  {input}<|im_end|>
  
  <|im_start|>assistant
`);

// Prompt pour mode général (sans document)
const generalPrompt = ChatPromptTemplate.fromTemplate(`
  <|im_start|>system
  Vous êtes un assistant IA utile. Répondez en français à la question de l'utilisateur.<|im_end|>
  
  <|im_start|>user
  {input}<|im_end|>
  
  <|im_start|>assistant
`);

// Endpoint d'upload
app.post('/upload', async (req, res) => {
  try {
    if (!req.files?.pdf) {
      return res.status(400).json({ error: "Aucun fichier PDF uploadé" });
    }

    const pdfFile = req.files.pdf;
    const fileName = `${Date.now()}_${pdfFile.name.replace(/ /g, '_')}`;
    const filePath = path.join(uploadDir, fileName);

    await pdfFile.mv(filePath);
    console.log(`✅ Fichier sauvegardé : ${filePath}`);

    // Chargement du PDF
    const loader = new PDFLoader(filePath, {
      pdfjsOptions: {
        standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/"
      }
    });
    
    const docs = await loader.load();
    splitDocs = await splitter.splitDocuments(docs);
    
    res.json({ 
      success: true, 
      pages: splitDocs.length,
      fileName: pdfFile.name
    });

  } catch (err) {
    console.error('❌ Erreur upload:', err);
    res.status(500).json({
      error: `Échec du traitement du PDF: ${err.message}`,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Endpoint de réinitialisation
app.post('/reset', (req, res) => {
  try {
    const previousCount = splitDocs.length;
    splitDocs = [];
    
    // Suppression physique des fichiers
    if (req.body.deleteFiles) {
      fs.readdirSync(uploadDir).forEach(file => {
        fs.unlinkSync(path.join(uploadDir, file));
      });
      console.log(`🗑️ Supprimé tous les fichiers dans ${uploadDir}`);
    }
    
    res.json({
      success: true,
      message: `Documents réinitialisés (${previousCount} documents supprimés)`,
      mode: "Général"
    });
    
  } catch (err) {
    console.error('❌ Erreur reset:', err);
    res.status(500).json({
      error: "Échec de la réinitialisation",
      details: err.message
    });
  }
});

// Endpoint de chat
app.post('/chat', async (req, res) => {
  try {
    const question = req.body.question?.trim();
    if (!question) {
      return res.status(400).json({ error: "Question vide" });
    }

    // Mode RAG si documents chargés
    if (splitDocs.length > 0) {
      const ragChain = loadQAStuffChain(llm, { prompt: ragPrompt });
      const inputDocs = splitDocs.slice(0, 5);
      
      const result = await ragChain.call({
        input_documents: inputDocs,
        input: question
      });

      return res.json({ 
        response: result.text,
        mode: "RAG",
        sources: [...new Set(inputDocs.map(d => d.metadata?.source || 'source inconnue'))]
      });
    } 
    // Mode général sans documents
    else {
      const generalChain = loadQAStuffChain(llm, { prompt: generalPrompt });
      const result = await generalChain.call({
        input_documents: [],
        input: question
      });

      return res.json({ 
        response: result.text,
        mode: "Général",
        sources: []
      });
    }

  } catch (err) {
    console.error('❌ Erreur chat:', err);
    res.status(500).json({
      error: "Erreur de traitement de la question",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.listen(3000, () => {
  console.log('🚀 Serveur Hermes RAG sur http://localhost:3000');
  console.log(`📂 Dossier uploads: ${uploadDir}`);
  console.log('Endpoints: /upload [POST], /chat [POST], /reset [POST]');
});