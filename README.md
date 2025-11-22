# RAG Chatbot with Grok API

A Retrieval-Augmented Generation (RAG) chatbot built with Node.js, MongoDB, and integrated with Grok API. The chatbot can store documents, retrieve relevant information using vector embeddings, and generate contextual responses.

## Features

- 🤖 **RAG Implementation**: Store documents and retrieve relevant context for better responses
- 💬 **Chat Interface**: Clean, modern chat interface
- 📚 **Document Management**: Add and manage knowledge base documents
- 🔍 **Vector Search**: Uses OpenAI embeddings for semantic document retrieval
- 🚀 **Grok API Integration**: Powered by xAI's Grok for intelligent responses
- 💾 **MongoDB Storage**: Persistent storage for documents and chat history

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Grok API key (from xAI)
- OpenAI API key (optional - for better embeddings, fallback method available)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017
DB_NAME=chatbot_db
# OPENAI_API_KEY=your_openai_api_key_here  # Optional - for better embeddings
GROK_API_KEY=your_grok_api_key_here
GROK_API_URL=https://api.x.ai/v1/chat/completions
PORT=3000
```

## Running the Application

1. Make sure MongoDB is running (if using local MongoDB)

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Add Documents**: Click the "+ Add Document" button to add knowledge base documents. These will be used by the RAG system to provide contextual answers.

2. **Chat**: Type your questions in the chat input. The bot will:
   - Retrieve relevant documents using vector similarity
   - Use the context to generate accurate responses via Grok API
   - Display sources used for the response

3. **View Documents**: All stored documents are listed in the sidebar.

## API Endpoints

- `POST /api/chat` - Send a chat message
- `POST /api/documents` - Add a new document
- `GET /api/documents` - Get all documents
- `DELETE /api/documents/:id` - Delete a document
- `GET /api/chat/history/:conversationId` - Get chat history
- `GET /api/health` - Health check

## How RAG Works

1. **Document Storage**: When you add a document, it's converted to a vector embedding using OpenAI's text-embedding-ada-002 model.

2. **Query Processing**: When you ask a question, your query is also converted to an embedding.

3. **Retrieval**: The system finds the most similar documents using cosine similarity.

4. **Generation**: The retrieved context is sent to Grok API along with your question to generate an informed response.

## Configuration Notes

- **OpenAI API**: Optional - provides better embeddings for RAG. If not provided, a text-based fallback method is used. Get a key from [OpenAI](https://platform.openai.com/)
- **Grok API**: Required for chat responses. Get your key from [xAI](https://x.ai/)
- **MongoDB**: Can be local or cloud (MongoDB Atlas). Update `MONGODB_URI` accordingly.

## Troubleshooting

- **MongoDB Connection Error**: Ensure MongoDB is running and the connection string is correct
- **API Errors**: Check that your API keys are correctly set in the `.env` file
- **Embedding**: If OpenAI API key is not provided, the system uses a text-based fallback method (works but less accurate than OpenAI embeddings)

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!


