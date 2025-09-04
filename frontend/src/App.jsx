import { useState, useRef } from 'react';
import axios from 'axios';
import FileUpload from './components/FileUpload';
import ReportDisplay from './components/ReportDisplay';

const API_URL = 'http://localhost:8000';

function App() {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const reportDisplayRef = useRef(null);

  const handleFileUpload = async (file) => {
    if (!file) return;
    console.log('Step 1: File upload process started.');
    const formData = new FormData();
    formData.append('file', file);
    setIsLoading(true);
    setError('');
    setAnalysisResult(null);
    try {
      const response = await axios.post(`${API_URL}/api/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Step 2: Received response from API.', response);
      console.log('Step 3: Attempting to set the following data to state:', response.data);
      setAnalysisResult(response.data);
    } catch (err) {
      console.error('API Error:', err);
      setError(err.response?.data?.detail || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const isUploadDisabled = !reportName || !reviewerName;

  console.log('Step 4: Rendering App component. Current analysisResult state is:', analysisResult);

  return (
    <div className="relative min-h-screen bg-gray-100 text-gray-800 font-sans pb-24">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">A11y Analyzer</h1>
          <p className="text-gray-600">Automated Accessibility Report Analysis</p>
        </div>
      </header>
      <main className="container mx-auto p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="reportName" className="block text-sm font-medium text-gray-700 mb-1">Report Name *</label>
              <input type="text" id="reportName" value={reportName} onChange={(e) => setReportName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., JotForm VPAT Analysis"/>
            </div>
            <div>
              <label htmlFor="reviewerName" className="block text-sm font-medium text-gray-700 mb-1">Author / Reviewer Name *</label>
              <input type="text" id="reviewerName" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Jane Doe"/>
            </div>
          </div>
          <h2 className="text-2xl font-semibold mb-4 border-t pt-6">Upload Conformance Report</h2>
          <p className="text-gray-600 mb-6">Upload a PDF, DOCX, or HTML accessibility report to begin.</p>
          <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} disabled={isUploadDisabled} />
          {error && <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-300 rounded-md">{error}</div>}
          {isLoading && <div className="mt-6 text-center font-semibold text-gray-600">Analyzing document... Please wait.</div>}
          {analysisResult && (
            <ReportDisplay ref={reportDisplayRef} result={analysisResult} reportName={reportName} reviewerName={reviewerName} />
          )}
        </div>
      </main>
      {analysisResult && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
          <div className="container mx-auto px-4 py-3 flex justify-center items-center">
            <div className="flex space-x-4">
              <button onClick={() => reportDisplayRef.current?.exportAsHTML()} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Export HTML</button>
              <button onClick={() => reportDisplayRef.current?.exportAsPDF()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">Export PDF</button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;