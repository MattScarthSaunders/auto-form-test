import { FormInput, ProcessResult } from '../src/schema/index.js';
import JobApplicationScraper from '../src/scraper-service.js';
import dotenv from 'dotenv';

dotenv.config();

export async function example(): Promise<void> {
  console.log('=== Running Example ===');

  const scraper = new JobApplicationScraper({
    screenshotDir: './screenshots',
    headless: false
  });
  
  try {
    await scraper.initialize();
    
    const result = await scraper.processJobApplication(process.env.JOB_URL ?? '', {
      waitTime: 2000,
      scrollToBottom: true,
      outputDir: './output/advanced',
      clickApplyButton: true,
    });
    
    logResultSummary(result)
    
  } catch (error) {
    console.error('Advanced example error:', error);
  } finally {
    await scraper.close();
  }
}

function logResultSummary(result: ProcessResult) {
  if (result.success && result.scrapedData?.formInputs) {
    const totalInputs = result.scrapedData.formInputs.length;
    const conditionalInputs = result.scrapedData.formInputs.filter(i => i.conditional).length;
    const hiddenInputs = result.scrapedData.formInputs.filter(i => i.hidden).length;
    const triggeredInputs = result.scrapedData.formInputs.filter(i => i.triggeredBy).length;
    
    console.log(`\n📊 Summary:`, {
      totalInputs,
      conditionalInputs,
      hiddenInputs,
      visibleInputs: totalInputs - hiddenInputs,
      triggeredInputs
    });
    
    const inputsByIteration: { [key: number]: FormInput[] } = {};
    for (const input of result.scrapedData.formInputs) {
      const iteration = input.iteration || 0;
      if (!inputsByIteration[iteration]) {
        inputsByIteration[iteration] = [];
      }
      inputsByIteration[iteration].push(input);
    };
    
    console.log(`\n🔄 Inputs by iteration:`);
    const sortedInputs = Object.keys(inputsByIteration).sort((a, b) => parseInt(a) - parseInt(b))
    for (const iteration of sortedInputs) {
      console.log(`  Iteration ${iteration}: ${inputsByIteration[parseInt(iteration)].length} inputs`);
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  example();
}
