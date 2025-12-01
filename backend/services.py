import os
import json
from datetime import date
from io import BytesIO
from pypdf import PdfReader
from docx import Document
from litellm import completion, embedding
from dotenv import load_dotenv
from typing import List
import math
import re

# Load Environment Variables
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path, override=True)

# --- 1. UNIVERSAL FILE PARSER ---

def extract_text_from_docx(file_content: bytes) -> str:
    try:
        doc = Document(BytesIO(file_content))
        return "\n".join([para.text for para in doc.paragraphs])
    except Exception as e:
        print(f"DOCX Error: {e}")
        return ""

def extract_text_with_gemini_vision(file_content: bytes) -> str:
    # Placeholder: Future implementation for OCR
    return "[SCANNED DOCUMENT DETECTED] - This appears to be an image-based PDF. Please use a text-based PDF."

def extract_text_from_pdf(file_content: bytes) -> str:
    try:
        pdf = PdfReader(BytesIO(file_content))
        text = ""
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        
        if len(text.strip()) < 50:
            return extract_text_with_gemini_vision(file_content)
            
        return text
    except Exception as e:
        print(f"PDF Error: {e}")
        return ""

def smart_extract(file_content: bytes, filename: str) -> str:
    filename = filename.lower()
    text = ""
    
    if filename.endswith(".pdf"):
        text = extract_text_from_pdf(file_content)
    elif filename.endswith(".docx"):
        text = extract_text_from_docx(file_content)
    elif filename.endswith(".txt"):
        try:
            text = file_content.decode("utf-8")
        except:
            text = file_content.decode("latin-1", errors="ignore")
    
    if text:
        return text.replace("\x00", "")
    return ""

def split_multiple_jds(text: str) -> List[str]:
    """
    Smart JD separator for files that may contain multiple job descriptions.
    Handles:
    - Multi-JD PDFs
    - Exported collections
    - Text dumps
    """

    # If very short → single JD
    if len(text) < 1500:
        return [text]

    # Try rule-based split
    sections = re.split(r"(Job Title[:\-]|Position[:\-]|Role[:\-])", text, flags=re.IGNORECASE)

    if len(sections) > 4:  # Found multiple sections
        combined = []
        for i in range(1, len(sections), 2):
            jd_text = sections[i] + " " + sections[i+1]
            combined.append(jd_text.strip())
        return combined

    # AI fallback for multi-JD detection
    prompt = f"""
The following text may contain MULTIPLE JOB DESCRIPTIONS.
Split them cleanly.

Return JSON list:
["JD 1 text", "JD 2 text", ...]

TEXT:
\"\"\"{text[:8000]}\"\"\"
"""

    try:
        response = completion(
            model="gemini/gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            api_key=os.getenv("GEMINI_API_KEY")
        )
        raw = response.choices[0].message.content.strip()
        return json.loads(raw)

    except:
        return [text]  # Final fallback



def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Compute cosine similarity between two embedding vectors.
    Returns a value between -1.0 and 1.0 (we expect ~0..1).
    """
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0

    dot = 0.0
    norm1 = 0.0
    norm2 = 0.0

    for a, b in zip(vec1, vec2):
        dot += a * b
        norm1 += a * a
        norm2 += b * b

    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0

    return dot / (math.sqrt(norm1) * math.sqrt(norm2))

    
# --- 2. AI ANALYSIS (THE BRAIN) ---
def analyze_candidate(resume_text: str, job_description: str):
    today_str = date.today().strftime("%Y-%m-%d")

    # ---------------------------------------------------------
    # IMPORTANT: Escape JSON braces by doubling them {{ }}
    # Except where f-variables are intentionally inserted.
    # ---------------------------------------------------------

    system_prompt = f"""
You are a senior technical recruiter performing strict weighted scoring of a candidate
against a job description. You MUST follow the scoring rubric below without exception.

=========================
SCORING RUBRIC (0–100)
=========================

GATE 1 — EXPERIENCE MATCH (0–30)
- If years match exactly → +30
- If difference is within ±2 years → +15
- If mismatch > 2 years → +0

GATE 2 — MANDATORY SKILLS MATCH (0–40)
- Count how many MUST-HAVE skills appear in resume
- Each matched skill = + (40 / total must-have skills)
- Missing ANY critical skill = DEDUCT 10 points
- Missing more than 50% of must-have skills = DEDUCT 20 more

GATE 3 — ROLE ALIGNMENT (0–30)
- Job title match (semantic) → +15
- Responsibilities match → +15

=========================
STABILITY CHECK (OVERRIDE)
=========================
Detect:
- Career gaps > 6 months
- Changing jobs too frequently (<1 year roles)

If ANY stability issue is found:
- stability_flag = "RISK"
- Final status = "Reject" (even if score >= 70)

=========================
FINAL STATUS RULE
=========================
IF score >= 70 → "Shortlist"
IF score < 70 → "Reject"
BUT if stability_flag == "RISK" → force "Reject"

=========================
OUTPUT FORMAT (STRICT JSON)
=========================
Respond ONLY in JSON with this EXACT schema:

{{
  "name": "",
  "email": "",
  "score": 0,
  "status": "",
  "reasoning": "",
  "experience_score": 0,
  "skills_score": 0,
  "role_alignment_score": 0,
  "stability_flag": "",
  "skills_found": [],
  "missing_skills": []
}}

=========================
ADDITIONAL NOTES
=========================
- Extract candidate name & email from resume.
- Infer experience from resume timeline.
- Identify must-have skills from the job description.
- Ensure total score = experience_score + skills_score + role_alignment_score.
- DO NOT hallucinate. Use only resume & JD.
"""

    user_prompt = f"""
JOB DESCRIPTION:
\"\"\"{job_description}\"\"\"

RESUME:
\"\"\"{resume_text}\"\"\"

Evaluate strictly using the scoring rubric.
"""

    # ---------------------------------------------------------
    # Gemini call (corrected)
    # ---------------------------------------------------------
    try:
        response = completion(
            model="gemini/gemini-2.5-flash",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            api_key=os.getenv("GEMINI_API_KEY"),
            response_format={"type": "json_object"}  # uses Gemini structured output
        )

        content = response.choices[0].message.content.strip()

        # Strong JSON fallback
        try:
            return json.loads(content)

        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1:
                return json.loads(content[start:end + 1])
            else:
                raise ValueError("No JSON found in AI output")

    except Exception as e:
        print(f"AI Error: {e}")
        return {
            "name": "Unknown",
            "email": "Unknown",
            "score": 0,
            "status": "Reject",
            "reasoning": f"AI Processing Error: {str(e)}",
            "experience_score": 0,
            "skills_score": 0,
            "role_alignment_score": 0,
            "stability_flag": "RISK",
            "skills_found": [],
            "missing_skills": []
        }

# --- 3. JD PARSER ---
def parse_jd(text: str) -> dict:
    """
    Hybrid JD parser:
    1. Rule-based extraction for clean JDs
    2. AI fallback using Gemini for noisy/badly formatted JDs
    """

    # --------- RULE-BASED EXTRACTION ---------

    # Try simple patterns first
    patterns = [
        r"Job Title[:\-]\s*(.*)",
        r"Position[:\-]\s*(.*)",
        r"Role[:\-]\s*(.*)",
        r"Title[:\-]\s*(.*)",
        r"We are hiring\s*(.*)"
    ]

    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            if 3 <= len(title) <= 120:
                return {
                    "title": title,
                    "description": text[:2000]  # first 2000 chars
                }

    # --------- AI FALLBACK EXTRACTION ---------
    # (Works even for unstructured PDFs or long combined documents)

    ai_prompt = f"""
Extract the JOB TITLE and JOB DESCRIPTION from the following text.
Return ONLY this JSON structure:

{{
  "title": "",
  "description": ""
}}

TEXT:
\"\"\"{text[:5000]}\"\"\"
"""

    try:
        response = completion(
            model="gemini/gemini-2.5-flash",
            messages=[{"role": "user", "content": ai_prompt}],
            api_key=os.getenv("GEMINI_API_KEY"),
            response_format={"type": "json_object"}
        )

        cleaned = response.choices[0].message.content.strip()
        try:
            return json.loads(cleaned)
        except:
            s = cleaned.find("{")
            e = cleaned.rfind("}")
            return json.loads(cleaned[s:e+1])

    except Exception as e:
        print("JD PARSE ERROR:", e)

        # --------- HARDEST FALLBACK ---------
        # Try to guess a title from first lines
        lines = [ln.strip() for ln in text.split("\n") if len(ln.strip()) > 3]
        guessed = lines[0] if lines else "General Role"

        return {
            "title": guessed[:80],
            "description": text[:2000]
        }

# --- 4. EMBEDDINGS ---

def get_embedding(text: str):
    try:
        clean_text = text.replace("\n", " ")
        response = embedding(
            model="gemini/text-embedding-004",
            input=[clean_text],
            api_key=os.getenv("GEMINI_API_KEY")
        )
        return response['data'][0]['embedding']
    except Exception as e:
        print(f"Embedding Error: {e}")
        return [0.0] * 768