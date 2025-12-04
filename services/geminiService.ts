import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GradingMark, ExamPage } from "../types";

// Helper to convert file to base64
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to rotate image data url
const rotateImage = async (imageUrl: string, angle: number): Promise<string> => {
  if (angle === 0) return imageUrl;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Swap dimensions for 90 and 270 degree rotations
      if (angle === 90 || angle === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("No context"));
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      // Return high quality jpeg
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
};

interface GradingResult {
  marks: GradingMark[];
  processedPages: ExamPage[];
}

export const gradeExamPages = async (pages: ExamPage[]): Promise<GradingResult> => {
  // VITE SPECIFIC: Access environment variable via import.meta.env
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey || apiKey.includes("YOUR_ACTUAL_API_KEY")) {
    console.error("API Key is missing or invalid. Check .env file.");
    throw new Error("API Key not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const allMarks: GradingMark[] = [];
  const processedPages: ExamPage[] = [...pages];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const base64Data = await fileToGenerativePart(page.file);

    const prompt = `
      You are an expert academic grader. Analyze this image of an exam paper.
      
      Step 1: Detect Orientation & Language
      1. Determine if the image needs rotation to be upright. Return 'rotation_needed' as one of [0, 90, 180, 270].
      2. Detect the primary language of the exam content. Return 'detected_language' as 'zh' (Chinese) or 'en' (English).

      Step 2: Grade & Analyze
      Identify every student answer. For each answer:
      1. Determine if it is 'correct' or 'incorrect'.
      2. Estimate the center position (x, y percentages 0-100) relative to the image AS IT IS CURRENTLY (before rotation).
      3. Extract the 'question_text' (brief summary).
      4. Extract the 'student_answer' (what was written).
      5. Provide an 'explanation' of why it is right or wrong, and the 'correct_answer' if applicable.
      
      CRITICAL LANGUAGE RULE: 
      - The content of 'question', 'student_answer', 'correct_answer', and 'explanation' MUST be in the DETECTED LANGUAGE of the exam.
      - If the exam is in Chinese, use Chinese. If English, use English.
    `;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        rotation_needed: { 
          type: Type.INTEGER, 
          description: "Degrees clockwise to rotate image. One of 0, 90, 180, 270." 
        },
        detected_language: {
          type: Type.STRING,
          enum: ["en", "zh"],
          description: "Primary language of the exam text. 'zh' for Chinese, 'en' for English."
        },
        marks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "X coordinate percentage (0-100)" },
              y: { type: Type.NUMBER, description: "Y coordinate percentage (0-100)" },
              status: { type: Type.STRING, enum: ["correct", "incorrect"] },
              question: { type: Type.STRING, description: "The text of the question" },
              student_answer: { type: Type.STRING, description: "The answer provided by the student" },
              correct_answer: { type: Type.STRING, description: "The correct answer (if applicable)" },
              explanation: { type: Type.STRING, description: "Brief explanation of grading" },
            },
            required: ["x", "y", "status"],
          }
        }
      },
      required: ["rotation_needed", "marks"],
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash', // Using 2.0 Flash as requested for latest stable, or switch to 3-pro if available in your tier
        contents: {
          parts: [
            { inlineData: { mimeType: page.file.type || 'image/jpeg', data: base64Data } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1,
        }
      });

      const jsonText = response.text;
      if (jsonText) {
        const result = JSON.parse(jsonText);
        const rotation = result.rotation_needed || 0;
        const language = result.detected_language || 'en';
        let pageMarks = result.marks || [];

        // If rotation is needed, we update the page image and transform marks
        if (rotation !== 0) {
          // 1. Rotate Image
          const newImageUrl = await rotateImage(page.imageUrl, rotation);
          processedPages[i] = { 
            ...page, 
            imageUrl: newImageUrl,
            detectedLanguage: language 
          };

          // 2. Transform Marks
          pageMarks = pageMarks.map((m: any) => {
            let nx = m.x;
            let ny = m.y;
            
            if (rotation === 90) {
              nx = 100 - m.y;
              ny = m.x;
            } else if (rotation === 180) {
              nx = 100 - m.x;
              ny = 100 - m.y;
            } else if (rotation === 270) {
              nx = m.y;
              ny = 100 - m.x;
            }
            
            return { ...m, x: nx, y: ny };
          });
        } else {
          // Just update language
           processedPages[i] = { 
            ...page, 
            detectedLanguage: language 
          };
        }

        // Add ID, pageIndex, and map textual fields
        pageMarks.forEach((m: any) => {
          allMarks.push({
            id: `mark-${page.id}-${Math.random().toString(36).substr(2, 9)}`,
            x: m.x,
            y: m.y,
            status: m.status,
            pageIndex: i,
            question: m.question || (language === 'zh' ? "题目" : "Question"),
            studentAnswer: m.student_answer || (language === 'zh' ? "未知" : "Unknown"),
            correctAnswer: m.correct_answer || "-",
            explanation: m.explanation || (language === 'zh' ? "无解析" : "No explanation provided.")
          });
        });
      }
    } catch (error) {
      console.error(`Error grading page ${i + 1}:`, error);
      throw error;
    }
  }

  return { marks: allMarks, processedPages };
};