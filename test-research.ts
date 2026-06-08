import { ResearchAgent } from './agents/research-agent';

const agent = new ResearchAgent();

agent.execute({
  founder_brief: "Dog owners who travel need trusted pet sitters",
  define_output: {
    agent: 'define-problem',
    analysis_status: "complete",
    confidence: 75,
    problem_statement: "Dog owners who travel frequently cannot find trusted pet sitters",
    status_quo: {
      current_solutions: [
        { name: "Rover app", adequacy: "adequate" },
        { name: "asking friends/family", adequacy: "poor" }
      ]
    }
  } as any,
} as any).then(result => {
  console.log("SUCCESS:");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}).catch(err => {
  console.log("ERROR:", err.message);
  console.log("Stack:", err.stack);
  process.exit(1);
});
