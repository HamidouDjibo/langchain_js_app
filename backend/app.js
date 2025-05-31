import express from 'express';
import cors from 'cors';
import 'dotenv/config'; 
import fileUpload from 'express-fileupload';
import { ChatOpenAI } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const app = express();
app.use(cors());
app.use(fileUpload());
app.use(express.json());

let splitDocs = [];

// Configuration LLM
const llm = new ChatOpenAI({
    modelName: "llama-3.2-1b-instruct",
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_API_BASE_URL }
});

// Endpoint d'upload
app.post('/upload', async (req, res) => {
    if (!req.files?.pdf) return res.status(400).send('Aucun PDF uploadé');

    const pdfPath = `./uploads/${Date.now()}.pdf`;
    await req.files.pdf.mv(pdfPath);

    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });

    splitDocs = await splitter.splitDocuments(docs);
    res.json(splitDocs.map(doc => doc.pageContent));
});

// Endpoint de chat
app.post('/chat', async (req, res) => {
    const prompt = ChatPromptTemplate.fromTemplate(`
        Réponds en français en t'appuyant sur ce contexte :
        {context}
        
        Question : {input}
        Réponse concise :
    `);

    const chain = loadQAStuffChain(llm, { prompt });
    
    try {
        const result = await chain.call({
            input_documents: splitDocs,
            input: req.body.question
        });

        res.json({ response: result.text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('Serveur prêt sur http://localhost:3000'));