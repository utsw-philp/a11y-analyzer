from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import re
from datetime import datetime
from io import BytesIO
import json
from typing import Dict, List

# --- Document Parsing Libraries ---
from bs4 import BeautifulSoup
import docx
import pdfplumber

from dotenv import load_dotenv
load_dotenv()

# --- Gemini Import with Error Handling ---
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-generativeai not installed. AI analysis will be disabled.")

app = FastAPI(
    title="A11y Analyzer API",
    description="API for analyzing accessibility conformance reports with AI severity correction.",
    version="2.1.0"
)

# --- CORS Configuration ---
origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Gemini Configuration with Better Error Handling ---
GEMINI_CONFIGURED = False
if GEMINI_AVAILABLE:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            GEMINI_CONFIGURED = True
            print("✓ Gemini API configured successfully")
        except Exception as e:
            print(f"✗ Gemini API configuration failed: {e}")
    else:
        print("✗ GEMINI_API_KEY environment variable not found")
else:
    print("✗ Gemini library not available")

# --- Enhanced Severity Correction with Gemini ---
async def correct_severity_with_ai(criterion: str, original_remarks: str, fallback_severity: str) -> Dict:
    """Use Gemini specifically to review and correct severity based on remarks"""

    if not GEMINI_CONFIGURED:
        return {
            "severity": fallback_severity,
            "ai_corrected": False,
            "correction_reason": "Gemini API not available - using keyword-based analysis",
            "confidence": "fallback"
        }

    # Simplified prompt focused only on severity correction
    prompt = f"""
You are an accessibility expert reviewing WCAG conformance findings.
Your task is to determine the correct severity level based on the remarks/explanation.

WCAG Criterion: {criterion}
Remarks/Explanation: "{original_remarks}"
Current Severity (keyword-based): {fallback_severity}

Severity Definitions:
- Critical: Completely blocks users from core tasks (keyboard traps, screen reader complete failure, content totally inaccessible)
- High: Major barriers significantly impeding use (poor contrast failing 4.5:1, missing alt text on functional images, major navigation issues)
- Medium: Notable usability issues with workarounds (inconsistent behavior, unclear labels, minor contrast issues)
- Low: Minor improvements, best practices (cosmetic issues, minor inconsistencies)

Respond with ONLY this JSON format:
{{
    "severity": "Critical|High|Medium|Low",
    "reason": "Brief explanation of why this severity is correct",
    "confidence": "high|medium|low"
}}
"""

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Clean JSON response
        if response_text.startswith("```json"):
            response_text = response_text[7:-3]
        elif response_text.startswith("```"):
            response_text = response_text[3:-3]

        result = json.loads(response_text)

        # Validate response
        if "severity" not in result or result["severity"] not in ["Critical", "High", "Medium", "Low"]:
            raise ValueError("Invalid severity in response")

        return {
            "severity": result["severity"],
            "ai_corrected": result["severity"] != fallback_severity,
            "correction_reason": result.get("reason", "AI analysis completed"),
            "confidence": result.get("confidence", "medium")
        }

    except Exception as e:
        print(f"Gemini API call failed: {e}")
        return {
            "severity": fallback_severity,
            "ai_corrected": False,
            "correction_reason": f"AI analysis failed: {str(e)[:100]}",
            "confidence": "fallback"
        }

def _assign_severity_fallback(remarks: str) -> str:
    """Enhanced keyword-based severity analysis as fallback"""
    if not remarks:
        return "Low"

    remarks_lower = remarks.lower()

    # Enhanced keyword patterns
    critical_patterns = [
        r'keyboard trap', r'not accessible.*keyboard', r'blocks.*screen reader',
        r'content disappears', r'no keyboard access', r'completely inaccessible',
        r'cannot.*navigate', r'prevents.*completion'
    ]

    high_patterns = [
        r'poor contrast', r'difficult.*use', r'confusing navigation',
        r'illogical order', r'session timeout', r'missing.*alt.*text',
        r'color.*only.*indicator', r'auto.*refresh', r'significant.*barrier'
    ]

    medium_patterns = [
        r'inconsistent', r'unclear.*purpose', r'status.*not.*announced',
        r'some.*images.*missing', r'minor.*navigation', r'workaround.*available',
        r'partially.*accessible'
    ]

    # Check patterns in order of severity
    for pattern in critical_patterns:
        if re.search(pattern, remarks_lower):
            return "Critical"

    for pattern in high_patterns:
        if re.search(pattern, remarks_lower):
            return "High"

    for pattern in medium_patterns:
        if re.search(pattern, remarks_lower):
            return "Medium"

    return "Low"

# --- Metadata Extraction (Unchanged) ---
def _extract_metadata(text: str):
    vpat_version_match = re.search(r'VPAT\s*®?\s*Version\s*([\d\.]+)', text, re.IGNORECASE)
    if not vpat_version_match:
        vpat_version_match = re.search(r'VPAT\s*®\s*Version\s*(2.5)', text, re.IGNORECASE)

    product_version_match = re.search(r'(Name\sOf\sProduct:?|Name of the Product)\s*(.*)', text, re.IGNORECASE)
    report_date_match = re.search(r'(Date:|Report\s*Date)\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})', text, re.IGNORECASE)

    report_age = "Not Found"
    if report_date_match:
        date_str = report_date_match.group(2)
        try:
            report_date = datetime.strptime(date_str, "%B %d, %Y") if " " in date_str else datetime.strptime(date_str, "%b %d, %Y")
            today = datetime(2025, 9, 3)
            months = (today.year - report_date.year) * 12 + today.month - report_date.month
            report_age = f"{months} months old" if months < 12 else f"Over {months // 12} year(s) old"
        except ValueError:
            report_age = "Could not parse date"

    return {
        "vpat_version": vpat_version_match.group(1) if vpat_version_match else "Not Found",
        "product_version": product_version_match.group(2).strip().split('\n')[0] if product_version_match else "Not Found",
        "report_age": report_age,
    }

# --- Enhanced PDF Parser with Severity Correction ---
async def parse_pdf_report(file_bytes: bytes):
    detailed_findings = []
    summary = {"supports": 0, "partially_supports": 0, "does_not_support": 0, "not_applicable": 0}
    full_text = ""
    pending_criterion = None

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            full_text += page.extract_text(layout=True) + "\n"
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]
                    is_criterion_line = cleaned_row and re.match(r'^\d+\.\d+', cleaned_row[0])

                    if len(cleaned_row) >= 3 and cleaned_row[1] != "":
                        criterion, level, remarks = cleaned_row[0], cleaned_row[1], " ".join(cleaned_row[2:])
                        pending_criterion = None
                    elif is_criterion_line and cleaned_row[1] == "":
                        pending_criterion = cleaned_row[0]
                        continue
                    elif pending_criterion and cleaned_row[1] != "":
                        criterion, level, remarks = pending_criterion, cleaned_row[1], " ".join(cleaned_row[2:])
                        pending_criterion = None
                    else:
                        continue

                    level_lower = level.lower().replace('\n', ' ')
                    clean_remarks = remarks.replace('\n',' ').strip()

                    if "partially supports" in level_lower or "does not support" in level_lower:
                        # Get fallback severity first
                        fallback_severity = _assign_severity_fallback(clean_remarks)

                        # Use AI to correct/verify severity
                        ai_result = await correct_severity_with_ai(criterion, clean_remarks, fallback_severity)

                        finding = {
                            "criterion": criterion.replace('\n',' '),
                            "level": "Partially Supports" if "partially supports" in level_lower else "Does Not Support",
                            "remarks": clean_remarks,
                            "severity": ai_result["severity"],
                            "original_severity": fallback_severity,
                            "ai_corrected": ai_result["ai_corrected"],
                            "correction_reason": ai_result["correction_reason"],
                            "confidence": ai_result["confidence"]
                        }

                        detailed_findings.append(finding)

                        if "partially supports" in level_lower:
                            summary["partially_supports"] += 1
                        else:
                            summary["does_not_support"] += 1

                    elif "supports" in level_lower:
                        summary["supports"] += 1
                    elif "not applicable" in level_lower:
                        summary["not_applicable"] += 1

    metadata = _extract_metadata(full_text)

    # Add AI analysis summary
    ai_corrections = sum(1 for f in detailed_findings if f["ai_corrected"])
    metadata["ai_analysis_summary"] = {
        "total_analyzed": len(detailed_findings),
        "ai_corrections_made": ai_corrections,
        "gemini_configured": GEMINI_CONFIGURED
    }

    return {**metadata, "summary": summary, "detailed_findings": detailed_findings}

# --- Placeholder Parsers ---
async def parse_docx_report(file_bytes: bytes):
    doc = docx.Document(BytesIO(file_bytes))
    full_text = "\n".join([p.text for p in doc.paragraphs])
    metadata = _extract_metadata(full_text)
    return {**metadata, "summary": {}, "detailed_findings": []}

async def parse_html_report(content: bytes):
    soup = BeautifulSoup(content, 'lxml')
    metadata = _extract_metadata(soup.get_text())
    return {**metadata, "summary": {}, "detailed_findings": []}

# --- API Endpoints ---
@app.get("/", tags=["General"])
async def read_root():
    return {
        "message": "Welcome to the A11y Analyzer API with AI Severity Correction!",
        "gemini_status": "configured" if GEMINI_CONFIGURED else "not configured"
    }

@app.get("/api/status", tags=["Debug"])
async def get_status():
    """Check API and Gemini status"""
    return {
        "gemini_library_available": GEMINI_AVAILABLE,
        "gemini_api_configured": GEMINI_CONFIGURED,
        "api_key_length": len(os.getenv("GEMINI_API_KEY", "")),
        "environment_variables": {
            "GEMINI_API_KEY": "present" if os.getenv("GEMINI_API_KEY") else "missing"
        }
    }

@app.post("/api/test-gemini", tags=["Debug"])
async def test_gemini():
    """Test Gemini API with a simple severity correction"""
    if not GEMINI_CONFIGURED:
        return {"error": "Gemini not configured"}

    test_result = await correct_severity_with_ai(
        "2.1.1 Keyboard",
        "The submit button cannot be reached using keyboard navigation",
        "Medium"
    )
    return {"test_result": test_result}

@app.post("/api/analyze", tags=["Analysis"])
async def analyze_report(file: UploadFile = File(...)):
    allowed_extensions = {".pdf", ".docx", ".html"}
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type.")

    file_contents = await file.read()
    analysis_data = {}

    if file_extension == ".pdf":
        analysis_data = await parse_pdf_report(file_contents)
    elif file_extension == ".docx":
        analysis_data = await parse_docx_report(file_contents)
    elif file_extension == ".html":
        analysis_data = await parse_html_report(file_contents)

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "status": "Analysis complete with AI severity correction." if GEMINI_CONFIGURED else "Analysis complete with keyword-based severity.",
        "analysis_results": analysis_data
    }