
import { Question } from "../types";

// AI Features have been disabled as per user request.
// This service file is kept as a placeholder for future integrations if needed,
// but currently exports dummy functions to prevent import errors during transition.

export const generateExamQuestions = async (topic: string, count: number, difficulty: string): Promise<Question[]> => {
  console.warn("AI generation is disabled.");
  return [];
};

export const autoGradeEssay = async (questionText: string, studentAnswer: string, maxPoints: number): Promise<{ score: number, feedback: string }> => {
  console.warn("AI grading is disabled.");
  return { score: 0, feedback: "Manual grading required." };
};
