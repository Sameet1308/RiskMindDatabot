# Enhanced UNDERSTAND Intent Flow - Context-Aware with Clarification

## Overview
This document describes the enhanced intent flow that makes RiskMind feel like a real conversational assistant with intelligent clarification and canvas suggestions.

---

## 🎯 Key Features

### 1. **Clickable Intent Suggestions**
When RiskMind is confused (confidence < 50%), it shows clickable intent options:
- 📊 Analyze with Dashboard
- 📝 Understand Details
- ✅ Make a Decision
- 📄 Generate Memo

### 2. **Fallback to Keyword Mapping**
If user doesn't click suggestions, system uses keyword mapping to auto-detect intent

### 3. **Context-Aware Session Tracking**
Intent can change during the same chat session based on conversation flow

### 4. **Explicit Clarification Prompts**
When confused, RiskMind explicitly asks: "I'm not entirely sure what you're looking for. Could you help me understand better?"

### 5. **Intelligent Canvas Prompts**
For long/complex responses, system suggests: "📊 For a better view, check the Intelligent Canvas on the right"

---

## 📊 Flow Diagram

```
User Message
    ↓
Intent Engine Analysis
    ↓
Confidence Score
    ↓
    ├─→ Confidence ≥ 60: Execute intent directly
    │   ├─→ Response generated
    │   ├─→ Check response length
    │   │   ├─→ >500 chars: Add canvas suggestion
    │   │   └─→ ≤500 chars: Chat only
    │   └─→ Return response
    │
    ├─→ Confidence 50-59: Low confidence
    │   ├─→ Generate suggested prompts
    │   ├─→ Use keyword mapping fallback
    │   └─→ Return response with suggestions
    │
    └─→ Confidence <50: Clarification needed
        ├─→ Generate suggested_intents (clickable)
        ├─→ Show: "I'm not entirely sure..."
        ├─→ User clicks intent option
        │   ├─→ Sets output_type
        │   ├─→ Fills input with example
        │   └─→ Re-processes with context
        │
        └─→ OR user rephrases manually
            └─→ Keyword mapping fallback
```

---

## 🔧 Implementation Details

### Backend: Intent Engine ([intent_engine.py](backend/services/intent_engine.py#L901-L945))

#### 1. Confidence Calculation
```python
confidence, reason_codes = _estimate_confidence(...)

# Low confidence thresholds:
# < 50: Clarification needed
# 50-59: Low confidence, use fallback
# ≥ 60: Good confidence, proceed
```

#### 2. Clarification Detection
```python
clarification_needed = confidence < 50
suggested_intents = []

if clarification_needed:
    suggested_intents = [
        {
            "label": "📊 Analyze with Dashboard",
            "intent": "Analyze",
            "output_type": "dashboard",
            "example": "Show me trends and visualizations",
            "keywords": ["chart", "trend", "compare", "breakdown"]
        },
        ...
    ]
```

#### 3. Long Response Detection
```python
suggest_canvas_view = False
if analysis_text and len(analysis_text) > 500:
    suggest_canvas_view = True
    # Force show canvas for long responses
    if canonical_intent == "Understand":
        show_canvas_summary = True
```

#### 4. API Response
```python
return {
    "analysis_text": analysis_text,
    "clarification_needed": clarification_needed,
    "suggested_intents": suggested_intents,
    "suggest_canvas_view": suggest_canvas_view,
    "show_canvas_summary": show_canvas_summary,
    ...
}
```

---

### Backend: Chat Router ([chat.py](backend/routers/chat.py#L581-L640))

#### 1. Extract Clarification Flags
```python
clarification_needed = pipeline.get("clarification_needed", False)
suggested_intents = pipeline.get("suggested_intents", [])
suggest_canvas_view = pipeline.get("suggest_canvas_view", False)
```

#### 2. Handle Clarification
```python
if clarification_needed and not response_text:
    response_text = (
        "I'm not entirely sure what you're looking for. "
        "Could you help me understand better?\n\n"
        "You can click one of the options below, or rephrase your question."
    )
```

#### 3. Add Canvas Suggestion
```python
if suggest_canvas_view and response_text:
    response_text += "\n\n📊 *For a better view of all the details, check the Intelligent Canvas on the right.*"
```

#### 4. Return Enhanced Response
```python
return ChatResponse(
    response=response_text,
    clarification_needed=clarification_needed,
    suggested_intents=suggested_intents,
    suggest_canvas_view=suggest_canvas_view,
    show_canvas_summary=show_canvas_summary,
    ...
)
```

---

### Frontend: Message Interface ([RiskMind.tsx](frontend/src/pages/RiskMind.tsx#L38-L49))

```typescript
type Message = {
    id: number
    role: 'user' | 'assistant'
    content: string
    sources?: { section: string; title: string }[]
    suggestedPrompts?: string[]
    suggestedIntents?: {
        label: string
        intent: string
        output_type: string
        example: string
        keywords: string[]
    }[]
    timestamp: Date
}
```

---

### Frontend: Intent Chips Rendering ([RiskMind.tsx](frontend/src/pages/RiskMind.tsx#L1920-L1950))

```typescript
{m.role === 'assistant' && m.suggestedIntents && m.suggestedIntents.length > 0 && (
    <div className="bubble-suggestions intent-suggestions">
        <span className="suggestions-label">Choose what you'd like to do:</span>
        <div className="suggestion-chips intent-chips">
            {m.suggestedIntents.map((intentOption, idx) => (
                <button
                    key={idx}
                    className="suggestion-chip intent-chip"
                    onClick={() => {
                        // Set the input to the example
                        setInput(intentOption.example)
                        // Pin the output type to the selected intent
                        setSelectedOutputType(intentOption.output_type as any)
                        setOutputPinned(true)
                        // Send the message with context
                        handleSend()
                    }}
                    title={`Keywords: ${intentOption.keywords.join(', ')}`}
                >
                    <span className="intent-label">{intentOption.label}</span>
                    <span className="intent-example">{intentOption.example}</span>
                </button>
            ))}
        </div>
    </div>
)}
```

---

## 🎬 User Experience Examples

### Example 1: Ambiguous Query → Clarification Needed

**User:** "Show me data"

**RiskMind Response:**
```
I'm not entirely sure what you're looking for. Could you help me understand better?

You can click one of the options below, or rephrase your question with more details.

[Choose what you'd like to do:]

📊 Analyze with Dashboard
   Show me trends and visualizations

📝 Understand Details
   Explain this policy or claim

✅ Make a Decision
   Should we accept or decline?

📄 Generate Memo
   Create underwriting memo
```

**User Clicks:** "📊 Analyze with Dashboard"

**Result:**
- Input filled with: "Show me trends and visualizations"
- Output type pinned to: "dashboard"
- Message sent with full context
- Dashboard widgets created

---

### Example 2: Long Response → Canvas Suggestion

**User:** "Tell me about policy COMM-2024-016"

**Backend:**
- Intent: `policy_risk_summary`
- Confidence: 75%
- Response length: 650 characters (>500)
- `suggest_canvas_view = true`
- `show_canvas_summary = true`

**RiskMind Response:**
```
Policy COMM-2024-016 for ABC Corporation has 5 claims totaling $125,000.
The loss ratio is 62.5%, which is above our standard threshold of 60%.

Key concerns include:
- High claim frequency (5 claims in 12 months)
- Recent large claim ($50,000 property damage)
- Industry risk factor (construction)

The policy is currently categorized as HIGH RISK based on our underwriting guidelines...

📊 *For a better view of all the details, check the Intelligent Canvas on the right.*
```

**Canvas Display:**
- Full Summary card with KPIs
- Key drivers (bullet points)
- Evidence panel (SQL, guidelines, Glass Box)

---

### Example 3: Conversational Follow-Up → Context Maintained

**User:** "Tell me about our portfolio"

**RiskMind:** [Conversational response, chat-only]

**User:** "Now show me claims by industry"

**Backend:**
- Previous intent: `portfolio_summary` (Understand)
- Current keywords: "show", "by" → `ad_hoc_query` (Analyze)
- Intent changed during session ✅
- Context maintained from history

**RiskMind:** [Dashboard with bar chart of claims by industry]

---

## 📋 Testing Checklist

### ✅ Test 1: Clarification Flow
**Input:** "Show me data"
**Expected:**
- ✅ Confidence < 50
- ✅ `clarification_needed = true`
- ✅ Suggested intents displayed (4 options)
- ✅ Each intent is clickable
- ✅ Clicking fills input and sends message
- ✅ Output type is pinned to selected intent

---

### ✅ Test 2: Canvas Suggestion for Long Response
**Input:** "Explain the risk factors for COMM-2024-016"
**Expected:**
- ✅ Response > 500 characters
- ✅ `suggest_canvas_view = true`
- ✅ Chat shows: "📊 For a better view..."
- ✅ Canvas shows full summary card
- ✅ Evidence panel displayed

---

### ✅ Test 3: Intent Change During Session
**Session:**
1. "Tell me about our portfolio" → Understand intent
2. "Now show me claims by industry" → Analyze intent (changed)

**Expected:**
- ✅ First query: Chat-only (conversational)
- ✅ Second query: Dashboard with chart
- ✅ Context maintained (conversation history passed)
- ✅ Intent correctly switched from Understand → Analyze

---

### ✅ Test 4: Keyword Fallback (No Click)
**Input:** "Show me data"
**User Action:** Ignores intent suggestions, types "show me claims by type"

**Expected:**
- ✅ Keyword mapping detects: "show", "by" → ad_hoc_query
- ✅ Intent: Analyze
- ✅ Output: Dashboard
- ✅ Widget created

---

## 🎨 CSS Styling (Add to index.css)

```css
/* Intent Suggestion Chips */
.intent-suggestions {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.intent-chips {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.intent-chip {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px solid rgba(56, 189, 248, 0.3);
    border-radius: 12px;
    transition: all 0.3s ease;
    text-align: left;
    width: 100%;
}

.intent-chip:hover {
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(139, 92, 246, 0.2));
    border-color: rgba(56, 189, 248, 0.5);
    transform: translateX(4px);
}

.intent-label {
    font-size: 14px;
    font-weight: 600;
    color: #38bdf8;
    margin-bottom: 4px;
}

.intent-example {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
}
```

---

## 📁 Files Modified

1. **backend/services/intent_engine.py** (Lines 901-1035)
   - Added clarification_needed detection
   - Added suggested_intents generation
   - Added suggest_canvas_view logic
   - Added long response detection (>500 chars)

2. **backend/routers/chat.py** (Lines 54-68, 580-640)
   - Updated ChatResponse schema
   - Added clarification handling
   - Added canvas suggestion message
   - Extracted new flags from pipeline

3. **frontend/src/pages/RiskMind.tsx** (Lines 38-49, 804-810, 1920-1950)
   - Updated Message interface
   - Added suggestedIntents field
   - Rendered intent chips with click handlers
   - Pin output type when intent clicked

4. **frontend/src/index.css** (NEW)
   - Added intent-chip styling
   - Added intent-suggestions styling

---

## ✨ Benefits

1. **Clear Communication:** System explicitly asks for clarification when confused
2. **Guided UX:** Clickable intent options guide user to correct path
3. **Keyword Fallback:** Auto-detects intent if user doesn't click
4. **Context-Aware:** Maintains conversation history and allows intent changes
5. **Canvas Intelligence:** Suggests canvas for complex/long responses
6. **Reduced Friction:** Users don't need to learn complex commands

---

## 🚀 Next Steps

1. Test clarification flow with ambiguous queries
2. Verify intent chips are clickable and functional
3. Test canvas suggestion appears for long responses (>500 chars)
4. Test context-aware intent switching across session
5. Add CSS styling for intent chips
6. Move to testing ANALYZE and DECIDE intents
