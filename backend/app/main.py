from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import re
from datetime import datetime
from io import BytesIO

# --- Document Parsing Libraries ---
from bs4 import BeautifulSoup
import docx
import pdfplumber

app = FastAPI(
    title="A11y Analyzer API",
    description="API for analyzing accessibility conformance reports.",
    version="1.4.0" # MODIFIED: Version bump for resilient parsing
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

# --- Severity Analysis Engine (No changes) ---
def _assign_severity(remarks: str) -> str:
    if not remarks:
        return "Low"
    remarks_lower = remarks.lower()
    critical_keywords = ['keyboard trap', 'not accessible by keyboard', 'blocks screen reader', 'content disappears', 'no keyboard access']
    high_keywords = ['poor contrast', 'difficult to use', 'confusing navigation', 'illogical order', 'session timeouts']
    medium_keywords = ['inconsistent', 'unclear link purpose', 'status messages not announced', 'some images missing alt']
    if any(re.search(r'\b' + keyword + r'\b', remarks_lower) for keyword in critical_keywords):
        return "Critical"
    if any(re.search(r'\b' + keyword + r'\b', remarks_lower) for keyword in high_keywords):
        return "High"
    if any(re.search(r'\b' + keyword + r'\b', remarks_lower) for keyword in medium_keywords):
        return "Medium"
    return "Low"

# --- Metadata Extraction (No changes) ---
def _extract_metadata(text: str):
    vpat_version_match = re.search(r'VPAT\s*®?\s*Version\s*([\d\.]+)', text, re.IGNORECASE)
    # Adding a check for the newer VPAT 2.5 format as well
    if not vpat_version_match:
        vpat_version_match = re.search(r'VPAT\s*®\s*Version\s*(2.5)', text, re.IGNORECASE)

    product_version_match = re.search(r'(Name\sOf\sProduct:?|Name of the Product)\s*(.*)', text, re.IGNORECASE)
    report_date_match = re.search(r'(Date:|Report\s*Date)\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})', text, re.IGNORECASE)

    report_age = "Not Found"
    if report_date_match:
        date_str = report_date_match.group(2)
        try:
            # Handle different date formats that might appear
            report_date = datetime.strptime(date_str, "%B %d, %Y") if " " in date_str else datetime.strptime(date_str, "%b %d, %Y")
            today = datetime(2025, 9, 3) # Using context date
            months = (today.year - report_date.year) * 12 + today.month - report_date.month
            report_age = f"{months} months old" if months < 12 else f"Over {months // 12} year(s) old"
        except ValueError:
            report_age = "Could not parse date"

    return {
        "vpat_version": vpat_version_match.group(1) if vpat_version_match else "Not Found",
        "product_version": product_version_match.group(2).strip().split('\n')[0] if product_version_match else "Not Found",
        "report_age": report_age,
    }

# --- REFACTORED: Resilient PDF Parser ---
async def parse_pdf_report(file_bytes: bytes):
    detailed_findings = []
    summary = {"supports": 0, "partially_supports": 0, "does_not_support": 0, "not_applicable": 0}
    full_text = ""

    # This variable will hold a criterion that spans multiple lines
    pending_criterion = None

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            full_text += page.extract_text(layout=True) + "\n" # Using layout=True can help with structure
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    # Clean up row data, removing None values and stripping whitespace
                    cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]

                    # Heuristic to identify a potential criterion line (often starts with a number)
                    is_criterion_line = cleaned_row and re.match(r'^\d+\.\d+', cleaned_row[0])

                    if len(cleaned_row) >= 3 and cleaned_row[1] != "": # This looks like a complete row
                        criterion, level, remarks = cleaned_row[0], cleaned_row[1], " ".join(cleaned_row[2:])
                        pending_criterion = None # Clear any pending criterion
                    elif is_criterion_line and cleaned_row[1] == "": # This is a criterion on its own line
                        pending_criterion = cleaned_row[0]
                        continue # Move to the next line to find the conformance level
                    elif pending_criterion and cleaned_row[1] != "": # This line has the level for our pending criterion
                        criterion, level, remarks = pending_criterion, cleaned_row[1], " ".join(cleaned_row[2:])
                        pending_criterion = None # Clear the pending criterion after use
                    else:
                        continue # Skip malformed or header rows

                    level_lower = level.lower().replace('\n', ' ')

                    if "partially supports" in level_lower:
                        summary["partially_supports"] += 1
                        detailed_findings.append({
                            "criterion": criterion.replace('\n',' '), "level": "Partially Supports", "remarks": remarks.replace('\n',' '),
                            "severity": _assign_severity(remarks)
                        })
                    elif "does not support" in level_lower:
                        summary["does_not_support"] += 1
                        detailed_findings.append({
                            "criterion": criterion.replace('\n',' '), "level": "Does Not Support", "remarks": remarks.replace('\n',' '),
                            "severity": _assign_severity(remarks)
                        })
                    elif "supports" in level_lower: summary["supports"] += 1
                    elif "not applicable" in level_lower: summary["not_applicable"] += 1

    metadata = _extract_metadata(full_text)
    return {**metadata, "summary": summary, "detailed_findings": detailed_findings}

# --- Placeholder Parsers (No changes) ---
async def parse_docx_report(file_bytes: bytes):
    doc = docx.Document(BytesIO(file_bytes))
    full_text = "\n".join([p.text for p in doc.paragraphs])
    metadata = _extract_metadata(full_text)
    return {**metadata, "summary": {}, "detailed_findings": []}

async def parse_html_report(content: bytes):
    soup = BeautifulSoup(content, 'lxml')
    metadata = _extract_metadata(soup.get_text())
    return {**metadata, "summary": {}, "detailed_findings": []}

# --- API Endpoint (No changes) ---
@app.get("/", tags=["General"])
async def read_root(): return {"message": "Welcome to the A11y Analyzer API!"}

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
    return {"filename": file.filename, "content_type": file.content_type, "status": "Analysis complete.", "analysis_results": analysis_data}