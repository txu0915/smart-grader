export interface GradingMark {
  id: string;
  x: number; // Percentage 0-100 (Location of the actual answer on paper)
  y: number; // Percentage 0-100 (Vertical alignment)
  status: 'correct' | 'incorrect';
  pageIndex: number;
  // New fields for detailed feedback
  question?: string;
  studentAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
}

export interface ExamPage {
  id: string;
  imageUrl: string;
  file: File;
  detectedLanguage?: 'en' | 'zh';
}

export enum AppStatus {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  PROCESSING = 'PROCESSING',
  REVIEWING = 'REVIEWING',
  EXPORTING = 'EXPORTING',
  COMPLETED = 'COMPLETED',
}

export interface StudentInfo {
  name: string;
  email: string;
}