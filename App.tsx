import React, { useState, useCallback } from 'react';
import { AppStatus, ExamPage, GradingMark, StudentInfo } from './types';
import Scanner from './components/Scanner';
import GradingCanvas from './components/GradingCanvas';
import StudentForm from './components/StudentForm';
import { gradeExamPages } from './services/geminiService';
import { generateGradedPDF } from './utils/pdfGenerator';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [pages, setPages] = useState<ExamPage[]>([]);
  const [marks, setMarks] = useState<GradingMark[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // --- Handlers ---

  const handleFilesSelected = async (files: FileList) => {
    setStatus(AppStatus.PROCESSING);
    
    // Create local preview URLs and state objects
    const initialPages: ExamPage[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      imageUrl: URL.createObjectURL(file),
      file
    }));
    
    setPages(initialPages);

    try {
      // Call AI Service
      // Returns marks AND potentially updated pages (rotated/straightened)
      const { marks: aiMarks, processedPages } = await gradeExamPages(initialPages);
      
      setMarks(aiMarks);
      setPages(processedPages); // Update pages with straightened versions
      setStatus(AppStatus.REVIEWING);
    } catch (error) {
      console.error("Grading failed", error);
      alert("Failed to grade the exam. Please check your API Key.");
      setStatus(AppStatus.IDLE);
    }
  };

  const updateMark = (updatedMark: GradingMark) => {
    setMarks(prev => prev.map(m => m.id === updatedMark.id ? updatedMark : m));
  };

  const removeMark = (markId: string) => {
    setMarks(prev => prev.filter(m => m.id !== markId));
  };

  const addMark = (x: number, y: number, pageIndex: number) => {
    const newMark: GradingMark = {
      id: `manual-${Date.now()}`,
      x,
      y,
      status: 'correct', // Default to correct when manually added
      pageIndex
    };
    setMarks(prev => [...prev, newMark]);
  };

  const handleApprove = () => {
    setIsStudentFormOpen(true);
  };

  const handleFinalSubmit = async (info: StudentInfo) => {
    setIsStudentFormOpen(false);
    setStatus(AppStatus.EXPORTING);
    setStudentInfo(info);

    try {
      const generatedBlob = await generateGradedPDF(pages, marks);
      const url = URL.createObjectURL(generatedBlob);
      setPdfBlob(generatedBlob);
      setDownloadUrl(url);
      setStatus(AppStatus.COMPLETED);
    } catch (error) {
      console.error("PDF Generation failed", error);
      alert("Failed to generate PDF.");
      setStatus(AppStatus.REVIEWING);
    }
  };

  // Convert Blob to Base64 for Capacitor Filesystem
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URI prefix (e.g. "data:application/pdf;base64,")
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleShare = async () => {
    if (!pdfBlob || !studentInfo) return;
    setIsSharing(true);

    try {
      const fileName = `Exam_Graded_${studentInfo.name.replace(/\s+/g, '_')}.pdf`;

      if (Capacitor.isNativePlatform()) {
        // --- Native Logic (iOS/Android) ---
        const base64Data = await blobToBase64(pdfBlob);

        // 1. Write file to cache directory
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        // 2. Share the file URI
        await Share.share({
          title: 'Exam Results',
          text: `Here are the graded results for ${studentInfo.name}.`,
          files: [result.uri],
        });

      } else {
        // --- Web Logic Fallback ---
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], fileName, { type: 'application/pdf' })] })) {
           await navigator.share({
             files: [new File([pdfBlob], fileName, { type: 'application/pdf' })],
             title: 'Exam Results',
             text: `Here are the graded results for ${studentInfo.name}.`
           });
        } else {
           // Direct download already handled by the download button, but we can trigger it
           const link = document.createElement('a');
           link.href = URL.createObjectURL(pdfBlob);
           link.download = fileName;
           link.click();
        }
      }
    } catch (error) {
      console.error("Share failed", error);
      // alert("Sharing cancelled or failed.");
    } finally {
      setIsSharing(false);
    }
  };

  const resetApp = () => {
    // Cleanup object URLs to avoid leaks
    pages.forEach(p => URL.revokeObjectURL(p.imageUrl));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    
    setPages([]);
    setMarks([]);
    setStatus(AppStatus.IDLE);
    setDownloadUrl(null);
    setPdfBlob(null);
    setStudentInfo(null);
    setActivePageIndex(0);
    setIsSharing(false);
  };

  // --- Render Helpers ---

  const renderContent = () => {
    switch (status) {
      case AppStatus.IDLE:
        return <Scanner onFilesSelected={handleFilesSelected} />;
      
      case AppStatus.PROCESSING:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              <i className="fa-solid fa-wand-magic-sparkles absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl text-blue-500"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">AI is Grading...</h2>
              <p className="text-gray-500 mt-2">Detecting orientation & analyzing answers</p>
            </div>
          </div>
        );

      case AppStatus.REVIEWING:
        return (
          <div className="relative h-full flex flex-col">
            {/* Header / Tabs */}
            {pages.length > 1 && (
              <div className="bg-white border-b overflow-x-auto whitespace-nowrap px-4 py-3 flex gap-2 no-scrollbar z-10">
                {pages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePageIndex(idx)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                      activePageIndex === idx 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Page {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Canvas Area */}
            <div className="flex-1 relative bg-gray-900 overflow-hidden">
              <GradingCanvas 
                page={pages[activePageIndex]}
                marks={marks.filter(m => m.pageIndex === activePageIndex)}
                pageIndex={activePageIndex}
                onUpdateMark={updateMark}
                onRemoveMark={removeMark}
                onAddMark={addMark}
              />
            </div>

            {/* Bottom Floating Action Bar */}
            <div className="absolute bottom-6 left-6 right-6 z-20">
               <div className="bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl p-2 flex items-center justify-between shadow-2xl">
                  <div className="flex items-center gap-4 px-4">
                     <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        {marks.filter(m => m.status === 'correct').length}
                     </div>
                     <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                        {marks.filter(m => m.status === 'incorrect').length}
                     </div>
                  </div>
                  <button 
                    onClick={handleApprove}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition"
                  >
                    Approve <i className="fa-solid fa-paper-plane ml-2"></i>
                  </button>
               </div>
            </div>
          </div>
        );

      case AppStatus.EXPORTING:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <i className="fa-solid fa-file-pdf text-5xl text-red-500 animate-bounce"></i>
            <h2 className="text-xl font-bold text-gray-800">Generating Report...</h2>
          </div>
        );

      case AppStatus.COMPLETED:
        const fileName = `Exam_Graded_${studentInfo?.name?.replace(/\s+/g, '_') || 'Student'}.pdf`;

        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-4xl shadow-sm">
              <i className="fa-solid fa-check"></i>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Grading Complete!</h2>
              <p className="text-gray-500 mt-2">
                Results ready for <span className="font-semibold text-gray-800">{studentInfo?.name}</span>
              </p>
            </div>

            <div className="flex flex-col w-full max-w-xs gap-3">
              {/* Native Share Button */}
              <button 
                onClick={handleShare}
                disabled={isSharing}
                className={`w-full font-bold py-4 px-6 rounded-2xl shadow-lg transition flex items-center justify-center gap-3
                  ${isSharing 
                    ? 'bg-blue-400 cursor-wait' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                  }
                `}
              >
                {isSharing ? (
                   <>
                     <i className="fa-solid fa-circle-notch animate-spin"></i>
                     <span>Preparing...</span>
                   </>
                ) : (
                   <>
                     <i className="fa-solid fa-arrow-up-from-bracket"></i>
                     <span>Share / Email PDF</span>
                   </>
                )}
              </button>

              {/* Download Button (Secondary) */}
              {downloadUrl && (
                <a 
                  href={downloadUrl}
                  download={fileName}
                  className="w-full bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-bold py-4 px-6 rounded-2xl transition flex items-center justify-center gap-3"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Save to Files</span>
                </a>
              )}
            </div>

            <button 
              onClick={resetApp}
              className="text-gray-400 hover:text-gray-600 font-medium text-sm mt-4"
            >
              Start Over
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] w-full max-w-md mx-auto bg-white shadow-2xl overflow-hidden flex flex-col relative md:rounded-3xl md:my-8 md:h-[90vh]">
      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md z-30 px-6 py-4 border-b flex justify-between items-center sticky top-0">
        <h1 className="text-xl font-black tracking-tight text-gray-900">
          <span className="text-blue-600">Smart</span>Grade
        </h1>
        {status === AppStatus.REVIEWING && (
           <button onClick={resetApp} className="text-red-500 font-medium text-sm hover:underline">
             Cancel
           </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>

      {isStudentFormOpen && (
        <StudentForm 
          onSubmit={handleFinalSubmit} 
          onCancel={() => setIsStudentFormOpen(false)} 
        />
      )}
    </div>
  );
}

export default App;