import Anthropic from '@anthropic-ai/sdk';
import { Case, ChatMessage, IdealPathway, PathwayStep, ValidationError, ScoreBreakdown } from '../../../shared/types';
import {
  searchDomain,
  getDiseaseInfo,
  getCaseContext,
  formatRagContext,
  isRagAvailable,
  getIdealPathwayContext,
  formatIdealPathwayContext
} from './ragService';
import {
  aiCompletion,
  getProviderForTask,
  getAIProviderStatus,
  GROQ_MODELS,
  OPENAI_MODELS
} from './aiProvider';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Log AI provider status on module load
console.log('[AI] Provider status:', getAIProviderStatus());

/**
 * Generate patient response to a free-form question
 * Now uses RAG to ground responses in textbook knowledge
 */
export async function generatePatientResponse(
  caseData: Case,
  question: string,
  chatHistory: ChatMessage[]
): Promise<{ answer: string; questionQuality: number }> {
  const persona = caseData.persona;

  // Get the correct diagnosis name
  const correctDiagnosis = caseData.diagnoses.find(d => d.id === caseData.correctDiagnosisId);
  const diseaseName = correctDiagnosis?.name || '';

  // Query RAG for relevant context about the disease and question
  let ragContext = '';
  try {
    const contextResult = await getCaseContext(diseaseName, caseData.symptoms, question);
    if (contextResult && contextResult.context.length > 0) {
      ragContext = formatRagContext(contextResult.context);
    }
  } catch (error) {
    console.error('RAG context fetch failed:', error);
  }

  const systemPrompt = `You are roleplaying as a patient in a medical diagnosis game. You must stay completely in character.

YOUR CHARACTER:
- Name: ${persona.name}
- Age: ${persona.age}
- Gender: ${persona.gender}
- Occupation: ${persona.occupation}
- Personality: ${persona.personalityTraits.join(', ')}
- Background: ${persona.background}

YOUR MEDICAL SITUATION (hidden from the player - use this to inform your responses):
- Condition: ${diseaseName}
- Initial complaint: ${caseData.initialComplaint}
- Medical history: ${caseData.medicalHistory}
- Actual symptoms: ${caseData.symptoms}
- Relevant findings: ${caseData.relevantFindings}
- Red herrings (might mention if asked): ${caseData.redHerrings}

MEDICAL REFERENCE (from textbook - use this to ensure accuracy):
${ragContext || 'No additional reference available.'}

RULES:
1. Stay in character as the patient at all times
2. Answer questions naturally based on your medical situation AND the textbook reference
3. If asked about something in your symptoms/findings, reveal it naturally
4. If asked about something NOT in your situation, say you don't have that symptom
5. Be conversational - patients don't speak in medical jargon
6. You can be vague about timing or severity if it matches your personality
7. Never reveal the diagnosis or mention you're in a game
8. Keep responses to 2-4 sentences
9. Match your personality traits in how you respond
10. IMPORTANT: Only describe symptoms that are consistent with ${diseaseName} as per the textbook reference

ALSO: At the end of your response, on a new line, add a quality score for the doctor's question in this exact format:
[QUALITY:X]
where X is 1-10 based on:
- 10: Excellent diagnostic question that efficiently narrows down possibilities
- 7-9: Good relevant medical question
- 4-6: Okay question, somewhat relevant
- 1-3: Poor question, irrelevant or too vague`;

  // Build conversation history for context
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Add chat history
  for (const msg of chatHistory.slice(-10)) {
    messages.push({
      role: msg.role === "player" ? "user" : "assistant",
      content: msg.content
    });
  }

  // Add current question
  messages.push({ role: "user", content: question });

  try {
    // Use unified AI provider (Groq for speed in hybrid mode)
    const provider = getProviderForTask('patient_response');
    console.log(`[Patient Response] Using provider: ${provider}`);

    const fullResponse = await aiCompletion({
      taskType: 'patient_response',
      systemPrompt,
      userPrompt: question,
      messages: chatHistory.slice(-10).map(msg => ({
        role: msg.role === 'player' ? 'user' as const : 'assistant' as const,
        content: msg.content
      })),
      maxTokens: 300,
      temperature: 0.7
    });

    // Parse out the quality score (handle optional whitespace)
    const qualityMatch = fullResponse.match(/\[QUALITY:\s*(\d+)\s*\]/i);
    const questionQuality = qualityMatch ? parseInt(qualityMatch[1], 10) : 5;

    // Remove the quality tag from the answer
    const answer = fullResponse.replace(/\[QUALITY:\s*\d+\s*\]/i, '').trim();

    return {
      answer: answer || "I'm not sure how to answer that.",
      questionQuality: Math.min(10, Math.max(1, questionQuality))
    };
  } catch (error) {
    console.error('AI API error:', error);
    return {
      answer: "I'm sorry, could you repeat that? I didn't quite understand.",
      questionQuality: 5
    };
  }
}

export interface GenerateCaseOptions {
  domain?: string;
  skipPrecompute?: boolean; // Skip precomputing explanations (for batched generation)
  skipPathway?: boolean; // Skip generating ideal pathway (for batched generation)
}

/**
 * Generate a complete medical case using RAG textbook knowledge
 * @param domainOrOptions - Domain string or options object
 */
export async function generateCase(domainOrOptions?: string | GenerateCaseOptions): Promise<Case> {
  // Handle both old (string) and new (options) signatures
  const options: GenerateCaseOptions = typeof domainOrOptions === 'string'
    ? { domain: domainOrOptions }
    : domainOrOptions || {};
  const domain = options.domain;
  // Medical domains from the textbook
  const domains = [
    'cardiology',
    'respiratory',
    'gastroenterology',
    'neurology',
    'nephrology',
    'hematology',
    'endocrinology',
    'rheumatology',
    'infectious diseases',
    'dermatology'
  ];

  // Use specified domain if valid, otherwise pick random
  const selectedDomain = domain && domains.includes(domain)
    ? domain
    : domains[Math.floor(Math.random() * domains.length)];

  // Check if RAG is available
  const ragAvailable = await isRagAvailable();

  let textbookContext = '';

  if (ragAvailable) {
    // Query RAG for diseases in this domain
    console.log(`Querying RAG for ${selectedDomain} diseases...`);
    const domainResults = await searchDomain(selectedDomain, 'diseases', 20);

    if (domainResults && domainResults.results.length > 0) {
      textbookContext = formatRagContext(domainResults.results);
      console.log(`Found ${domainResults.results.length} relevant textbook chunks`);
    }
  } else {
    console.warn('RAG API not available, generating case without textbook grounding');
  }

  // Randomized Indian names
  const maleNames = [
    'Rajesh Kumar', 'Anil Patel', 'Suresh Nair', 'Vikram Singh', 'Amit Sharma',
    'Sanjay Gupta', 'Prakash Reddy', 'Ramesh Iyer', 'Manoj Verma', 'Deepak Joshi',
    'Arvind Menon', 'Kiran Rao', 'Venkatesh Murthy', 'Harish Pillai', 'Gopal Das',
    'Ashok Banerjee', 'Ravi Krishnan', 'Sunil Deshmukh', 'Mohan Chatterjee', 'Nitin Kulkarni'
  ];
  const femaleNames = [
    'Priya Sharma', 'Meera Reddy', 'Kavitha Iyer', 'Anjali Gupta', 'Sunita Patel',
    'Lakshmi Nair', 'Deepa Menon', 'Radha Krishna', 'Padma Rao', 'Geeta Verma',
    'Anita Singh', 'Rekha Pillai', 'Savitha Das', 'Kamala Devi', 'Usha Banerjee',
    'Shanti Murthy', 'Saroja Krishnan', 'Vijaya Deshmukh', 'Lalitha Kulkarni', 'Prema Chatterjee'
  ];

  // Randomized Indian occupations
  const occupations = [
    'Software Engineer in Bangalore', 'School Teacher in Chennai', 'Bank Manager in Mumbai',
    'Shopkeeper in Delhi', 'Farmer in Punjab', 'Auto Rickshaw Driver in Hyderabad',
    'Government Clerk in Kolkata', 'Restaurant Owner in Pune', 'Textile Worker in Surat',
    'College Professor in Jaipur', 'Nurse in Lucknow', 'Accountant in Ahmedabad',
    'Police Constable in Bhopal', 'Tailor in Varanasi', 'Construction Worker in Noida',
    'Homemaker in Coimbatore', 'Small Business Owner in Indore', 'Security Guard in Gurgaon',
    'Bus Driver in Nagpur', 'Factory Supervisor in Ludhiana', 'Retired Army Personnel',
    'Daily Wage Labourer', 'Electrician in Thane', 'Plumber in Kanpur'
  ];

  // Random selection
  const selectedGender = Math.random() < 0.5 ? 'Male' : 'Female';
  const nameList = selectedGender === 'Male' ? maleNames : femaleNames;
  const selectedName = nameList[Math.floor(Math.random() * nameList.length)];
  const selectedOccupation = occupations[Math.floor(Math.random() * occupations.length)];

  const systemPrompt = `You are a medical case generator for an educational diagnosis game.
You MUST use the provided textbook reference to create accurate, realistic cases.

TEXTBOOK REFERENCE FOR ${selectedDomain.toUpperCase()}:
${textbookContext || 'No textbook reference available - use your medical knowledge carefully.'}

IMPORTANT REQUIREMENTS:
1. Patient name: ${selectedName}
2. Patient gender: ${selectedGender}
3. Patient occupation: ${selectedOccupation}
4. AGE: Choose an age that is CLINICALLY APPROPRIATE for the disease you select. For example:
   - Pediatric conditions: 1-17 years
   - Young adult conditions: 18-35 years
   - Middle-aged conditions: 36-55 years
   - Elderly conditions: 56-85 years
   - If the disease can occur at any age, pick randomly between 25-65
5. Focus on ${selectedDomain} conditions FROM THE TEXTBOOK REFERENCE above
6. CRITICAL: The correct diagnosis, symptoms, and findings MUST be based on information from the textbook reference
7. Do NOT invent symptoms or findings - only use what's mentioned in the textbook

Output ONLY a valid JSON object with this exact structure:
{
  "persona": {
    "name": "${selectedName}",
    "age": <appropriate age for the disease>,
    "gender": "${selectedGender}",
    "occupation": "${selectedOccupation}",
    "background": "1-2 sentences about their life relevant to the case",
    "lifestyle": {
      "activityLevel": "low/moderate/high",
      "smoking": true/false/"unknown",
      "alcohol": "none/social/heavy"
    },
    "personalityTraits": ["trait1", "trait2", "trait3"]
  },
  "diagnoses": [
    {"id": "d1", "name": "Condition Name from Textbook", "description": "Brief description from textbook"},
    ... (10 total, all from the textbook reference)
  ],
  "correctDiagnosisId": "d5",
  "initialComplaint": "What the patient says - based on textbook symptoms",
  "medicalHistory": "Relevant past medical history",
  "symptoms": "Detailed symptoms FROM THE TEXTBOOK for this condition",
  "relevantFindings": "Examination and test findings FROM THE TEXTBOOK",
  "redHerrings": "Some symptoms that could point to other diagnoses in the differential"
}

Requirements:
- Include exactly 10 possible diagnoses, ALL mentioned in the textbook reference
- Make 3-4 diagnoses plausible based on initial complaint
- The correct diagnosis should be discoverable through good questioning
- Symptoms and findings MUST match what's in the textbook for that condition
- The age MUST be clinically appropriate for the chosen disease`;

  const userPrompt = `Generate a medical case in ${selectedDomain} for patient ${selectedName} (${selectedGender}, ${selectedOccupation}).
Use ONLY diseases and symptoms mentioned in the textbook reference above.
Choose an age that is medically appropriate for the disease you select.
The case should be challenging but solvable through systematic questioning.`;

  try {
    // Use unified AI provider (OpenAI for quality in hybrid mode)
    const provider = getProviderForTask('case_generation');
    console.log(`[Case Generation] Using provider: ${provider}`);

    let content = await aiCompletion({
      taskType: 'case_generation',
      systemPrompt,
      userPrompt,
      maxTokens: 3000,
      temperature: 0.8,
      jsonMode: true
    });

    if (!content) throw new Error('No response from AI provider');

    // Strip markdown code blocks if present
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.slice(7);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    const caseData = JSON.parse(content);
    caseData.id = `case_${Date.now()}`;
    caseData.domain = selectedDomain; // Track which domain was used

    // If RAG is available, enrich with more disease info and optionally generate ideal pathway
    if (ragAvailable) {
      const correctDiagnosis = caseData.diagnoses.find(
        (d: { id: string }) => d.id === caseData.correctDiagnosisId
      );
      if (correctDiagnosis) {
        const diseaseInfo = await getDiseaseInfo(correctDiagnosis.name);
        if (diseaseInfo && diseaseInfo.info) {
          // Enrich symptoms and findings with textbook info
          if (diseaseInfo.info.symptoms && diseaseInfo.info.symptoms.length > 0) {
            caseData.symptoms += '\n\nFrom textbook: ' + diseaseInfo.info.symptoms[0].substring(0, 500);
          }
          if (diseaseInfo.info.findings && diseaseInfo.info.findings.length > 0) {
            caseData.relevantFindings += '\n\nFrom textbook: ' + diseaseInfo.info.findings[0].substring(0, 500);
          }
        }

        // Generate the ideal diagnostic pathway for coaching (with retry) - unless skipped for batching
        if (!options.skipPathway) {
          console.log(`Generating ideal pathway for ${correctDiagnosis.name}...`);
          let idealPathway = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            idealPathway = await generateIdealPathway(
              correctDiagnosis.name,
              selectedDomain,
              caseData as Case
            );
            if (idealPathway) break;
            console.log(`Ideal pathway generation attempt ${attempt} failed, ${attempt < 3 ? 'retrying...' : 'giving up'}`);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
          }

          if (idealPathway) {
            caseData.idealPathway = idealPathway;
            console.log('Ideal pathway generated successfully');
          } else {
            console.error('Failed to generate ideal pathway after 3 attempts - case will be incomplete');
            throw new Error('Failed to generate ideal pathway - cannot create incomplete case');
          }
        } else {
          console.log('Skipping pathway generation (will be done in second pass)');
        }
      }
    }

    // Pre-compute all diagnosis explanations for faster submission (unless skipped)
    if (!options.skipPrecompute) {
      console.log('Pre-computing diagnosis explanations...');
      const precomputedExplanations = await precomputeAllExplanations(caseData as Case);
      if (precomputedExplanations.length > 0) {
        caseData.precomputedExplanations = precomputedExplanations;
        console.log(`Pre-computed ${precomputedExplanations.length} diagnosis explanations`);
      }
    } else {
      console.log('Skipping precompute (will be done in second pass)');
    }

    return caseData as Case;
  } catch (error) {
    console.error('Case generation error:', error);
    throw new Error('Failed to generate case');
  }
}

/**
 * Generate test/scan results based on case data and textbook knowledge
 */
export async function generateTestResult(
  caseData: Case,
  testName: string
): Promise<{ result: string; isAbnormal: boolean }> {
  const correctDiagnosis = caseData.diagnoses.find(d => d.id === caseData.correctDiagnosisId);
  const diseaseName = correctDiagnosis?.name || '';

  // Query RAG for test findings related to this disease
  let ragContext = '';
  try {
    const contextResult = await getCaseContext(diseaseName, testName, 'investigation test results findings');
    if (contextResult && contextResult.context.length > 0) {
      ragContext = formatRagContext(contextResult.context.slice(0, 3));
    }
  } catch (error) {
    console.error('RAG context fetch failed:', error);
  }

  const systemPrompt = `You are a medical test result generator for an educational diagnosis game.

PATIENT CASE:
- Patient: ${caseData.persona.name}, ${caseData.persona.age} years old, ${caseData.persona.gender}
- Condition: ${diseaseName}
- Initial complaint: ${caseData.initialComplaint}
- Symptoms: ${caseData.symptoms}
- Relevant findings: ${caseData.relevantFindings}

TEXTBOOK REFERENCE (use this for accurate test values):
${ragContext || 'No specific reference available.'}

TASK: Generate realistic test results for "${testName}" consistent with ${diseaseName}.

RULES:
1. Results should be medically accurate based on the textbook reference
2. If the test is relevant to ${diseaseName}, show appropriate abnormalities as per textbook
3. If the test is not relevant, show normal results
4. Include specific values with units (e.g., "Hemoglobin: 14.2 g/dL")
5. Be concise but informative (2-5 lines)
6. For imaging, describe what would be seen per textbook
7. Never reveal the diagnosis directly

RESPONSE FORMAT:
Line 1: "ABNORMAL" or "NORMAL"
Following lines: Actual test results`;

  try {
    // Use unified AI provider (Groq for speed in hybrid mode)
    const provider = getProviderForTask('test_result');
    console.log(`[Test Result] Using provider: ${provider}`);

    const fullResponse = await aiCompletion({
      taskType: 'test_result',
      systemPrompt,
      userPrompt: `Generate results for: ${testName}`,
      maxTokens: 400,
      temperature: 0.5
    });

    const lines = fullResponse.split('\n');
    const firstLine = lines[0].toUpperCase();
    const isAbnormal = firstLine.includes('ABNORMAL');
    const result = lines.slice(1).join('\n').trim() || fullResponse;

    return { result, isAbnormal };
  } catch (error) {
    console.error('Test result generation error:', error);
    return {
      result: 'Unable to process test at this time. Please try again.',
      isAbnormal: false
    };
  }
}

/**
 * Generate physical examination findings based on case data and textbook
 */
export async function generateExamFinding(
  caseData: Case,
  examName: string
): Promise<{ finding: string; isAbnormal: boolean }> {
  const correctDiagnosis = caseData.diagnoses.find(d => d.id === caseData.correctDiagnosisId);
  const diseaseName = correctDiagnosis?.name || '';

  // Query RAG for examination findings
  let ragContext = '';
  try {
    const contextResult = await getCaseContext(diseaseName, examName, 'physical examination signs findings');
    if (contextResult && contextResult.context.length > 0) {
      ragContext = formatRagContext(contextResult.context.slice(0, 3));
    }
  } catch (error) {
    console.error('RAG context fetch failed:', error);
  }

  // Special handling for PICCLE exam
  const isPiccleExam = examName.toLowerCase().includes('piccle');
  const piccleInstructions = isPiccleExam ? `
IMPORTANT: This is a PICCLE examination. You MUST report on ALL of these in order:
- Pallor (check conjunctiva, nail beds, tongue)
- Icterus (check sclera, under tongue)
- Cyanosis (check lips, fingertips, tongue)
- Clubbing (check nail angle, nail bed fluctuation)
- Lymphadenopathy (check cervical, axillary, inguinal nodes)
- Edema (check pedal edema, sacral edema, facial puffiness)

Format your response as:
Pallor: [finding]
Icterus: [finding]
Cyanosis: [finding]
Clubbing: [finding]
Lymphadenopathy: [finding]
Edema: [finding]
` : '';

  const systemPrompt = `You are a physical examination result generator for an educational medical diagnosis game.

PATIENT CASE:
- Patient: ${caseData.persona.name}, ${caseData.persona.age} years old, ${caseData.persona.gender}
- Condition: ${diseaseName}
- Initial complaint: ${caseData.initialComplaint}
- Symptoms: ${caseData.symptoms}
- Relevant findings: ${caseData.relevantFindings}

TEXTBOOK REFERENCE (use this for accurate findings):
${ragContext || 'No specific reference available.'}

TASK: Generate realistic examination findings for "${examName}" consistent with ${diseaseName}.
${piccleInstructions}
RULES:
1. Findings should be medically accurate based on the textbook reference
2. If the exam is relevant to ${diseaseName}, show appropriate abnormal findings
3. If the exam is not relevant, show normal findings
4. For vital signs, include specific values (e.g., "HR: 88 bpm, regular rhythm")
5. Be concise but descriptive (1-3 lines for regular exams, complete for PICCLE)
6. Use proper medical terminology
7. Never reveal the diagnosis directly

RESPONSE FORMAT:
Line 1: "ABNORMAL" or "NORMAL"
Following lines: Actual examination findings`;

  try {
    // Use unified AI provider (Groq for speed in hybrid mode)
    const provider = getProviderForTask('exam_finding');
    console.log(`[Exam Finding] Using provider: ${provider}`);

    const fullResponse = await aiCompletion({
      taskType: 'exam_finding',
      systemPrompt,
      userPrompt: `Perform examination: ${examName}`,
      maxTokens: isPiccleExam ? 500 : 300,
      temperature: 0.5
    });

    const lines = fullResponse.split('\n');
    const firstLine = lines[0].toUpperCase();
    const isAbnormal = firstLine.includes('ABNORMAL');
    const finding = lines.slice(1).join('\n').trim() || fullResponse;

    return { finding, isAbnormal };
  } catch (error) {
    console.error('Exam finding generation error:', error);
    return {
      finding: 'Unable to complete examination at this time. Please try again.',
      isAbnormal: false
    };
  }
}

/**
 * Generate the ideal diagnostic pathway from textbook knowledge
 * This defines the "gold standard" approach for diagnosing a condition
 */
export async function generateIdealPathway(
  diseaseName: string,
  domain: string,
  caseData: Case
): Promise<IdealPathway | null> {
  // Get comprehensive textbook context for this disease
  const pathwayContext = await getIdealPathwayContext(diseaseName, domain, 15);

  if (!pathwayContext) {
    console.warn('Could not get RAG context for ideal pathway');
    return null;
  }

  const textbookContext = formatIdealPathwayContext(pathwayContext);

  const systemPrompt = `You are a medical education expert creating the IDEAL diagnostic pathway for ${diseaseName}.
You MUST base your pathway ENTIRELY on the textbook reference provided. Do not add information not in the textbook.

TEXTBOOK REFERENCE:
${textbookContext}

CASE CONTEXT:
- Patient: ${caseData.persona.name}, ${caseData.persona.age} years old, ${caseData.persona.gender}
- Initial complaint: ${caseData.initialComplaint}
- Domain: ${domain}

Create the ideal step-by-step approach a doctor should take to diagnose ${diseaseName}.
Focus on:
1. What history questions to ask (based on textbook symptoms)
2. What physical examinations to perform (based on textbook signs)
3. What investigations to order, in order of cost-effectiveness (based on textbook)
4. How to differentiate from similar conditions (based on textbook)

Output ONLY a valid JSON object with this exact structure:
{
  "keyHistoryQuestions": [
    {
      "order": 1,
      "type": "history",
      "action": "Ask about [specific symptom from textbook]",
      "reasoning": "Why this is important per textbook",
      "expectedFinding": "What finding confirms the diagnosis",
      "importance": "critical|important|helpful",
      "textbookReference": "Brief quote from textbook"
    }
  ],
  "keyExaminations": [
    {
      "order": 1,
      "type": "examination",
      "action": "Perform [specific exam]",
      "reasoning": "Why from textbook",
      "expectedFinding": "Expected finding",
      "importance": "critical|important|helpful",
      "textbookReference": "Brief quote from textbook"
    }
  ],
  "keyInvestigations": [
    {
      "order": 1,
      "type": "investigation",
      "action": "Order [test name]",
      "reasoning": "Why this test per textbook",
      "expectedFinding": "Expected result",
      "importance": "critical|important|helpful",
      "textbookReference": "Brief quote from textbook"
    }
  ],
  "differentialDiagnoses": [
    {
      "name": "Other condition",
      "howToRuleOut": "How to differentiate per textbook",
      "textbookReference": "Brief quote"
    }
  ],
  "diagnosticApproach": "Summary of the systematic approach from textbook"
}

REQUIREMENTS:
- Include 3-5 key history questions (most important symptoms)
- Include 2-4 key examinations (most revealing signs)
- Include 3-5 key investigations (in order of cost-effectiveness: cheap basic tests first, expensive imaging last)
- Include 2-4 differential diagnoses
- Mark only 1-2 items as "critical", rest as "important" or "helpful"
- ALL information must come from the textbook reference provided`;

  try {
    // Use unified AI provider (OpenAI for quality in hybrid mode)
    const provider = getProviderForTask('ideal_pathway');
    console.log(`[Ideal Pathway] Using provider: ${provider}`);

    let content = await aiCompletion({
      taskType: 'ideal_pathway',
      systemPrompt,
      userPrompt: `Generate the ideal diagnostic pathway for ${diseaseName} based on the textbook.`,
      maxTokens: 3500,
      temperature: 0.5,
      jsonMode: true
    });

    if (!content) {
      console.error('No response from AI provider for ideal pathway');
      return null;
    }

    // Strip markdown code blocks if present
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.slice(7);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    const pathwayData = JSON.parse(content);

    // Extract textbook source summaries
    const textbookSources: string[] = [];
    if (pathwayContext.textbook_context.symptoms?.[0]) {
      textbookSources.push(pathwayContext.textbook_context.symptoms[0].text.substring(0, 200) + '...');
    }
    if (pathwayContext.textbook_context.investigations?.[0]) {
      textbookSources.push(pathwayContext.textbook_context.investigations[0].text.substring(0, 200) + '...');
    }

    const idealPathway: IdealPathway = {
      diseaseName,
      domain,
      keyHistoryQuestions: pathwayData.keyHistoryQuestions || [],
      keyExaminations: pathwayData.keyExaminations || [],
      keyInvestigations: pathwayData.keyInvestigations || [],
      differentialDiagnoses: pathwayData.differentialDiagnoses || [],
      diagnosticApproach: pathwayData.diagnosticApproach || '',
      textbookSources
    };

    console.log(`Generated ideal pathway for ${diseaseName}: ${idealPathway.keyHistoryQuestions.length} questions, ${idealPathway.keyExaminations.length} exams, ${idealPathway.keyInvestigations.length} tests`);

    return idealPathway;
  } catch (error) {
    console.error('Ideal pathway generation error:', error);
    return null;
  }
}

/**
 * Pre-compute all diagnosis explanations for a case
 * Generates one explanation at a time for reliability
 */
export async function precomputeAllExplanations(
  caseData: Case
): Promise<Array<{
  diagnosisId: string;
  diagnosisName: string;
  description: string;
  keySymptoms: string[];
  clinicalReasoning: string;
  whyIncorrectForCase?: string;
  keyDifferencesFromCorrect?: string[];
  missingFindings?: string[];
}>> {
  console.log(`[Precompute] Generating explanations for ${caseData.diagnoses.length} diagnoses (one by one)...`);
  const startTime = Date.now();
  const explanations: Array<{
    diagnosisId: string;
    diagnosisName: string;
    description: string;
    keySymptoms: string[];
    clinicalReasoning: string;
    whyIncorrectForCase?: string;
    keyDifferencesFromCorrect?: string[];
    missingFindings?: string[];
  }> = [];

  for (const diagnosis of caseData.diagnoses) {
    try {
      const explanation = await generateSingleDiagnosisExplanation(caseData, diagnosis.id);
      if (explanation) {
        explanations.push(explanation);
        console.log(`[Precompute] ✓ ${diagnosis.id}: ${diagnosis.name}`);
      } else {
        console.log(`[Precompute] ✗ ${diagnosis.id}: No explanation generated`);
      }
    } catch (error) {
      console.error(`[Precompute] ✗ ${diagnosis.id}: Error -`, error);
    }
  }

  console.log(`[Precompute] Generated ${explanations.length}/${caseData.diagnoses.length} explanations in ${Date.now() - startTime}ms`);
  return explanations;
}

/**
 * Generate a single diagnosis explanation (fallback for backfill)
 */
export async function generateSingleDiagnosisExplanation(
  caseData: Case,
  diagnosisId: string
): Promise<{
  diagnosisId: string;
  diagnosisName: string;
  description: string;
  keySymptoms: string[];
  clinicalReasoning: string;
  whyIncorrectForCase?: string;
  keyDifferencesFromCorrect?: string[];
  missingFindings?: string[];
} | null> {
  const diagnosis = caseData.diagnoses.find(d => d.id === diagnosisId);
  if (!diagnosis) return null;

  const correctDiagnosis = caseData.diagnoses.find(d => d.id === caseData.correctDiagnosisId);
  const isCorrect = diagnosisId === caseData.correctDiagnosisId;

  const systemPrompt = `You are a JSON generator for medical education. Output ONLY valid JSON.

CASE:
- Patient: ${caseData.persona.name}, ${caseData.persona.age}yo ${caseData.persona.gender}
- Complaint: ${caseData.initialComplaint}
- Symptoms: ${caseData.symptoms}
- Findings: ${caseData.relevantFindings}
- CORRECT DIAGNOSIS: ${correctDiagnosis?.name || 'Unknown'}

TARGET DIAGNOSIS: ${diagnosis.name} (${isCorrect ? 'THIS IS CORRECT' : 'THIS IS INCORRECT'})

Generate a detailed JSON explanation. Use **bold** for key medical terms.

${isCorrect ? `
{
  "diagnosisId": "${diagnosisId}",
  "diagnosisName": "${diagnosis.name}",
  "isCorrect": true,
  "description": "2-3 sentence disease description",
  "keySymptoms": ["**Term** - 15 word explanation why this symptom matters", ...],
  "clinicalReasoning": "3-4 sentence clinical analysis explaining why this diagnosis fits"
}` : `
{
  "diagnosisId": "${diagnosisId}",
  "diagnosisName": "${diagnosis.name}",
  "isCorrect": false,
  "description": "2-3 sentence disease description",
  "keySymptoms": ["**Term** - 15 word explanation", ...],
  "clinicalReasoning": "3-4 sentence clinical analysis",
  "whyIncorrectForCase": "2 sentences why it doesn't fit THIS patient",
  "keyDifferencesFromCorrect": ["**Feature** - how it differs from ${correctDiagnosis?.name}", ...],
  "missingFindings": ["**Finding** - why absence rules out this diagnosis", ...]
}`}`;

  try {
    // Use unified AI provider (OpenAI for quality in hybrid mode)
    const provider = getProviderForTask('explanation');
    console.log(`[Diagnosis Explanation] Using provider: ${provider}`);

    let content = await aiCompletion({
      taskType: 'explanation',
      systemPrompt,
      userPrompt: 'Generate the JSON:',
      maxTokens: 1500,
      temperature: 0.5,
      jsonMode: true
    });

    content = content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');

    const exp = JSON.parse(content);
    return {
      diagnosisId: exp.diagnosisId,
      diagnosisName: exp.diagnosisName,
      description: exp.description || '',
      keySymptoms: exp.keySymptoms || [],
      clinicalReasoning: exp.clinicalReasoning || '',
      whyIncorrectForCase: exp.isCorrect ? undefined : exp.whyIncorrectForCase,
      keyDifferencesFromCorrect: exp.isCorrect ? undefined : exp.keyDifferencesFromCorrect,
      missingFindings: exp.isCorrect ? undefined : exp.missingFindings
    };
  } catch (error) {
    console.error(`[Single] Error generating explanation for ${diagnosisId}:`, error);
    return null;
  }
}

/**
 * Generate explanation of why the correct diagnosis is right
 * Explains matching signs, symptoms, and clinical reasoning
 */
export async function generateDiagnosisExplanation(
  caseData: Case,
  playerActions: {
    questions: string[];
    exams: { name: string; finding: string; isAbnormal: boolean }[];
    tests: { name: string; result: string; isAbnormal: boolean }[];
  }
): Promise<{
  description: string;
  keySymptoms: string[];
  diagnosisSteps: string[];
  keyFindings: string[];
  clinicalReasoning: string;
}> {
  const correctDiagnosis = caseData.diagnoses.find(d => d.id === caseData.correctDiagnosisId);
  const diseaseName = correctDiagnosis?.name || 'Unknown';

  // Get RAG context for the disease
  let ragContext = '';
  try {
    const diseaseInfo = await getDiseaseInfo(diseaseName);
    if (diseaseInfo && diseaseInfo.info) {
      if (diseaseInfo.info.overview) {
        ragContext += 'Overview: ' + diseaseInfo.info.overview.slice(0, 2).join('\n') + '\n\n';
      }
      if (diseaseInfo.info.symptoms) {
        ragContext += 'Symptoms: ' + diseaseInfo.info.symptoms.slice(0, 2).join('\n') + '\n\n';
      }
      if (diseaseInfo.info.findings) {
        ragContext += 'Findings: ' + diseaseInfo.info.findings.slice(0, 2).join('\n');
      }
    }
  } catch (error) {
    console.error('RAG fetch failed for diagnosis explanation:', error);
  }

  const systemPrompt = `You are a medical educator. Generate a STRUCTURED, TEXTBOOK-STYLE explanation.

CASE INFORMATION:
- Patient: ${caseData.persona.name}, ${caseData.persona.age}yo ${caseData.persona.gender}
- Initial complaint: ${caseData.initialComplaint}
- Actual symptoms: ${caseData.symptoms}
- Relevant findings: ${caseData.relevantFindings}
- Correct diagnosis: ${diseaseName}

TEXTBOOK REFERENCE:
${ragContext || 'No additional reference.'}

PLAYER'S FINDINGS:
- Abnormal exams: ${playerActions.exams.filter(e => e.isAbnormal).map(e => `${e.name}: ${e.finding}`).join('; ') || 'None'}
- Abnormal tests: ${playerActions.tests.filter(t => t.isAbnormal).map(t => `${t.name}: ${t.result}`).join('; ') || 'None'}

IMPORTANT: Use **double asterisks** around key medical terms to make them bold.

Output JSON:
{
  "description": "**${diseaseName}** is [1-2 sentences describing what this condition is]. Keep it brief and educational.",
  "keySymptoms": [
    "**Symptom name** - brief explanation",
    "**Another symptom** - how it presents",
    "**Third symptom** - clinical relevance"
  ],
  "diagnosisSteps": [
    "**History**: Key questions to ask (e.g., duration, character of symptoms)",
    "**Examination**: Key physical exam findings to look for",
    "**Investigations**: Most important test to confirm diagnosis"
  ],
  "keyFindings": [
    "**Finding** - what was found and why it confirms the diagnosis",
    "**Another finding** - its significance",
    "**Test result** - what it shows"
  ],
  "clinicalReasoning": "2-3 sentences. Start with the presenting complaint, explain how **key findings** point to this diagnosis, and what **rules out** other possibilities."
}`;

  try {
    // Use unified AI provider (Groq for speed as this is a fallback)
    const provider = getProviderForTask('explanation');
    console.log(`[Diagnosis Explanation Fallback] Using provider: ${provider}`);

    let content = await aiCompletion({
      taskType: 'explanation',
      systemPrompt,
      userPrompt: 'Explain the diagnosis in structured textbook format with bold key terms.',
      maxTokens: 1500,
      temperature: 0.5,
      jsonMode: true
    });

    content = content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');

    const result = JSON.parse(content);
    return {
      description: result.description || `**${diseaseName}** is a condition matching the patient's presentation.`,
      keySymptoms: result.keySymptoms || [],
      diagnosisSteps: result.diagnosisSteps || [],
      keyFindings: result.keyFindings || [],
      clinicalReasoning: result.clinicalReasoning || ''
    };
  } catch (error) {
    console.error('Diagnosis explanation generation error:', error);
    return {
      description: `**${diseaseName}** is a condition characterized by the symptoms presented in this case.`,
      keySymptoms: ['Review the case for symptom details'],
      diagnosisSteps: ['**History**: Assess presenting symptoms', '**Examination**: Perform relevant physical exam', '**Investigations**: Order confirmatory tests'],
      keyFindings: ['Review the case for detailed findings'],
      clinicalReasoning: 'Clinical reasoning could not be generated.'
    };
  }
}

/**
 * Generate explanation of why an incorrect diagnosis was wrong
 * Explains what findings contradict the wrong answer
 */
export async function generateIncorrectDiagnosisExplanation(
  caseData: Case,
  incorrectDiagnosisId: string,
  playerActions: {
    questions: string[];
    exams: { name: string; finding: string; isAbnormal: boolean }[];
    tests: { name: string; result: string; isAbnormal: boolean }[];
  }
): Promise<{
  description: string;
  whyIncorrect: string;
  keyDifferences: string[];
  missingFindings: string[];
  contradictingFindings: string[];
  differentiatingFeatures: string;
}> {
  const correctDiagnosis = caseData.diagnoses.find(d => d.id === caseData.correctDiagnosisId);
  const incorrectDiagnosis = caseData.diagnoses.find(d => d.id === incorrectDiagnosisId);

  const correctName = correctDiagnosis?.name || 'Unknown';
  const incorrectName = incorrectDiagnosis?.name || 'Unknown';

  const systemPrompt = `You are a medical educator. Generate a STRUCTURED explanation of why the diagnosis was INCORRECT.

CASE INFORMATION:
- Patient: ${caseData.persona.name}, ${caseData.persona.age}yo ${caseData.persona.gender}
- Initial complaint: ${caseData.initialComplaint}
- Actual symptoms: ${caseData.symptoms}
- Relevant findings: ${caseData.relevantFindings}

CORRECT diagnosis: ${correctName}
PLAYER'S WRONG answer: ${incorrectName}

PLAYER'S FINDINGS:
- Exams performed: ${playerActions.exams.map(e => `${e.name}: ${e.finding}`).join('; ') || 'None'}
- Tests ordered: ${playerActions.tests.map(t => `${t.name}: ${t.result}`).join('; ') || 'None'}

IMPORTANT: Use **double asterisks** around key medical terms to make them bold.

Output JSON:
{
  "description": "**${incorrectName}** is [1-2 sentences describing what this condition is and how it typically presents].",
  "whyIncorrect": "2-3 sentences explaining why this answer doesn't fit this case. Use **bold** on key distinguishing features.",
  "keyDifferences": [
    "**Feature 1**: How ${incorrectName} differs from ${correctName}",
    "**Feature 2**: Another key distinguishing characteristic",
    "**Feature 3**: What should have ruled out ${incorrectName}"
  ],
  "missingFindings": [
    "**Finding** that would be expected in ${incorrectName} but wasn't present",
    "**Another finding** that was absent"
  ],
  "contradictingFindings": [
    "**Finding** in this case that contradicts ${incorrectName}",
    "**Another finding** that points away from ${incorrectName}"
  ],
  "differentiatingFeatures": "2-3 sentences summarizing how to distinguish between **${incorrectName}** and **${correctName}** in similar cases."
}`;

  try {
    // Use unified AI provider (Groq for speed as this is a fallback)
    const provider = getProviderForTask('explanation');
    console.log(`[Incorrect Diagnosis Explanation] Using provider: ${provider}`);

    let content = await aiCompletion({
      taskType: 'explanation',
      systemPrompt,
      userPrompt: 'Explain why this diagnosis was incorrect in structured format with bold key terms.',
      maxTokens: 1500,
      temperature: 0.5,
      jsonMode: true
    });

    content = content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');

    const result = JSON.parse(content);
    return {
      description: result.description || `**${incorrectName}** is a condition that was ruled out in this case.`,
      whyIncorrect: result.whyIncorrect || '',
      keyDifferences: result.keyDifferences || [],
      missingFindings: result.missingFindings || [],
      contradictingFindings: result.contradictingFindings || [],
      differentiatingFeatures: result.differentiatingFeatures || ''
    };
  } catch (error) {
    console.error('Incorrect diagnosis explanation error:', error);
    return {
      description: `**${incorrectName}** was your selected diagnosis but doesn't match this case.`,
      whyIncorrect: `The findings in this case point to **${correctName}** rather than **${incorrectName}**.`,
      keyDifferences: [`Review the differences between **${incorrectName}** and **${correctName}**`],
      missingFindings: [],
      contradictingFindings: [],
      differentiatingFeatures: `Compare the typical presentations of **${incorrectName}** and **${correctName}**.`
    };
  }
}

/**
 * Parse and validate free-text test orders
 * Returns valid test names and errors for invalid/unclear inputs
 */
export async function parseAndValidateTests(
  freeText: string
): Promise<{
  validTests: string[];
  errors: ValidationError[];
}> {
  if (!freeText.trim()) {
    return { validTests: [], errors: [] };
  }

  const systemPrompt = `You are a medical test order validator for an educational diagnosis game.

COMMON MEDICAL TESTS (these are always valid):
- Blood tests: CBC, Complete Blood Count, BMP, Basic Metabolic Panel, CMP, Comprehensive Metabolic Panel, LFT, Liver Function Tests, Thyroid Panel, TSH, T3, T4, Lipid Panel, HbA1c, Hemoglobin A1C, Cardiac Enzymes, Troponin, D-Dimer, PT/INR, Prothrombin Time, ESR, CRP, C-Reactive Protein
- Imaging: Chest X-Ray, CXR, Abdominal X-Ray, CT Scan (Head/Chest/Abdomen/Pelvis), MRI (Brain/Spine), Ultrasound, Echo, Echocardiogram, Doppler
- Other: ECG, EKG, Electrocardiogram, Urinalysis, Urine Culture, Blood Culture, Stool Sample, Lumbar Puncture, PFT, Pulmonary Function Test, Stress Test, Endoscopy, Colonoscopy

TASK: Parse the user's free-text input and identify what tests they want to order.

For EACH item in the input:
1. If it's a recognizable medical test (even with typos/abbreviations), add to "valid" with the proper test name
2. If it's unclear, nonsensical, or not a real test, add to "errors" with a helpful message

Output ONLY valid JSON:
{
  "valid": [
    {"input": "what user typed", "testName": "Proper Test Name"}
  ],
  "errors": [
    {"input": "what user typed", "message": "Helpful error message"}
  ]
}

Examples:
- "cbc" → valid: "Complete Blood Count (CBC)"
- "blood sugar" → valid: "Hemoglobin A1C" or "Basic Metabolic Panel (BMP)"
- "chest xray" → valid: "Chest X-Ray"
- "blod presure" → error: "Did you mean Blood Pressure? That's a vital sign, not a test. Try ordering an ECG or checking vital signs."
- "everything" → error: "Please specify which tests you want to order (e.g., CBC, Chest X-Ray)"
- "asdfgh" → error: "This doesn't appear to be a medical test. Please enter a valid test name."`;

  try {
    // Use unified AI provider (Groq for speed in hybrid mode)
    const provider = getProviderForTask('parse_input');
    console.log(`[Parse Tests] Using provider: ${provider}`);

    let content = await aiCompletion({
      taskType: 'parse_input',
      systemPrompt,
      userPrompt: `Parse these test orders:\n${freeText}`,
      maxTokens: 1000,
      temperature: 0.3,
      jsonMode: true
    });

    // Strip markdown code blocks if present
    if (content.startsWith('```json')) {
      content = content.slice(7);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    const result = JSON.parse(content);

    return {
      validTests: (result.valid || []).map((v: { testName: string }) => v.testName),
      errors: (result.errors || []).map((e: { input: string; message: string }) => ({
        input: e.input,
        message: e.message
      }))
    };
  } catch (error) {
    console.error('Test validation error:', error);
    return {
      validTests: [],
      errors: [{ input: freeText, message: 'Could not parse your request. Please try again with specific test names.' }]
    };
  }
}

/**
 * Parse and validate free-text examination orders
 * Returns valid exam names and errors for invalid/unclear inputs
 */
export async function parseAndValidateExams(
  freeText: string
): Promise<{
  validExams: string[];
  errors: ValidationError[];
}> {
  if (!freeText.trim()) {
    return { validExams: [], errors: [] };
  }

  const systemPrompt = `You are a physical examination validator for an educational diagnosis game.

COMMON PHYSICAL EXAMINATIONS (these are always valid):
- Vital Signs: Heart Rate, Blood Pressure, Respiratory Rate, Temperature, Oxygen Saturation, SpO2
- General: General Appearance, PICCLE (Pallor, Icterus, Cyanosis, Clubbing, Lymphadenopathy, Edema), Skin Examination, Lymph Node Examination
- Cardiovascular: Heart Auscultation, Peripheral Pulses, JVP, Jugular Venous Pressure, Capillary Refill
- Respiratory: Lung Auscultation, Chest Percussion, Chest Expansion, Breathing Pattern
- Abdominal: Abdominal Inspection, Abdominal Palpation, Abdominal Percussion, Bowel Sounds, Liver Palpation, Spleen Palpation
- Neurological: Pupil Response, Reflexes, Motor Strength, Sensory Examination, Cranial Nerves
- Musculoskeletal: Joint Examination, Range of Motion, Muscle Tenderness

TASK: Parse the user's free-text input and identify what examinations they want to perform.

For EACH item in the input:
1. If it's a recognizable physical examination (even with typos/abbreviations), add to "valid" with the proper name
2. If it's unclear, nonsensical, or not a real exam, add to "errors" with a helpful message

Output ONLY valid JSON:
{
  "valid": [
    {"input": "what user typed", "examName": "Proper Examination Name"}
  ],
  "errors": [
    {"input": "what user typed", "message": "Helpful error message"}
  ]
}

Examples:
- "heart sounds" → valid: "Heart Auscultation"
- "check lungs" → valid: "Lung Auscultation"
- "bp" → valid: "Blood Pressure"
- "piccle" → valid: "General Physical Examination (PICCLE)"
- "cbc" → error: "CBC is a blood test, not a physical examination. Order it from the Tests tab."
- "everything" → error: "Please specify which examinations you want to perform (e.g., Heart Auscultation, Abdominal Palpation)"
- "xyz" → error: "This doesn't appear to be a physical examination. Please enter a valid exam name."`;

  try {
    // Use unified AI provider (Groq for speed in hybrid mode)
    const provider = getProviderForTask('parse_input');
    console.log(`[Parse Exams] Using provider: ${provider}`);

    let content = await aiCompletion({
      taskType: 'parse_input',
      systemPrompt,
      userPrompt: `Parse these examination requests:\n${freeText}`,
      maxTokens: 1000,
      temperature: 0.3,
      jsonMode: true
    });

    // Strip markdown code blocks if present
    if (content.startsWith('```json')) {
      content = content.slice(7);
    } else if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    const result = JSON.parse(content);

    return {
      validExams: (result.valid || []).map((v: { examName: string }) => v.examName),
      errors: (result.errors || []).map((e: { input: string; message: string }) => ({
        input: e.input,
        message: e.message
      }))
    };
  } catch (error) {
    console.error('Exam validation error:', error);
    return {
      validExams: [],
      errors: [{ input: freeText, message: 'Could not parse your request. Please try again with specific exam names.' }]
    };
  }
}

/**
 * AI-based scoring system for diagnosis game
 * Evaluates player performance holistically considering:
 * - Engagement gate: Zero effort = zero score
 * - Diagnosis correctness (major factor)
 * - Efficiency: Correct + fewer tests = higher score
 * - Clinical approach: Questions, exams, tests quality
 */
export interface AIScoreInput {
  // Case information
  caseId: string;
  domain: string;
  correctDiagnosisName: string;
  submittedDiagnosisName: string;
  isCorrect: boolean;

  // Time information
  timeElapsedMinutes: number;
  isTimeout: boolean;

  // Player actions
  questionsAsked: Array<{ content: string; quality: number }>;
  examsPerformed: Array<{ name: string; finding: string; isAbnormal: boolean }>;
  testsOrdered: Array<{ name: string; result: string; isAbnormal: boolean }>;

  // Ideal pathway (if available)
  idealPathway?: {
    keyHistoryQuestions: Array<{ action: string; importance: string }>;
    keyExaminations: Array<{ action: string; importance: string }>;
    keyInvestigations: Array<{ action: string; importance: string }>;
  };
}

/**
 * Generate AI-based score for a completed game
 * This replaces the deterministic scoring with intelligent evaluation
 */
export async function generateAIScore(input: AIScoreInput): Promise<ScoreBreakdown> {
  // ENGAGEMENT GATE: Check for zero effort
  const totalActions = input.questionsAsked.length + input.examsPerformed.length + input.testsOrdered.length;
  const timeInSeconds = input.timeElapsedMinutes * 60;
  const questionCount = input.questionsAsked.length;

  // Zero engagement with WRONG answer = zero score
  if (totalActions === 0 && !input.isCorrect) {
    console.log('[AI Scoring] Engagement gate triggered - zero effort, wrong answer');
    return createZeroScoreBreakdown(input, 'No clinical investigation performed. Score: 0');
  }

  // LUCKY GUESS DETECTION: Correct answer but suspicious lack of effort
  // Criteria for lucky guess:
  // 1. Correct diagnosis
  // 2. Very few actions (0-1 total) OR very fast time with minimal investigation
  const isLikelyLuckyGuess = input.isCorrect && (
    totalActions === 0 ||
    (totalActions <= 1 && timeInSeconds < 60) ||
    (questionCount === 0 && timeInSeconds < 45)
  );

  if (isLikelyLuckyGuess) {
    console.log('[AI Scoring] Lucky guess detected - correct with minimal investigation');
    return createLuckyGuessBreakdown(input, totalActions, timeInSeconds);
  }

  // Build the prompt for AI scoring
  const systemPrompt = `You are a medical education scoring system. Evaluate the student's diagnostic performance and provide a detailed score breakdown.

SCORING PHILOSOPHY:
1. ENGAGEMENT GATE: If the student made virtually no effort (e.g., just guessed), score should be very low (0-10)
2. CORRECT DIAGNOSIS is the PRIMARY factor - wrong diagnosis caps the total score at 40/100 max
3. EFFICIENCY is REWARDED: Correct diagnosis with FEWER tests = HIGHER score
   - Minimal tests + correct = bonus points
   - Excessive tests = penalty even if correct
4. Clinical reasoning quality matters - good questions and systematic approach add points

SCORE DISTRIBUTION (total must equal 100):
- Time (10 points max): Fast is good, but rushing leads to mistakes
- Test Economy (20 points max): FEWER tests = HIGHER score when diagnosis is correct
- Efficiency (15 points max): Avoiding unnecessary/redundant tests
- Accuracy (40 points max): Correct diagnosis = 40, Wrong = 0
- Clinical Reasoning (15 points max): Question quality, systematic approach

GRADING SCALE:
- S (90-100): Perfect or near-perfect - correct diagnosis with minimal efficient testing
- A (80-89): Excellent - correct with good efficiency
- B (70-79): Good - correct but some inefficiency
- C (60-69): Average - correct but wasteful, or very close wrong answer
- D (40-59): Below average - wrong but showed effort
- F (0-39): Failing - wrong with poor approach or no effort

CRITICAL RULES:
- WRONG diagnosis + NO tests + NO questions = 0 total score (pure guess)
- WRONG diagnosis + minimal effort = 5-15 total score
- WRONG diagnosis + good effort but wrong conclusion = 20-40 total score
- CORRECT diagnosis + excessive tests = 60-75 total score
- CORRECT diagnosis + optimal tests = 85-100 total score

Output ONLY a valid JSON object matching this structure:
{
  "time": {
    "raw": <0-100>,
    "weighted": <0-10>,
    "timeElapsedMinutes": <number>,
    "bonusApplied": <boolean>,
    "details": "<explanation>"
  },
  "budget": {
    "raw": <0-100>,
    "weighted": <0-20>,
    "testsOrdered": <number>,
    "optimalTests": <recommended number for this case>,
    "penaltyPerTest": 10,
    "bonusApplied": <boolean>,
    "details": "<explanation>"
  },
  "efficiency": {
    "raw": <0-100>,
    "weighted": <0-15>,
    "unnecessaryTests": ["list of tests that weren't needed"],
    "redundantTests": ["list of duplicate tests"],
    "lowYieldTests": ["tests unlikely to help this case"],
    "totalPenalty": <number>,
    "details": "<explanation>"
  },
  "accuracy": {
    "raw": <0 or 100>,
    "weighted": <0 or 40>,
    "correct": <boolean>,
    "firstAttempt": true,
    "details": "<explanation of why right/wrong>"
  },
  "clinicalReasoning": {
    "raw": <0-100>,
    "weighted": <0-15>,
    "relevantActionsCount": <number>,
    "totalActionsCount": <number>,
    "systematicApproach": <boolean>,
    "questionQualityAvg": <1-10>,
    "details": "<explanation>"
  },
  "totalScore": <0-100>,
  "grade": "<S|A|B|C|D|F>",
  "rank": "<title based on grade>",
  "summary": "<1 sentence summary>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "areasForImprovement": ["<area 1>", "<area 2>"]
}`;

  const userPrompt = `Score this diagnostic performance:

CASE: ${input.domain} case
CORRECT DIAGNOSIS: ${input.correctDiagnosisName}
SUBMITTED DIAGNOSIS: ${input.submittedDiagnosisName}
RESULT: ${input.isCorrect ? 'CORRECT' : 'INCORRECT'}
${input.isTimeout ? '(Game ended by TIMEOUT - player ran out of time)' : ''}

TIME: ${input.timeElapsedMinutes.toFixed(1)} minutes

QUESTIONS ASKED (${input.questionsAsked.length}):
${input.questionsAsked.length > 0
  ? input.questionsAsked.map((q, i) => `${i+1}. "${q.content}" (quality: ${q.quality}/10)`).join('\n')
  : 'None'}

EXAMINATIONS PERFORMED (${input.examsPerformed.length}):
${input.examsPerformed.length > 0
  ? input.examsPerformed.map(e => `- ${e.name}: ${e.finding} ${e.isAbnormal ? '(ABNORMAL)' : '(normal)'}`).join('\n')
  : 'None'}

TESTS ORDERED (${input.testsOrdered.length}):
${input.testsOrdered.length > 0
  ? input.testsOrdered.map(t => `- ${t.name}: ${t.result} ${t.isAbnormal ? '(ABNORMAL)' : '(normal)'}`).join('\n')
  : 'None'}

${input.idealPathway ? `
IDEAL APPROACH (for reference):
- Key questions: ${input.idealPathway.keyHistoryQuestions.slice(0, 3).map(q => q.action).join('; ')}
- Key exams: ${input.idealPathway.keyExaminations.slice(0, 3).map(e => e.action).join('; ')}
- Key tests: ${input.idealPathway.keyInvestigations.slice(0, 3).map(t => t.action).join('; ')}
` : ''}

Score this performance. Remember:
- WRONG + NO EFFORT = 0
- CORRECT + EFFICIENT = HIGH SCORE
- CORRECT + EXCESSIVE TESTS = MEDIUM SCORE
- WRONG + GOOD EFFORT = LOW-MEDIUM SCORE

IMPORTANT: Respond with ONLY the JSON object. No explanations, no markdown, no code blocks. Start your response with { and end with }.`;

  // Retry up to 2 times if JSON parsing fails
  const maxRetries = 2;
  let lastError: Error | null = null;

  // Use unified AI provider (Groq SMART model for scoring - needs reasoning)
  const provider = getProviderForTask('scoring');
  console.log(`[AI Scoring] Using provider: ${provider}`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let content = await aiCompletion({
        taskType: 'scoring',
        systemPrompt,
        userPrompt,
        maxTokens: 2000,
        temperature: 0.3,
        jsonMode: true
      });

      // Strip markdown code blocks if present
      content = content.trim();
      if (content.startsWith('```json')) {
        content = content.slice(7);
      } else if (content.startsWith('```')) {
        content = content.slice(3);
      }
      if (content.endsWith('```')) {
        content = content.slice(0, -3);
      }
      content = content.trim();

      // Try to find JSON in the response if it doesn't start with {
      if (!content.startsWith('{')) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        }
      }

      const result = JSON.parse(content);

      // Validate and ensure structure matches ScoreBreakdown
      const scoreBreakdown: ScoreBreakdown = {
        time: {
          raw: Math.round(result.time?.raw || 0),
          weighted: Math.round((result.time?.weighted || 0) * 10) / 10,
          timeElapsedMinutes: input.timeElapsedMinutes,
          bonusApplied: result.time?.bonusApplied || false,
          details: result.time?.details || ''
        },
        budget: {
          raw: Math.round(result.budget?.raw || 0),
          weighted: Math.round((result.budget?.weighted || 0) * 10) / 10,
          testsOrdered: input.testsOrdered.length,
          optimalTests: result.budget?.optimalTests || 3,
          penaltyPerTest: 10,
          bonusApplied: result.budget?.bonusApplied || false,
          details: result.budget?.details || ''
        },
        efficiency: {
          raw: Math.round(result.efficiency?.raw || 0),
          weighted: Math.round((result.efficiency?.weighted || 0) * 10) / 10,
          unnecessaryTests: result.efficiency?.unnecessaryTests || [],
          redundantTests: result.efficiency?.redundantTests || [],
          lowYieldTests: result.efficiency?.lowYieldTests || [],
          totalPenalty: result.efficiency?.totalPenalty || 0,
          details: result.efficiency?.details || ''
        },
        accuracy: {
          raw: input.isCorrect ? 100 : 0,
          weighted: input.isCorrect ? 40 : 0,
          correct: input.isCorrect,
          firstAttempt: true,
          details: result.accuracy?.details || (input.isCorrect ? 'Correct diagnosis!' : `Incorrect. The answer was ${input.correctDiagnosisName}`)
        },
        clinicalReasoning: {
          raw: Math.round(result.clinicalReasoning?.raw || 0),
          weighted: Math.round((result.clinicalReasoning?.weighted || 0) * 10) / 10,
          relevantActionsCount: result.clinicalReasoning?.relevantActionsCount || 0,
          totalActionsCount: totalActions,
          systematicApproach: result.clinicalReasoning?.systematicApproach || false,
          questionQualityAvg: result.clinicalReasoning?.questionQualityAvg || 5,
          details: result.clinicalReasoning?.details || ''
        },
        totalScore: Math.round(result.totalScore || 0),
        grade: result.grade || 'F',
        rank: result.rank || getRankFromGrade(result.grade || 'F'),
        summary: result.summary || '',
        strengths: result.strengths || [],
        areasForImprovement: result.areasForImprovement || [],
        calculatedAt: Date.now()
      };

      // Apply engagement gate multiplier for very low effort wrong answers
      if (!input.isCorrect && totalActions <= 2 && input.timeElapsedMinutes < 1) {
        // Scale down score significantly for low-effort wrong guesses
        const effortMultiplier = Math.max(0.1, totalActions / 5);
        scoreBreakdown.totalScore = Math.round(scoreBreakdown.totalScore * effortMultiplier);
        scoreBreakdown.grade = getGradeFromScore(scoreBreakdown.totalScore);
        scoreBreakdown.rank = getRankFromGrade(scoreBreakdown.grade);
        scoreBreakdown.areasForImprovement.unshift('**Minimal effort detected.** Take time to investigate before guessing.');
      }

      console.log(`[AI Scoring] Generated score: ${scoreBreakdown.totalScore}/100 (${scoreBreakdown.grade})`);
      return scoreBreakdown;

    } catch (error) {
      lastError = error as Error;
      console.log(`[AI Scoring] Attempt ${attempt + 1} failed: ${(error as Error).message}`);
      // Continue to next retry
    }
  }

  // All retries failed
  console.error('[AI Scoring] All retries failed:', lastError);
  return createFallbackScore(input);
}

/**
 * Create a zero score breakdown for engagement gate failures
 */
function createZeroScoreBreakdown(input: AIScoreInput, reason: string): ScoreBreakdown {
  return {
    time: {
      raw: 0,
      weighted: 0,
      timeElapsedMinutes: input.timeElapsedMinutes,
      bonusApplied: false,
      details: 'No meaningful time spent on diagnosis'
    },
    budget: {
      raw: 0,
      weighted: 0,
      testsOrdered: input.testsOrdered.length,
      optimalTests: 3,
      penaltyPerTest: 10,
      bonusApplied: false,
      details: 'No tests ordered'
    },
    efficiency: {
      raw: 0,
      weighted: 0,
      unnecessaryTests: [],
      redundantTests: [],
      lowYieldTests: [],
      totalPenalty: 0,
      details: 'No actions to evaluate'
    },
    accuracy: {
      raw: 0,
      weighted: 0,
      correct: input.isCorrect,
      firstAttempt: true,
      details: input.isCorrect ? 'Lucky guess - no investigation performed' : `Incorrect guess. The answer was ${input.correctDiagnosisName}`
    },
    clinicalReasoning: {
      raw: 0,
      weighted: 0,
      relevantActionsCount: 0,
      totalActionsCount: 0,
      systematicApproach: false,
      questionQualityAvg: 0,
      details: 'No clinical reasoning demonstrated'
    },
    totalScore: 0,
    grade: 'F',
    rank: 'No Effort',
    summary: reason,
    strengths: [],
    areasForImprovement: [
      '**No investigation performed.** You must gather information before diagnosing.',
      'Ask the patient about their symptoms and history.',
      'Perform relevant physical examinations.',
      'Order appropriate tests based on your clinical suspicion.'
    ],
    calculatedAt: Date.now()
  };
}

/**
 * Create a score breakdown for lucky guesses (correct but no real investigation)
 * These get a capped score to prevent gaming the system
 */
function createLuckyGuessBreakdown(input: AIScoreInput, totalActions: number, timeInSeconds: number): ScoreBreakdown {
  // Lucky guess score: 25-40 depending on how much effort was shown
  // Base: 25 (you got it right, but barely better than random)
  // +5 for each action taken (up to +15)
  const effortBonus = Math.min(totalActions * 5, 15);
  const totalScore = 25 + effortBonus;

  const grade = totalScore >= 40 ? 'D' : 'F';

  return {
    time: {
      raw: 20,
      weighted: 2,
      timeElapsedMinutes: input.timeElapsedMinutes,
      bonusApplied: false,
      details: timeInSeconds < 30
        ? 'Suspiciously fast - no time for proper investigation'
        : 'Minimal time spent investigating'
    },
    budget: {
      raw: 0,
      weighted: 0,
      testsOrdered: input.testsOrdered.length,
      optimalTests: 3,
      penaltyPerTest: 10,
      bonusApplied: false,
      details: 'No tests ordered to support diagnosis'
    },
    efficiency: {
      raw: 0,
      weighted: 0,
      unnecessaryTests: [],
      redundantTests: [],
      lowYieldTests: [],
      totalPenalty: 0,
      details: 'Cannot evaluate efficiency without clinical workup'
    },
    accuracy: {
      raw: 100,
      weighted: 20, // Reduced from 40 - lucky guess only gets half credit
      correct: true,
      firstAttempt: true,
      details: '**Lucky guess detected.** Correct diagnosis, but without proper clinical investigation to support it.'
    },
    clinicalReasoning: {
      raw: 0,
      weighted: 0,
      relevantActionsCount: 0,
      totalActionsCount: totalActions,
      systematicApproach: false,
      questionQualityAvg: 0,
      details: 'No clinical reasoning demonstrated - diagnosis made without gathering evidence'
    },
    totalScore,
    grade,
    rank: 'Lucky Guesser',
    summary: `Correct diagnosis, but this appears to be a lucky guess. No meaningful clinical investigation was performed to support the diagnosis.`,
    strengths: [
      'You got the right answer'
    ],
    areasForImprovement: [
      '**Lucky guess detected.** In real practice, you need evidence to support your diagnosis.',
      'Ask the patient about their symptoms, history, and relevant factors.',
      'Perform physical examinations to gather clinical findings.',
      'Order appropriate tests to confirm or rule out your suspicions.',
      'A correct guess without investigation is not good medicine.'
    ],
    calculatedAt: Date.now()
  };
}

/**
 * Create a fallback score when AI scoring fails
 */
function createFallbackScore(input: AIScoreInput): ScoreBreakdown {
  const totalActions = input.questionsAsked.length + input.examsPerformed.length + input.testsOrdered.length;

  // Basic scoring logic
  let totalScore = 0;

  // Accuracy: 40 points for correct
  if (input.isCorrect) {
    totalScore += 40;
  }

  // Time: up to 10 points (faster = better)
  const timeScore = Math.max(0, 10 - Math.floor(input.timeElapsedMinutes / 2));
  totalScore += timeScore;

  // Test economy: up to 20 points (fewer tests = better if correct)
  if (input.isCorrect) {
    const testPenalty = Math.max(0, (input.testsOrdered.length - 3) * 5);
    totalScore += Math.max(0, 20 - testPenalty);
  } else {
    totalScore += Math.min(10, input.testsOrdered.length * 2);
  }

  // Efficiency: up to 15 points
  totalScore += input.isCorrect ? 15 : Math.min(5, totalActions);

  // Clinical reasoning: up to 15 points
  const avgQuality = input.questionsAsked.length > 0
    ? input.questionsAsked.reduce((sum, q) => sum + q.quality, 0) / input.questionsAsked.length
    : 0;
  totalScore += Math.round((avgQuality / 10) * 15);

  // Apply engagement gate for no-effort wrong answers
  if (!input.isCorrect && totalActions === 0) {
    totalScore = 0;
  }

  const grade = getGradeFromScore(totalScore);

  return {
    time: {
      raw: timeScore * 10,
      weighted: timeScore,
      timeElapsedMinutes: input.timeElapsedMinutes,
      bonusApplied: input.timeElapsedMinutes < 3,
      details: `Completed in ${input.timeElapsedMinutes.toFixed(1)} minutes`
    },
    budget: {
      raw: input.isCorrect ? Math.max(0, 100 - input.testsOrdered.length * 20) : 0,
      weighted: input.isCorrect ? Math.max(0, 20 - input.testsOrdered.length * 4) : 0,
      testsOrdered: input.testsOrdered.length,
      optimalTests: 3,
      penaltyPerTest: 10,
      bonusApplied: input.testsOrdered.length <= 3,
      details: `${input.testsOrdered.length} tests ordered`
    },
    efficiency: {
      raw: 50,
      weighted: 7.5,
      unnecessaryTests: [],
      redundantTests: [],
      lowYieldTests: [],
      totalPenalty: 0,
      details: 'Fallback scoring used'
    },
    accuracy: {
      raw: input.isCorrect ? 100 : 0,
      weighted: input.isCorrect ? 40 : 0,
      correct: input.isCorrect,
      firstAttempt: true,
      details: input.isCorrect ? 'Correct!' : `Incorrect. Answer: ${input.correctDiagnosisName}`
    },
    clinicalReasoning: {
      raw: Math.round(avgQuality * 10),
      weighted: Math.round((avgQuality / 10) * 15 * 10) / 10,
      relevantActionsCount: totalActions,
      totalActionsCount: totalActions,
      systematicApproach: input.questionsAsked.length > 0 && input.examsPerformed.length > 0,
      questionQualityAvg: avgQuality || 5,
      details: 'Fallback scoring'
    },
    totalScore: Math.round(totalScore),
    grade,
    rank: getRankFromGrade(grade),
    summary: `${grade} grade with ${totalScore}/100 points`,
    strengths: input.isCorrect ? ['Correct diagnosis'] : [],
    areasForImprovement: input.isCorrect ? [] : ['Review the case carefully'],
    calculatedAt: Date.now()
  };
}

/**
 * Get grade from score
 */
function getGradeFromScore(score: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Get rank title from grade
 */
function getRankFromGrade(grade: string): string {
  const ranks: Record<string, string> = {
    'S': 'Master Diagnostician',
    'A': 'Expert Clinician',
    'B': 'Competent Physician',
    'C': 'Developing Clinician',
    'D': 'Needs Improvement',
    'F': 'Insufficient Performance'
  };
  return ranks[grade] || 'Unknown';
}
