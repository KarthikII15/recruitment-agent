import os
from sqlalchemy.orm import Session
from sqlalchemy import text
from litellm import completion
import models
import json

def ask_copilot(question: str, db: Session):
    # 1. Fetch Candidate Data (Same as before)
    results = db.execute(text("""
        SELECT c.name, j.title, a.match_score, a.status, a.reasoning 
        FROM candidates c
        JOIN applications a ON c.id = a.candidate_id
        JOIN jobs j ON j.id = a.job_id
        ORDER BY a.match_score DESC LIMIT 50
    """)).fetchall()

    context_data = "\n".join([f"{r[0]} | {r[1]} | Score: {r[2]} | {r[3]}" for r in results])

    # 2. The "Agentic" Prompt
    prompt = f"""
    You are a Recruitment Dashboard Controller.
    
    DATA:
    {context_data}
    
    USER QUESTION: "{question}"
    
    TOOLS AVAILABLE:
    1. FILTER: If user asks to see specific roles/skills (e.g., "Show Python devs").
    2. RESET: If user asks to see all or clear filters.
    3. NONE: Just answer the question textually.

    OUTPUT FORMAT (JSON ONLY):
    {{
        "reply": "Your natural language answer here...",
        "action": "FILTER" or "RESET" or "NONE",
        "value": "keyword to filter by (or null)"
    }}
    """

    # 3. Call Gemini
    response = completion(
        model="gemini/gemini-2.5-flash",
        messages=[{"role": "user", "content": prompt}],
        api_key=os.getenv("GEMINI_API_KEY")
    )

    content = response.choices[0].message.content
    
    # Clean JSON parsing
    try:
        start = content.find('{')
        end = content.rfind('}')
        return json.loads(content[start:end+1])
    except:
        # Fallback if AI fails to format JSON
        return {"reply": content, "action": "NONE", "value": None}