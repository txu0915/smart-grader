import React, { ChangeEvent } from 'react';

interface ScannerProps {
  onFilesSelected: (files: FileList) => void;
}

const Scanner: React.FC<ScannerProps> = ({ onFilesSelected }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8">
      <div className="w-48 h-48 bg-blue-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
        <i className="fa-solid fa-camera text-6xl text-blue-500"></i>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Scan Exam Paper</h2>
        <p className="text-gray-500">Take a photo of the exam pages to start grading.</p>
      </div>

      <label className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition transform hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center space-x-3">
        <i className="fa-solid fa-plus text-xl"></i>
        <span>Scan / Upload Pages</span>
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          onChange={handleFileChange}
        />
      </label>

      <p className="text-xs text-gray-400 mt-4">Supports Multi-page Uploads</p>
    </div>
  );
};

export default Scanner;