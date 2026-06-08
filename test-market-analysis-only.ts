import { AnthropicClient } from './src/llm/anthropic-client';
import { buildMarketAnalysisPrompt } from './src/prompts/research-agent.prompt';
import type { ResearchAgentInput } from './types/agent-types';

const testInput: ResearchAgentInput = {
  founder_brief: "Dog owners who travel frequently need trusted pet sitters who are reliable and affordable",
  define_output: {
    agent: 'define-problem',
    analysis_status: "complete",
    confidence: 75,
    problem_statement: "Dog owners who travel frequently cannot find trusted pet sitters",
    problem_strength_score: 72,
    pain_profile: {
      type: 'painkiller',
      type_basis: 'Dog owners actively spend money on pet care',
      frequency: 'weekly',
      intensity: 'significant',
      emotional_cost: 'anxiety about pet safety',
      awareness: 'explicit',
      latent_validation_note: ''
    },
    status_quo: {
      current_solutions: [
        { name: "Rover app", adequacy: "adequate" },
        { name: "asking friends/family", adequacy: "poor" }
      ],
      failed_solutions: [],
      switching_friction_from_current: "medium"
    },
    target_user: {
      primary: {
        description: "Frequent travelers with dogs",
        specificity: "high"
      },
      secondary: {
        description: "",
        same_as_primary: true
      },
      is_founder_the_user: false
    },
    neutral_restatement: "Finding reliable pet care while traveling",
    initial_problem_statement: "Dog owners need trustworthy pet sitters",
    problem_statement_revised: true,
    problem_statement_revision_reason: "Narrowed to frequent travelers",
    why_now: "Remote work enables more travel, pet ownership is at all-time high",
    assumptions: [],
    critical_unknowns: [],
    red_flags: [],
    problem_strength_breakdown: {
      pain_intensity: { score: 20, max: 30, basis: "Owners spend $50-200/month on pet care" },
      frequency: { score: 15, max: 20, basis: "Weekly need for frequent travelers" },
      user_specificity: { score: 18, max: 20, basis: "Clear demographic: frequent travelers" },
      evidence_quality: { score: 12, max: 20, basis: "Some market research, mostly founder-sourced" },
      urgency_and_willingness_to_pay: { score: 7, max: 10, basis: "Willingness to pay estimated" }
    },
    reasoning: [],
    recommended_next_steps: []
  } as any,
};

async function test() {
  console.log("=== Market Analysis Only Test ===\n");

  const prompt = buildMarketAnalysisPrompt(testInput);

  // Estimate token count before sending
  const systemPromptLength = prompt.system.length;
  const userMessageLength = prompt.messages[0].content.length;
  const estimatedTokens = Math.ceil((systemPromptLength + userMessageLength) / 3.5);

  console.log("Token Estimate (chars ÷ 3.5):");
  console.log(`  System prompt: ${systemPromptLength} chars ≈ ${Math.ceil(systemPromptLength / 3.5)} tokens`);
  console.log(`  User message: ${userMessageLength} chars ≈ ${Math.ceil(userMessageLength / 3.5)} tokens`);
  console.log(`  Total estimate: ${estimatedTokens} tokens\n`);

  try {
    const client = AnthropicClient.getInstance();
    console.log("Calling Market Analysis...\n");
    const result = await client.completeJSON(prompt);

    console.log("SUCCESS!");
    console.log("Result confidence:", result.confidence);
    console.log("Analysis status:", result.analysis_status);
    if (result.analysis_status === 'complete') {
      console.log("Market attractiveness score:", result.market_attractiveness_score);
      console.log("Market definition:", result.market_definition);
    }
    console.log("\nFull result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log("ERROR:", (err as any).message);
    if ((err as any).response) {
      console.log("Response status:", (err as any).response.status);
      console.log("Response body:", (err as any).response.data);
    }
  }

  process.exit(0);
}

test();
