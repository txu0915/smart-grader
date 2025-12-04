import React, { useRef, useState } from 'react';
import { GradingMark, ExamPage } from '../types';

interface GradingCanvasProps {
  page: ExamPage;
  marks: GradingMark[];
  pageIndex: number;
  onUpdateMark: (mark: GradingMark) => void;
  onRemoveMark: (markId: string) => void;
  onAddMark: (x: number, y: number, pageIndex: number) => void;
}

const GradingCanvas: React.FC<GradingCanvasProps> = ({ 
  page, 
  marks, 
  pageIndex,
  onUpdateMark, 
  onRemoveMark,
  onAddMark 
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [expandedMarkId, setExpandedMarkId] = useState<string | null>(null);

  // Localization map
  const labels = {
    en: {
      question: "Question",
      studentAnswer: "Student Answer",
      correctAnswer: "Correct Answer",
      analysis: "Analysis",
      correct: "Correct",
      incorrect: "Incorrect"
    },
    zh: {
      question: "题目",
      studentAnswer: "学生作答",
      correctAnswer: "正确答案",
      analysis: "解析",
      correct: "正确",
      incorrect: "错误"
    }
  };

  const lang = page.detectedLanguage || 'en';
  const t = labels[lang];

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;

    // Check if the click target is a button or note
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.mark-note')) return;

    // Close any expanded note if clicking background
    if (expandedMarkId) {
      setExpandedMarkId(null);
      return;
    }

    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const safeX = Math.max(0, Math.min(100, x));
    const safeY = Math.max(0, Math.min(100, y));

    onAddMark(safeX, safeY, pageIndex);
  };

  const handleMarkStatusToggle = (e: React.MouseEvent, mark: GradingMark) => {
    e.stopPropagation();
    onUpdateMark({ 
      ...mark, 
      status: mark.status === 'correct' ? 'incorrect' : 'correct' 
    });
  };

  const toggleNote = (e: React.MouseEvent, markId: string) => {
    e.stopPropagation();
    setExpandedMarkId(prev => prev === markId ? null : markId);
  };

  return (
    <div className="relative w-full h-full overflow-y-auto no-scrollbar bg-gray-900 flex justify-center pt-8 pb-48">
      {/* Paper Container */}
      <div 
        className="relative shadow-2xl bg-white rounded-sm"
        style={{ width: '95%', maxWidth: '800px', height: 'fit-content' }} 
      >
        {/* Image Wrapper */}
        <div className="relative" onClick={handleImageClick}>
          <img 
            ref={imgRef}
            src={page.imageUrl} 
            alt={`Page ${pageIndex + 1}`} 
            className="w-full h-auto block select-none"
          />
          
          {/* Marks Overlay */}
          {marks.map((mark) => {
            const isExpanded = expandedMarkId === mark.id;
            
            return (
              <div
                key={mark.id}
                className="absolute w-full pointer-events-none"
                style={{ top: `${mark.y}%`, height: 0 }}
              >
                {/* 1. The Connector Line (From answer location to right margin) */}
                <div 
                  className="absolute border-t-2 border-dotted border-gray-300 opacity-60"
                  style={{
                    left: `${mark.x}%`,
                    width: `${92 - mark.x}%`,
                    top: '0',
                  }}
                />

                {/* 2. The Anchor Dot (Where the actual answer is) */}
                <div 
                  className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-sm ${mark.status === 'correct' ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ left: `${mark.x}%`, top: '0' }}
                />

                {/* 3. The Interactive Marker (Right Side) */}
                <div 
                  className="absolute transform -translate-y-1/2 z-20 pointer-events-auto flex items-start"
                  style={{ left: '92%' }} // Fixed to right side
                >
                  <div className="relative">
                    {/* Main Badge */}
                    <button
                      onClick={(e) => toggleNote(e, mark.id)}
                      className={`
                        w-10 h-10 rounded-full shadow-lg border-2 border-white 
                        flex items-center justify-center text-lg transition-all duration-200
                        ${mark.status === 'correct' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
                        hover:scale-105 active:scale-95 z-20 relative
                      `}
                    >
                      {mark.status === 'correct' ? <i className="fa-solid fa-check"></i> : <i className="fa-solid fa-xmark"></i>}
                    </button>

                    {/* Quick Status Toggle (Small overlapping button) */}
                    {isExpanded && (
                       <button
                         onClick={(e) => handleMarkStatusToggle(e, mark)}
                         className="absolute -bottom-3 -left-2 w-6 h-6 bg-gray-700 text-white rounded-full text-xs flex items-center justify-center shadow-md z-30 hover:bg-black"
                         title="Toggle Status"
                       >
                         <i className="fa-solid fa-rotate"></i>
                       </button>
                    )}

                    {/* Expanded Detail Note (Sticky Note Style) */}
                    {isExpanded && (
                      <div className="mark-note absolute right-12 top-0 w-64 bg-yellow-50 rounded-xl shadow-xl border border-yellow-200 p-4 text-left z-50 animate-[fadeIn_0.2s_ease-out]">
                         {/* Header */}
                         <div className="flex justify-between items-start mb-2 border-b border-yellow-200 pb-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${mark.status === 'correct' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {mark.status === 'correct' ? t.correct : t.incorrect}
                            </span>
                            <button 
                              onClick={() => onRemoveMark(mark.id)}
                              className="text-gray-400 hover:text-red-500 px-1"
                            >
                              <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                         </div>

                         {/* Content */}
                         <div className="space-y-2 text-sm text-gray-800">
                           {mark.question && (
                             <div>
                               <p className="text-xs text-gray-500 uppercase font-semibold">{t.question}</p>
                               <p className="line-clamp-2">{mark.question}</p>
                             </div>
                           )}
                           {mark.studentAnswer && (
                             <div>
                               <p className="text-xs text-gray-500 uppercase font-semibold">{t.studentAnswer}</p>
                               <p className="font-mono bg-white/50 p-1 rounded text-xs">{mark.studentAnswer}</p>
                             </div>
                           )}
                           {mark.status === 'incorrect' && mark.correctAnswer && (
                             <div>
                               <p className="text-xs text-green-600 uppercase font-semibold">{t.correctAnswer}</p>
                               <p className="font-bold text-green-700">{mark.correctAnswer}</p>
                             </div>
                           )}
                           {mark.explanation && (
                             <div className="bg-yellow-100/50 p-2 rounded">
                               <p className="text-xs text-gray-500 uppercase font-semibold">{t.analysis}</p>
                               <p className="text-xs italic">{mark.explanation}</p>
                             </div>
                           )}
                         </div>
                         
                         {/* Arrow pointing to marker */}
                         <div className="absolute top-3 -right-2 w-4 h-4 bg-yellow-50 transform rotate-45 border-t border-r border-yellow-200"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs pointer-events-none z-20">
        Page {pageIndex + 1}
      </div>
    </div>
  );
};

export default GradingCanvas;