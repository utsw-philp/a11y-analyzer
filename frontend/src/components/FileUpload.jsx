import { useDropzone } from 'react-dropzone';
import { useCallback } from 'react';

// MODIFIED: Accept a 'disabled' prop
function FileUpload({ onFileUpload, isLoading, disabled }) {
  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/html': ['.html', '.htm'],
    },
    maxFiles: 1,
    // MODIFIED: The component is disabled if loading OR if the new 'disabled' prop is true
    disabled: isLoading || disabled,
  });

  return (
    // MODIFIED: Added styles for the disabled state
    <div
      {...getRootProps()}
      className={`p-10 border-2 border-dashed rounded-lg text-center transition-colors
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
        ${isLoading ? 'cursor-not-allowed opacity-60' : 'hover:border-blue-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
    >
      <input {...getInputProps()} />
      {disabled ? (
        <p className="text-gray-500">Please fill out the Report Name and Author fields above.</p>
      ) : isDragActive ? (
        <p className="text-blue-600">Drop the file here ...</p>
      ) : (
        <p className="text-gray-500">Drag & drop your report here, or click to select a file</p>
      )}
    </div>
  );
}

export default FileUpload;