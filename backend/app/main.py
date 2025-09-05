from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import re
from datetime import datetime
from io import BytesIO
import json
from typing import Dict, List, Optional
from enum import Enum
from dotenv import load_dotenv

load_dotenv()

# --- Document Parsing Libraries ---
from bs4 import BeautifulSoup
import docx
import pdfplumber

# --- AI Provider Imports with Error Handling ---
AI_PROVIDERS = {}

# Gemini
try:
    import google.generativeai as genai
    AI_PROVIDERS['gemini'] = True
except ImportError:
    AI_PROVIDERS['gemini'] = False

# OpenAI
try:
    from openai import OpenAI
    AI_PROVIDERS['openai'] = True
except ImportError:
    AI_PROVIDERS['openai'] = False

# Anthropic Claude
try:
    import anthropic
    AI_PROVIDERS['claude'] = True
except ImportError:
    AI_PROVIDERS['claude'] = False

app = FastAPI(
    title="A11y Analyzer API",
    description="API for analyzing accessibility conformance reports with multiple AI providers.",
    version="3.0.0"
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

# --- AI Provider Configuration ---
class AIProvider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    CLAUDE = "claude"
    FALLBACK = "fallback"

class AIProviderManager:
    def __init__(self):
        self.providers = {}
        self.configure_providers()

    def configure_providers(self):
        """Configure all available AI providers"""

        # Configure Gemini
        if AI_PROVIDERS['gemini'] and os.getenv("GEMINI_API_KEY"):
            try:
                genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                self.providers['gemini'] = {
                    'client': genai.GenerativeModel('gemini-1.5-flash'),
                    'configured': True
                }
                print("✓ Gemini API configured successfully")
            except Exception as e:
                print(f"✗ Gemini configuration failed: {e}")
                self.providers['gemini'] = {'configured': False, 'error': str(e)}

        # Configure OpenAI
        if AI_PROVIDERS['openai'] and os.getenv("OPENAI_API_KEY"):
            try:
                self.providers['openai'] = {
                    'client': OpenAI(api_key=os.getenv("OPENAI_API_KEY")),
                    'configured': True
                }
                print("✓ OpenAI API configured successfully")
            except Exception as e:
                print(f"✗ OpenAI configuration failed: {e}")
                self.providers['openai'] = {'configured': False, 'error': str(e)}

        # Configure Claude
        if AI_PROVIDERS['claude'] and os.getenv("ANTHROPIC_API_KEY"):
            try:
                self.providers['claude'] = {
                    'client': anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY")),
                    'configured': True
                }
                print("✓ Claude API configured successfully")
            except Exception as e:
                print(f"✗ Claude configuration failed: {e}")
                self.providers['claude'] = {'configured': False, 'error': str(e)}

    def get_available_providers(self) -> List[str]:
        """Get list of configured providers"""
        return [name for name, config in self.providers.items() if config.get('configured', False)]

    def get_preferred_provider(self) -> Optional[str]:
        """Get the first available provider in order of preference"""
        preference_order = ['claude', 'openai', 'gemini']
        for provider in preference_order:
            if provider in self.providers and self.providers[provider].get('configured', False):
                return provider
        return None

    async def analyze_severity(self, criterion: str, remarks: str, fallback_severity: str, provider: Optional[str] = None) -> Dict:
        """Analyze severity using specified provider or best available"""

        if not provider:
            provider = self.get_preferred_provider()

        if not provider:
            return {
                "severity": fallback_severity,
                "ai_corrected": False,
                "correction_reason": "No AI providers configured",
                "confidence": "fallback",
                "provider_used": "none"
            }

        prompt = self._build_prompt(criterion, remarks, fallback_severity)

        try:
            if provider == 'gemini':
                return await self._analyze_with_gemini(prompt, fallback_severity)
            elif provider == 'openai':
                return await self._analyze_with_openai(prompt, fallback_severity)
            elif provider == 'claude':
                return await self._analyze_with_claude(prompt, fallback_severity)
        except Exception as e:
            print(f"AI analysis failed with {provider}: {e}")
            # Try fallback to another provider
            available = [p for p in self.get_available_providers() if p != provider]
            if available:
                print(f"Trying fallback provider: {available[0]}")
                return await self.analyze_severity(criterion, remarks, fallback_severity, available[0])

        return {
            "severity": fallback_severity,
            "ai_corrected": False,
            "correction_reason": f"AI analysis failed: {str(e)[:100]}",
            "confidence": "fallback",
            "provider_used": "none"
        }

    def _build_prompt(self, criterion: str, remarks: str, fallback_severity: str) -> str:
        """Build standardized prompt for all AI providers"""
        return f"""You are an accessibility expert reviewing WCAG conformance findings.
Your task is to determine the correct severity level based on the remarks/explanation.

WCAG Criterion: {criterion}
Remarks/Explanation: "{remarks}"
Current Severity (keyword-based): {fallback_severity}

Severity Definitions:
- Critical: Completely blocks users from core tasks (keyboard traps, screen reader complete failure, content totally inaccessible)
- High: Major barriers significantly impeding use (poor contrast failing 4.5:1, missing alt text on functional images, major navigation issues)
- Medium: Notable usability issues with workarounds (inconsistent behavior, unclear labels, minor contrast issues)
- Low: Minor improvements, best practices (cosmetic issues, minor inconsistencies)

Respond with ONLY a valid JSON object with these fields:
{{
    "severity": "Critical|High|Medium|Low",
    "reason": "Brief explanation of why this severity is correct",
    "confidence": "high|medium|low"
}}

Focus on real user impact for people with disabilities."""

    async def _analyze_with_gemini(self, prompt: str, fallback_severity: str) -> Dict:
        """Analyze using Gemini"""
        client = self.providers['gemini']['client']
        response = client.generate_content(prompt)
        result = self._parse_ai_response(response.text, fallback_severity)
        result['provider_used'] = 'gemini'
        return result

    async def _analyze_with_openai(self, prompt: str, fallback_severity: str) -> Dict:
        """Analyze using OpenAI"""
        client = self.providers['openai']['client']
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1
        )
        result = self._parse_ai_response(response.choices[0].message.content, fallback_severity)
        result['provider_used'] = 'openai'
        return result

    async def _analyze_with_claude(self, prompt: str, fallback_severity: str) -> Dict:
        """Analyze using Claude"""
        client = self.providers['claude']['client']
        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        result = self._parse_ai_response(response.content[0].text, fallback_severity)
        result['provider_used'] = 'claude'
        return result

    def _parse_ai_response(self, response_text: str, fallback_severity: str) -> Dict:
        """Parse AI response into standardized format"""
        try:
            # Clean response text
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:-3]
            elif response_text.startswith("```"):
                response_text = response_text[3:-3]

            result = json.loads(response_text.strip())

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
            raise ValueError(f"Failed to parse AI response: {e}")

# Initialize AI provider manager
ai_manager = AIProviderManager()

# --- Enhanced Severity Analysis ---
async def correct_severity_with_ai(criterion: str, original_remarks: str, fallback_severity: str, provider: Optional[str] = None) -> Dict:
    """Use AI to review and correct severity based on remarks"""
    return await ai_manager.analyze_severity(criterion, original_remarks, fallback_severity, provider)

def _assign_severity_fallback(remarks: str) -> str:
    """Enhanced keyword-based severity analysis as fallback"""
    if not remarks:
        return "Low"

    remarks_lower = remarks.lower()

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

# --- Enhanced PDF Parser with Multi-AI Support ---
async def parse_pdf_report(file_bytes: bytes, ai_provider: Optional[str] = None):
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
                        fallback_severity = _assign_severity_fallback(clean_remarks)
                        ai_result = await correct_severity_with_ai(criterion, clean_remarks, fallback_severity, ai_provider)

                        finding = {
                            "criterion": criterion.replace('\n',' '),
                            "level": "Partially Supports" if "partially supports" in level_lower else "Does Not Support",
                            "remarks": clean_remarks,
                            "severity": ai_result["severity"],
                            "original_severity": fallback_severity,
                            "ai_corrected": ai_result["ai_corrected"],
                            "correction_reason": ai_result["correction_reason"],
                            "confidence": ai_result["confidence"],
                            "provider_used": ai_result["provider_used"]
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

    ai_corrections = sum(1 for f in detailed_findings if f["ai_corrected"])
    providers_used = list(set(f["provider_used"] for f in detailed_findings if f["provider_used"] != "none"))

    metadata["ai_analysis_summary"] = {
        "total_analyzed": len(detailed_findings),
        "ai_corrections_made": ai_corrections,
        "providers_configured": ai_manager.get_available_providers(),
        "providers_used": providers_used,
        "preferred_provider": ai_manager.get_preferred_provider()
    }

    return {**metadata, "summary": summary, "detailed_findings": detailed_findings}

# --- Placeholder Parsers ---
async def parse_docx_report(file_bytes: bytes, ai_provider: Optional[str] = None):
    doc = docx.Document(BytesIO(file_bytes))
    full_text = "\n".join([p.text for p in doc.paragraphs])
    metadata = _extract_metadata(full_text)
    return {**metadata, "summary": {}, "detailed_findings": []}

async def parse_html_report(content: bytes, ai_provider: Optional[str] = None):
    soup = BeautifulSoup(content, 'lxml')
    metadata = _extract_metadata(soup.get_text())
    return {**metadata, "summary": {}, "detailed_findings": []}

# --- API Endpoints ---
@app.get("/", tags=["General"])
async def read_root():
    available_providers = ai_manager.get_available_providers()
    preferred_provider = ai_manager.get_preferred_provider()

    return {
        "message": "Welcome to the A11y Analyzer API with Multi-AI Support!",
        "ai_providers": {
            "available": available_providers,
            "preferred": preferred_provider,
            "total_configured": len(available_providers)
        }
    }

@app.get("/api/ai-providers", tags=["AI Providers"])
async def get_ai_providers():
    """Get information about configured AI providers"""
    return {
        "available_providers": ai_manager.get_available_providers(),
        "preferred_provider": ai_manager.get_preferred_provider(),
        "provider_details": {
            name: {
                "configured": config.get('configured', False),
                "library_available": AI_PROVIDERS.get(name, False),
                "api_key_present": bool(os.getenv(f"{name.upper()}_API_KEY")) if name != 'claude' else bool(os.getenv("ANTHROPIC_API_KEY"))
            }
            for name, config in ai_manager.providers.items()
        }
    }

@app.post("/api/analyze", tags=["Analysis"])
async def analyze_report(
    file: UploadFile = File(...),
    ai_provider: Optional[str] = None
):
    """Analyze report with optional AI provider specification"""
    allowed_extensions = {".pdf", ".docx", ".html"}
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type.")

    # Validate AI provider if specified
    if ai_provider and ai_provider not in ai_manager.get_available_providers():
        available = ai_manager.get_available_providers()
        raise HTTPException(
            status_code=400,
            detail=f"AI provider '{ai_provider}' not available. Available providers: {available}"
        )

    file_contents = await file.read()
    analysis_data = {}

    if file_extension == ".pdf":
        analysis_data = await parse_pdf_report(file_contents, ai_provider)
    elif file_extension == ".docx":
        analysis_data = await parse_docx_report(file_contents, ai_provider)
    elif file_extension == ".html":
        analysis_data = await parse_html_report(file_contents, ai_provider)

    providers_used = analysis_data.get("ai_analysis_summary", {}).get("providers_used", [])
    provider_text = f" using {', '.join(providers_used)}" if providers_used else ""

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "status": f"Analysis complete with AI enhancement{provider_text}." if providers_used else "Analysis complete with keyword-based severity.",
        "analysis_results": analysis_data
    }