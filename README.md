# **A11y Accessibility Conformance Report (ACR) Analyzer**

A web application to automatically analyze accessibility conformance reports (ACRs/VPATs) and generate a comprehensive risk evaluation.

## **About The Project**

Manually reviewing accessibility reports is a time-consuming and error-prone process. The A11y Analyzer was built to solve this problem by providing a simple interface to upload a report and receive an instant, intelligent analysis.

This tool ingests a report, uses a heuristic engine to identify key metadata, tallies conformance levels, and, most importantly, performs a severity analysis on identified accessibility gaps. The final output is a clean, shareable report that can be exported to HTML or PDF, empowering teams to quickly understand the accessibility posture of a product and prioritize remediation efforts.

## **Features**

* **Multi-format Upload:** Ingests accessibility reports in PDF, DOCX, and HTML formats.
* **Metadata Extraction:** Automatically identifies the VPAT version, product version, and age of the report.
* **Conformance Tally:** Provides a quantitative summary of all criteria listed as "Supports," "Partially Supports," "Does Not Support," and "Not Applicable."
* **Heuristic Severity Analysis:** Intelligently assigns a severity level (Critical, High, Medium, Low) to each identified conformance gap.
* **Personalized Reports:** Allows users to add a custom report name and author to the generated output.
* **Exportable Results:** The final analysis can be downloaded as a clean, self-contained HTML or PDF document.

## **Technology Stack**

* **Frontend:**
  * React (with Vite)
  * Tailwind CSS
  * react-dropzone for file handling
  * jspdf & html2canvas for PDF generation
* **Backend:**
  * Python 3.8+
  * FastAPI
  * pdfplumber for PDF table extraction
  * python-docx for Word document parsing
  * beautifulsoup4 for HTML parsing

## Acknowledgements

This project was developed by Glenn Philp in collaboration with Google's Gemini. Its capabilities in generating code, debugging complex issues, explaining modern development patterns, and structuring the project from the initial Product Discovery Document were instrumental in the creation of the A11y Analyzer.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repository and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## **Getting Started**

Follow these instructions to get a local copy of the A11y Analyzer up and running on your machine.

### **Prerequisites**

You must have the following software installed:

* **Node.js** (v18.x or later recommended)
  * This will include npm (Node Package Manager).
* **Python** (v3.8 or later recommended)
  * This will include pip (Python package installer).

### **Installation**

1. **Clone the repository:**
   Bash
   git clone https://github.com/your-username/a11y-analyzer.git
   cd a11y-analyzer

2. **Set up the Backend:**
   Bash
   \# Navigate to the backend directory
   cd backend

   \# Create and activate a Python virtual environment
   python \-m venv venv
   source venv/bin/activate  \# On Windows, use: venv\\Scripts\\activate

   \# Install the required Python packages
   pip install \-r requirements.txt

3. **Set up the Frontend:**
   Bash
   \# Navigate to the frontend directory from the root
   cd frontend

   \# Install the required npm packages
   npm install

## **Usage**

You will need to run the backend and frontend servers in two separate terminals.

1. **Start the Backend Server:**
   * Navigate to the backend directory.
   * Make sure your virtual environment is activated.
   * Run the following command:

   Bash
     uvicorn app.main:app \--reload

   * The backend API will be running at http://localhost:8000.
2. **Start the Frontend Application:**
   * Navigate to the frontend directory.
   * Run the following command:

   Bash
     npm run dev

   * The frontend application will be available at http://localhost:5173. Open this URL in your browser.

## **How It Works: Severity Analysis**

A key feature of this application is its ability to assign a severity rating to success criteria marked as **"Partially Supports"** or **"Does Not Support."** This is not magic; it's a heuristic, keyword-based analysis performed on the **"Remarks and Explanations"** text provided for each criterion.

The engine searches the remarks for specific keywords and patterns that correlate with the real-world impact of an accessibility issue. The logic is applied in order from most to least severe:

| Severity | Description & Example Keywords |
| :---- | :---- |
| **Critical** | Issues that are likely to completely block a user from completing a primary task. Keywords: keyboard trap, not accessible by keyboard, blocks screen reader, content disappears. |
| **High** | Issues that significantly hinder a user's journey or cause major frustration, but may not be a complete blocker. Keywords: poor contrast, difficult to use, confusing navigation, illogical order. |
| **Medium** | Noticeable issues that make interaction less than ideal, but a workaround is often possible. Keywords: inconsistent, unclear link purpose, status messages not announced. |
| **Low** | Minor issues that do not significantly impact the user's ability to use the product. Often related to best practices or cosmetic inconsistencies. This is the default if no other keywords are found. |

## License

Distributed under the MIT License. See `LICENSE` for more information.
