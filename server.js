const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB connection
let db;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'chatbot_db';

// OpenAI for embeddings (for RAG) - optional
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Initialize MongoDB connection
async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB');
    
    // Create indexes for better performance
    await db.collection('chat_history').createIndex({ timestamp: -1 });
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Generate embeddings using OpenAI or fallback method
async function generateEmbedding(text) {
  // Check if OpenAI API key is available
  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding with OpenAI:', error);
      // Fall through to fallback method
    }
  }
  
  // Fallback: Simple text-based embedding using word frequency
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Create a hash-based vector (1536 dimensions to match OpenAI)
  const vector = new Array(1536).fill(0);
  const uniqueWords = Object.keys(wordFreq);
  
  uniqueWords.forEach((word, idx) => {
    // Simple hash function to distribute words across dimensions
    for (let i = 0; i < word.length; i++) {
      const hash = (word.charCodeAt(i) * (idx + 1)) % 1536;
      vector[hash] += wordFreq[word] / uniqueWords.length;
    }
  });
  
  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return vector.map(val => val / magnitude);
  }
  
  return vector;
}

// Calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Store document in database with embedding
app.post('/api/documents', async (req, res) => {
  try {
    const { text, title } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const embedding = await generateEmbedding(text);
    
    const document = {
      text,
      title: title || 'Untitled',
      embedding,
      createdAt: new Date()
    };
    
    await db.collection('documents').insertOne(document);
    
    res.json({ message: 'Document stored successfully', id: document._id });
  } catch (error) {
    console.error('Error storing document:', error);
    res.status(500).json({ error: 'Failed to store document' });
  }
});

// Retrieve relevant documents using RAG
async function retrieveRelevantDocuments(query, limit = 3) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    
    const documents = await db.collection('documents').find({}).toArray();
    
    // Calculate similarity scores
    const scoredDocs = documents.map(doc => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding)
    }));
    
    // Sort by similarity and return top results
    return scoredDocs
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(doc => doc.similarity > 0.5); // Threshold for relevance
  } catch (error) {
    console.error('Error retrieving documents:', error);
    return [];
  }
}

// Call Grok API
async function callGrokAPI(messages) {
  try {
    const GROK_API_KEY = process.env.GROK_API_KEY;
    const GROK_API_URL = process.env.GROK_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    
    if (!GROK_API_KEY) {
      throw new Error('Grok API key not configured');
    }
    
    const response = await axios.post(
      GROK_API_URL,
      {
        model: 'meta-llama/llama-guard-4-12b',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Grok API error:', error.response?.data || error.message);
    
    // Fallback response if Grok API fails
    if (error.response?.status === 401) {
      throw new Error('Invalid Grok API key');
    }
    
    // Return a mock response for testing if API is not available
    return `[Mock Response] I understand you're asking about: ${messages[messages.length - 1].content}. This is a placeholder response. Please configure your Grok API key.`;
  }
}

// Chat endpoint with RAG
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Retrieve relevant documents using RAG
    const relevantDocs = await retrieveRelevantDocuments(message);
    
    // Build context from retrieved documents
    let context = '';
    if (relevantDocs.length > 0) {
      context = 'Relevant context:\n' + relevantDocs.map(doc => `- ${doc.text}`).join('\n\n');
    }
    
    // Get conversation history
    let conversationHistory = [];
    if (conversationId) {
      const history = await db.collection('chat_history')
        .find({ conversationId })
        .sort({ timestamp: 1 })
        .limit(10)
        .toArray();
      conversationHistory = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    }
    
    // Build messages for Grok API
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant. Use the following context to answer questions accurately: ${context || 'No specific context available. Answer based on your general knowledge.'}`
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];
    
    // Call Grok API
    const response = await callGrokAPI(messages);
    
    // Save to chat history
    const chatId = conversationId || new Date().getTime().toString();
    await db.collection('chat_history').insertMany([
      {
        conversationId: chatId,
        role: 'user',
        content: message,
        timestamp: new Date()
      },
      {
        conversationId: chatId,
        role: 'assistant',
        content: response,
        timestamp: new Date()
      }
    ]);
    
    res.json({
      response,
      conversationId: chatId,
      relevantDocs: relevantDocs.map(doc => ({ title: doc.title, text: doc.text.substring(0, 200) }))
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to process chat message' });
  }
});

// Get chat history
app.get('/api/chat/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const history = await db.collection('chat_history')
      .find({ conversationId })
      .sort({ timestamp: 1 })
      .toArray();
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get all documents
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await db.collection('documents')
      .find({})
      .project({ text: 0, embedding: 0 }) // Exclude large fields
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('documents').deleteOne({ _id: id });
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: db ? 'connected' : 'disconnected' });
});

// Start server
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();


