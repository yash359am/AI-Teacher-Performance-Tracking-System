import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please add your API key to the 'Secrets' panel in the AI Studio Settings menu.");
  }
  return new GoogleGenAI({ apiKey });
};

export interface AnalysisResult {
  mistakeDetected: boolean;
  mistakeDescription?: string;
  suggestion?: string;
  clarityScore: number;
  speedScore: number;
  engagementScore: number;
  transcript: string;
  pedagogicalFeedback?: string;
  subject?: string;
}

export const analyzeTeachingChunk = async (
  base64Image: string,
  transcript: string,
  classroomContext?: string
): Promise<AnalysisResult> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an elite Educational Quality Auditor. Your goal is to provide real-time feedback to a teacher to improve their performance.
    
    CONTEXT:
    - Transcript Snippet: "${transcript}"
    - Visual Context (Objects Detected): "${classroomContext || 'None'}"
    
    CRITICAL TASKS:
    1. FACTUAL VERIFICATION: Use Google Search to verify any scientific, historical, or mathematical claims made in the transcript. If the teacher makes a mistake (e.g., saying "The sun is a planet"), flag it immediately.
    2. PEDAGOGICAL ANALYSIS: Evaluate if the teacher is using effective techniques (e.g., scaffolding, checking for understanding, active learning).
    3. STUDENT ENGAGEMENT: Based on the image and detections, are students looking at the teacher/board? Are they using laptops for work or distraction?
    4. VOICE & PACE: Is the explanation clear? Is the pace appropriate for the complexity of the topic?
    
    OUTPUT REQUIREMENTS:
    - mistakeDetected: true if a factual or major pedagogical error is found.
    - mistakeDescription: Precise details of the error.
    - suggestion: Actionable advice to fix the error or improve the moment.
    - clarityScore, speedScore, engagementScore: 0-100.
    - pedagogicalFeedback: A short sentence on the teaching style. MANDATORY: If clarityScore, speedScore, or engagementScore are below 60%, you MUST include specific pedagogical advice in this field on how to improve that specific low-scoring metric.
    - subject: The specific subject or topic being taught (e.g., "Photosynthesis", "Quadratic Equations", "French Revolution").
    
    Return ONLY valid JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
          ],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mistakeDetected: { type: Type.BOOLEAN },
            mistakeDescription: { type: Type.STRING },
            suggestion: { type: Type.STRING },
            clarityScore: { type: Type.NUMBER },
            speedScore: { type: Type.NUMBER },
            engagementScore: { type: Type.NUMBER },
            transcript: { type: Type.STRING },
            pedagogicalFeedback: { type: Type.STRING },
            subject: { type: Type.STRING }
          },
          required: ["mistakeDetected", "clarityScore", "speedScore", "engagementScore", "transcript", "subject"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("Gemini Analysis Error:", e);
    if (e.message?.includes("API_KEY_INVALID") || e.message?.includes("invalid API key")) {
      throw new Error("The Gemini API key provided is invalid. Please check your key in the Secrets panel.");
    }
    throw e;
  }
};

export const generateSessionSummary = async (fullTranscript: string): Promise<string> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Summarize this teaching session and provide constructive feedback for the teacher: ${fullTranscript}`,
    });
    return response.text || "No summary available.";
  } catch (e) {
    console.error("Gemini Summary Error:", e);
    return "Failed to generate summary due to an AI service error.";
  }
};
