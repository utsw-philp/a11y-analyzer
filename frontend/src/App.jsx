import { useState, useRef, useEffect } from 'react';
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
  const [availableProviders, setAvailableProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [preferredProvider, setPreferredProvider] = useState(null);
  const reportDisplayRef = useRef(null);

  // Fetch available AI providers on component mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/ai-providers`);
        setAvailableProviders(response.data.available_providers);
        setPreferredProvider(response.data.preferred_provider);
      } catch (err) {
        console.error('Failed to fetch AI providers:', err);
      }
    };
    fetchProviders();
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) return;
    console.log('Step 1: File upload process started with AI provider:', selectedProvider);

    const formData = new FormData();
    formData.append('file', file);

    // Add AI provider parameter if not auto
    const params = new URLSearchParams();
    if (selectedProvider !== 'auto') {
      params.append('ai_provider', selectedProvider);
    }

    setIsLoading(true);
    setError('');
    setAnalysisResult(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/analyze${params.toString() ? '?' + params.toString() : ''}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
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

  const getProviderDisplayName = (provider) => {
    const names = {
      'gemini': 'Google Gemini',
      'openai': 'OpenAI GPT-4',
      'claude': 'Anthropic Claude'
    };
    return names[provider] || provider;
  };

  const getProviderIcon = (provider) => {
    const icons = {
      'gemini': '🤖',
      'openai': '🔥',
      'claude': '🧠'
    };
    return icons[provider] || '🤖';
  };

  const isUploadDisabled = !reportName || !reviewerName;

  console.log('Step 4: Rendering App component. Current analysisResult state is:', analysisResult);

  return (
    <div className="relative min-h-screen bg-gray-100 text-gray-800 font-sans pb-24">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">A11y Analyzer</h1>
              <p className="text-gray-600">Multi-AI Accessibility Report Analysis</p>
            </div>

            {/* AI Provider Status */}
            {availableProviders.length > 0 && (
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">AI Providers Available</div>
                <div className="flex items-center space-x-2">
                  {availableProviders.map(provider => (
                    <span
                      key={provider}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full"
                      title={getProviderDisplayName(provider)}
                    >
                      {getProviderIcon(provider)} {getProviderDisplayName(provider)}
                    </span>
                  ))}
                </div>
                {preferredProvider && (
                  <div className="text-xs text-gray-500 mt-1">
                    Preferred: {getProviderDisplayName(preferredProvider)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto">

          {/* Report Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="reportName" className="block text-sm font-medium text-gray-700 mb-1">
                Report Name *
              </label>
              <input
                type="text"
                id="reportName"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., JotForm VPAT Analysis"
              />
            </div>
            <div>
              <label htmlFor="reviewerName" className="block text-sm font-medium text-gray-700 mb-1">
                Author / Reviewer Name *
              </label>
              <input
                type="text"
                id="reviewerName"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Jane Doe"
              />
            </div>
          </div>

          {/* AI Provider Selection */}
          {availableProviders.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-medium text-gray-800 mb-3">AI Analysis Provider</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">

                {/* Auto Selection */}
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="radio"
                    name="aiProvider"
                    value="auto"
                    checked={selectedProvider === 'auto'}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-800">🎯 Auto Select</div>
                    <div className="text-xs text-gray-600">Best available</div>
                  </div>
                </label>

                {/* Individual Providers */}
                {availableProviders.map(provider => (
                  <label key={provider} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-white transition-colors">
                    <input
                      type="radio"
                      name="aiProvider"
                      value={provider}
                      checked={selectedProvider === provider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-800">
                        {getProviderIcon(provider)} {getProviderDisplayName(provider)}
                      </div>
                      {provider === preferredProvider && (
                        <div className="text-xs text-blue-600">Preferred</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-3 text-sm text-gray-600">
                {selectedProvider === 'auto'
                  ? `Will automatically use the best available provider (currently: ${preferredProvider ? getProviderDisplayName(preferredProvider) : 'None'})`
                  : `Will use ${getProviderDisplayName(selectedProvider)} for AI severity analysis`}
              </div>
            </div>
          )}

          {/* No AI Providers Warning */}
          {availableProviders.length === 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-yellow-600 mr-2">⚠️</span>
                <div>
                  <div className="font-medium text-yellow-800">No AI Providers Configured</div>
                  <div className="text-sm text-yellow-700 mt-1">
                    Using keyword-based severity analysis. Configure API keys for Gemini, OpenAI, or Claude for enhanced AI analysis.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          <h2 className="text-2xl font-semibold mb-4 border-t pt-6">Upload Conformance Report</h2>
          <p className="text-gray-600 mb-6">Upload a PDF, DOCX, or HTML accessibility report to begin analysis.</p>
          <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} disabled={isUploadDisabled} />

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-300 rounded-md">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="mt-6 text-center font-semibold text-gray-600">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span>Analyzing document with AI...</span>
              </div>
              {selectedProvider !== 'auto' && (
                <div className="text-sm text-gray-500 mt-2">
                  Using {getProviderDisplayName(selectedProvider)} for severity analysis
                </div>
              )}
            </div>
          )}

          {/* Results Display */}
          {analysisResult && (
            <ReportDisplay
              ref={reportDisplayRef}
              result={analysisResult}
              reportName={reportName}
              reviewerName={reviewerName}
            />
          )}
        </div>
      </main>

      {/* Export Footer */}
      {analysisResult && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
          <div className="container mx-auto px-4 py-3 flex justify-center items-center">
            <div className="flex space-x-4">
              <button
                onClick={() => reportDisplayRef.current?.exportAsHTML()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Export HTML
              </button>
              <button
                onClick={() => reportDisplayRef.current?.exportAsPDF()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Export PDF
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;