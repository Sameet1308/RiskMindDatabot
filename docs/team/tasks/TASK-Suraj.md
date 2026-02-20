# Suraj - AI/LLM Integration Tasks

## Your Role
AI/ML Engineer — Connect the application to real AI models and build the RAG pipeline.

## Setup
```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt

# Set your OpenAI API key in .env
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-your-key-here

uvicorn main:app --reload
```

## Important Files to Study First
- `backend/services/ai_service.py` — Current AI service (mock, openai, bedrock)
- `backend/routers/analysis.py` — How analysis endpoint works
- `frontend/src/pages/Chat.tsx` — Current chat UI (uses mock responses)

---

## Task 1: Connect Chat to Real LLM ⭐ HIGH PRIORITY
**Deadline:** End of Week 1

### What to Build
Replace the hardcoded mock chat responses with actual OpenAI API calls.

### Steps

**Step 1:** Create `backend/routers/chat.py`
```python
from fastapi import APIRouter
from pydantic import BaseModel
from openai import OpenAI
import os

router = APIRouter(prefix="/api", tags=["chat"])

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ChatRequest(BaseModel):
    message: str
    conversation_history: list = []

class ChatResponse(BaseModel):
    response: str
    sources: list = []

SYSTEM_PROMPT = """You are RiskMind AI, an underwriting co-pilot assistant.
You help insurance underwriters with:
- Policy risk analysis
- Claims data interpretation
- Underwriting guideline questions
- Loss ratio calculations
- Risk assessment recommendations

You have access to the following data:
- Commercial insurance policies (property, liability, workers comp)
- Claims history with amounts and dates
- Underwriting guidelines with section codes

Always be professional, cite guideline sections when relevant,
and provide data-driven answers."""

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add conversation history
    for msg in request.conversation_history:
        messages.append(msg)
    
    # Add current message
    messages.append({"role": "user", "content": request.message})
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        return ChatResponse(
            response=response.choices[0].message.content
        )
    except Exception as e:
        # Fallback to simple response if API fails
        return ChatResponse(
            response=f"I'm currently unable to process your request. Error: {str(e)}"
        )
```

**Step 2:** Register in `backend/main.py`
```python
from routers.chat import router as chat_router
app.include_router(chat_router)
```

**Step 3:** Update `frontend/src/services/api.ts` — Add chat method:
```typescript
async chat(message: string, history: any[] = []) {
  const response = await this.client.post('/api/chat', {
    message,
    conversation_history: history
  })
  return response.data
}
```

**Step 4:** Update `frontend/src/pages/Chat.tsx`
- Remove the hardcoded mock responses
- Call `apiService.chat(input)` instead
- Keep conversation history in state
- Show loading spinner while waiting

### Test It
1. Set `OPENAI_API_KEY` in `backend/.env`
2. Restart backend
3. Go to http://localhost:5173/chat
4. Ask: "What is a loss ratio?"
5. Should get real AI response

### Done When
- [ ] Chat sends messages to backend API
- [ ] Backend calls OpenAI and returns response
- [ ] Conversation flows naturally
- [ ] Falls back to mock if no API key

---

## Task 2: RAG Pipeline (Guidelines Search) ⭐ HIGH PRIORITY
**Deadline:** End of Week 2

### What to Build
When a user asks a question, find the most relevant guidelines and include them as context for the LLM.

### Architecture
```
User Question
    │
    ▼
[Convert to Embedding]
    │
    ▼
[Search Guidelines Vector Store] → Top 3 matches
    │
    ▼
[Build Prompt with Guidelines Context]
    │
    ▼
[Send to LLM] → Response with citations
```

### Steps

**Step 1:** Install dependencies
```bash
pip install chromadb tiktoken
```

**Step 2:** Create `backend/services/rag_service.py`
```python
import chromadb
from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
chroma_client = chromadb.Client()
collection = chroma_client.get_or_create_collection("guidelines")

def index_guidelines(guidelines: list):
    """Index all guidelines into vector store."""
    for g in guidelines:
        text = f"{g.section_code} - {g.title}: {g.content}"
        # Get embedding
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        embedding = response.data[0].embedding
        collection.add(
            documents=[text],
            embeddings=[embedding],
            ids=[str(g.id)],
            metadatas=[{"section": g.section_code, "title": g.title}]
        )

def search_guidelines(query: str, top_k: int = 3):
    """Search for relevant guidelines."""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=query
    )
    query_embedding = response.data[0].embedding
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )
    return results
```

**Step 3:** Update chat endpoint to use RAG
```python
# In chat.py, before calling LLM:
from services.rag_service import search_guidelines

# Search relevant guidelines
rag_results = search_guidelines(request.message)

# Add to prompt
context = "Relevant guidelines:\n"
for doc in rag_results['documents'][0]:
    context += f"- {doc}\n"

messages.append({
    "role": "system", 
    "content": f"Use these guidelines to answer:\n{context}"
})
```

**Step 4:** Index guidelines on startup
```python
# In main.py
@app.on_event("startup")
async def startup():
    # Load guidelines from DB and index them
    pass
```

### Done When
- [ ] Guidelines are indexed into ChromaDB on startup
- [ ] Chat questions search for relevant guidelines
- [ ] LLM response cites specific guideline sections
- [ ] Response includes which guidelines were used as sources

---

## Task 3: Enhance Memo with LLM
**Deadline:** End of Week 2

### What to Build
After Anshul builds the memo API, enhance the `memo_text` field using LLM.

### Steps
1. Wait for Anshul to complete the basic memo API
2. In the memo endpoint, call LLM with the structured data
3. LLM generates a professional narrative

### Prompt Template
```
Write a professional underwriting memorandum based on this data:

Policy: {policy_number} - {policyholder}
Claims: {count} claims totaling ${total}
Loss Ratio: {ratio}%
Risk Level: {level}
Industry Average Loss Ratio: {avg}%

Guidelines referenced:
{guidelines}

Write 3-4 paragraphs covering:
1. Policy overview and claims summary
2. Risk assessment with specific data points
3. Comparison to industry benchmarks
4. Recommendation with rationale
```

### Done When
- [ ] Memo endpoint returns LLM-generated narrative text
- [ ] Narrative is professional and data-driven
- [ ] Falls back to template if LLM unavailable

---

## Tips
- Start with Task 1 (Chat) — It's the foundation for everything
- Use `gpt-4o-mini` for development (cheaper)
- Keep your OpenAI API key in `.env` (never commit it!)
- Test in Swagger docs first, then test in the frontend
